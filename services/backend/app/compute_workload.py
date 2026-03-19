# Calcul batch du workload annuel.
# Lit les 8760 lignes de workload_data, applique le calculator
# sur chaque heure × techno × mix, et remplit processed_metrics.
# Tourne une fois au boot après init_db — résultats disponibles
# immédiatement pour le dashboard sans calcul à la demande.

import os
import json
import time
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from app.core.calculator import ParamsTechno, ParamsMix, ParamsScenario, calculer_scenario

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hackathon:hackathon@localhost:5432/hackathon")


def connect(retries=10, delay=3):
    for i in range(retries):
        try:
            conn = psycopg2.connect(DATABASE_URL)
            print("Connecté à Postgres.")
            return conn
        except psycopg2.OperationalError:
            print(f"Postgres pas prêt, retry {i+1}/{retries}...")
            time.sleep(delay)
    raise RuntimeError("Impossible de se connecter à Postgres.")


def fetch_technos(cur) -> list[ParamsTechno]:
    cur.execute("SELECT * FROM referentiel_pue ORDER BY techno")
    return [
        ParamsTechno(
            techno=r["techno"], pue_typ=float(r["pue_typ"]),
            pue_min=float(r["pue_min"]), pue_max=float(r["pue_max"]),
            wue=float(r["wue"]), cooling_fraction=float(r["cooling_fraction"]),
            capex_index=float(r["capex_index"]),
            max_rack_density_kw=int(r["max_rack_density_kw"]),
            m2_par_rack=float(r["m2_par_rack"]),
            perimetre=r["perimetre"], source=r["source"],
        )
        for r in cur.fetchall()
    ]


def fetch_mix(cur) -> list[ParamsMix]:
    cur.execute("SELECT * FROM mix_electrique ORDER BY co2_kwh")
    return [
        ParamsMix(scenario=r["scenario"], pays=r["pays"],
                  co2_kwh=float(r["co2_kwh"]), source=r["source"])
        for r in cur.fetchall()
    ]


def compute(conn, cur):
    print("Chargement référentiel...")
    technos  = fetch_technos(cur)
    mix_list = fetch_mix(cur)

    cur.execute("SELECT id, timestamp_heure, etat, p_it_kw FROM workload_data ORDER BY timestamp_heure")
    workload = cur.fetchall()

    total_lignes = len(technos) * len(mix_list) * len(workload)
    print(f"  {len(technos)} technos × {len(mix_list)} mix × {len(workload)} heures = {total_lignes:,} lignes")

    # On ne supprime que les lignes workload pour conserver l'historique utilisateur.
    cur.execute("DELETE FROM processed_metrics WHERE etat != 'user'")
    print("Calcul en cours...")

    batch      = []
    batch_size = 1000
    total      = 0
    techno_ref = next((t for t in technos if t.techno == "AC"), None)

    for row in workload:
        for techno in technos:
            for mix in mix_list:
                params = ParamsScenario(p_it_kw=float(row["p_it_kw"]))
                r = calculer_scenario(
                    "workload", params, techno, mix,
                    techno_ref if techno.techno != "AC" else None,
                )
                batch.append((
                    row["timestamp_heure"], r.techno, r.mix_scenario,
                    row["etat"], r.p_it_kw,
                    r.e_totale.inputs["pue_typ"],
                    r.co2e_annuel.inputs["co2_kwh"],
                    0.15,
                    r.e_totale.valeur, r.e_refroidissement.valeur,
                    r.e_it_pure.valeur, r.eau_annuelle.valeur,
                    r.co2e_annuel.valeur, int(r.nb_racks.valeur),
                    r.empreinte_m2.valeur, r.e_totale.perimetre_inclus,
                    json.dumps({
                        "pue_source": r.e_totale.source,
                        "co2_source": r.co2e_annuel.source,
                        "hypothese":  r.co2e_annuel.hypothese,
                    }),
                ))

                if len(batch) >= batch_size:
                    execute_values(cur, """
                        INSERT INTO processed_metrics
                            (timestamp_heure, techno, mix_scenario, etat, p_it_kw,
                             pue_utilise, co2_kwh_utilise, prix_kwh,
                             e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
                             eau_annuelle_m3, co2e_kg, nb_racks, empreinte_m2,
                             perimetre_inclus, hypotheses)
                        VALUES %s
                    """, batch)
                    conn.commit()
                    total += len(batch)
                    batch = []
                    print(f"  {total:,} / {total_lignes:,} lignes insérées...")

    if batch:
        execute_values(cur, """
            INSERT INTO processed_metrics
                (timestamp_heure, techno, mix_scenario, etat, p_it_kw,
                 pue_utilise, co2_kwh_utilise, prix_kwh,
                 e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
                 eau_annuelle_m3, co2e_kg, nb_racks, empreinte_m2,
                 perimetre_inclus, hypotheses)
            VALUES %s
        """, batch)
        conn.commit()
        total += len(batch)

    print(f"\n  {total:,} lignes calculées et insérées.")


if __name__ == "__main__":
    conn = connect()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    compute(conn, cur)
    cur.close()
    conn.close()
    print("compute_workload terminé.")
