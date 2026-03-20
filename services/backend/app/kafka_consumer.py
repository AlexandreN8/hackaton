import os
import json
import time
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

from app.core.calculator import (
    ParamsTechno, ParamsMix, ParamsScenario,
    calculer_scenario,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("consumer")

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
DATABASE_URL    = os.getenv("DATABASE_URL", "postgresql://hackathon:hackathon@localhost:5432/hackathon")
TOPICS          = ["sensors.raw", "sensors.predicted"]


def connect_kafka(retries=15, delay=3):
    for i in range(retries):
        try:
            consumer = KafkaConsumer(
                *TOPICS,
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_deserializer=lambda v: json.loads(v.decode("utf-8")) if v else None,
                auto_offset_reset="latest",
                group_id="hackathon-consumer",
            )
            log.info(f"Connecté à Kafka ({KAFKA_BOOTSTRAP}), écoute : {TOPICS}")
            return consumer
        except NoBrokersAvailable:
            log.warning(f"Kafka pas prêt, retry {i+1}/{retries}...")
            time.sleep(delay)
    raise RuntimeError("Impossible de se connecter à Kafka.")


def connect_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def load_referentiel(conn):
    # Chargé une seule fois au démarrage — ne change jamais en runtime.
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM referentiel_pue ORDER BY techno")
    technos = [
        ParamsTechno(
            techno=r["techno"], pue_typ=float(r["pue_typ"]),
            pue_min=float(r["pue_min"]), pue_max=float(r["pue_max"]),
            wue=float(r["wue"]), cooling_fraction=float(r["cooling_fraction"]),
            capex_index=float(r["capex_index"]),
            max_rack_density_kw=int(r["max_rack_density_kw"]),
            m2_par_rack=float(r["m2_par_rack"]),
            perimetre=r["perimetre"], source=r["source"],
erf_typ=float(r["erf_typ"]) if r.get("erf_typ") is not None else 0.0,
        )
        for r in cur.fetchall()
    ]
    cur.execute("SELECT * FROM mix_electrique ORDER BY co2_kwh")
    mix_list = [
        ParamsMix(scenario=r["scenario"], pays=r["pays"],
                  co2_kwh=float(r["co2_kwh"]), source=r["source"])
        for r in cur.fetchall()
    ]
    cur.close()
    log.info(f"Référentiel chargé : {len(technos)} technos, {len(mix_list)} mix")
    return technos, mix_list


def calc_iteesv(data: dict) -> float:
    # ITEEsv — performance serveur par rapport à sa consommation
    # Moyenne CPU+GPU usage divisée par p_it_kw. Plus la valeur est haute, meilleur c'est.
    cpu = data.get("cpu_usage_percent") or 0
    gpu = data.get("gpu_usage_percent") or 0
    p   = float(data.get("p_it_kw") or 1)
    return round(((cpu + gpu) / 2) / p, 4) if p > 0 else 0.0


def archive_sensor(cur, data: dict):
    cur.execute("""
        INSERT INTO sensors_raw (
            timestamp_heure, rack_id, techno, p_it_kw,
            cpu_usage_percent, cpu_temp_c,
            ddr_temp_c, psu_temp_c,
            gpu_usage_percent, gpu_temp_c,
            hbm_temp_c, free_gpu_mem_percent,
            room_temp_c, iteesv, source
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data["timestamp"], data.get("rack_id"), data.get("techno"),
        float(data["p_it_kw"]),
        data.get("cpu_usage_percent"), data.get("cpu_temp_c"),
        data.get("ddr_temp_c"), data.get("psu_temp_c"),
        data.get("gpu_usage_percent"), data.get("gpu_temp_c"),
        data.get("hbm_temp_c"), data.get("free_gpu_mem_percent"),
        data.get("room_temp_c"),
        calc_iteesv(data),
        data.get("source", "simulation"),
    ))


def process_message(msg, technos, mix_list, conn):
    if not msg.value:
        log.warning("Message vide reçu, ignoré.")
        return

    is_realtime = msg.topic == "sensors.raw"
    data        = msg.value
    p_it_kw     = float(data["p_it_kw"])
    timestamp   = data["timestamp"]
    rack_id     = data.get("rack_id")

    log.info(f"Message reçu — topic={msg.topic} rack={rack_id} p_it={p_it_kw}kW")

    cur        = conn.cursor()
    techno_ref = next((t for t in technos if t.techno == "AC"), None)

    if is_realtime:
        archive_sensor(cur, data)

    table = "processed_rt" if is_realtime else "processed_predicted"

    for techno in technos:
        for mix in mix_list:
            params = ParamsScenario(p_it_kw=p_it_kw)
            r = calculer_scenario(
                "realtime", params, techno, mix,
                techno_ref if techno.techno != "AC" else None,
            )

            eau_lh          = round(p_it_kw * techno.wue, 3)
            eau_annuelle_m3 = round(p_it_kw * techno.wue * 8760 / 1000, 2)
            # ERF : fraction d'énergie réutilisable (IC valorise la chaleur, AC non)
            erf_calcule     = round(techno.erf_typ, 3)

            cur.execute(f"""
                INSERT INTO {table} (
                    timestamp_heure, rack_id, techno, mix_scenario, p_it_kw,
                    pue_calcule, wue_calcule,
                    e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
                    eau_lh, eau_annuelle_m3, co2e_kg,
                    erf_calcule, perimetre_inclus, hypotheses
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                timestamp, rack_id, r.techno, r.mix_scenario, r.p_it_kw,
                r.e_totale.inputs["pue_typ"], techno.wue,
                r.e_totale.valeur, r.e_refroidissement.valeur,
                r.e_it_pure.valeur, eau_lh, eau_annuelle_m3,
                r.co2e_annuel.valeur, erf_calcule,
                r.e_totale.perimetre_inclus,
                json.dumps({
                    "pue_source": r.e_totale.source,
                    "co2_source": r.co2e_annuel.source,
                }),
            ))

    log.info(f"  → {len(technos) * len(mix_list)} lignes insérées dans {table}")


def run():
    db_conn           = connect_db()
    technos, mix_list = load_referentiel(db_conn)
    consumer          = connect_kafka()

    log.info("En attente de messages Kafka...")
    for msg in consumer:
        try:
            process_message(msg, technos, mix_list, db_conn)
        except Exception as e:
            log.error(f"Erreur sur message : {e}", exc_info=True)


if __name__ == "__main__":
    run()
