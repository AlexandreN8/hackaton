import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx

from app.core.calculator import ParamsTechno, ParamsMix, ParamsScenario, calculer_comparatif

from fastapi.responses import JSONResponse
import json as _json

class UTF8JSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"
    def render(self, content) -> bytes:
        return _json.dumps(content, ensure_ascii=False, allow_nan=False).encode("utf-8")

app = FastAPI(
    title="Hackathon Cisco — Comparatif IC vs AC",
    default_response_class=UTF8JSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hackathon:hackathon@localhost:5432/hackathon")
AI_URL       = os.getenv("AI_URL", "http://ai:8001")


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


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
            erf_typ=float(r["erf_typ"]) if r["erf_typ"] else 0.0,
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


class CalculateRequest(BaseModel):
    p_it_kw: float = 50.0
    prix_kwh: float = 0.15
    technos: Optional[list[str]] = None
    mix_scenarios: Optional[list[str]] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/referentiel")
def get_referentiel():
    # Retourne technos et mix — le front s'en sert pour pré-remplir les sélecteurs.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    technos  = fetch_technos(cur)
    mix_list = fetch_mix(cur)
    cur.close()
    conn.close()
    return {
        "technos": [t.__dict__ for t in technos],
        "mix":     [m.__dict__ for m in mix_list],
    }


@app.post("/calculate")
def calculate(req: CalculateRequest):
    # Mode what-if sliders — calcule à la demande et stocke dans user_calculation.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    technos  = fetch_technos(cur)
    mix_list = fetch_mix(cur)

    if req.technos:
        technos = [t for t in technos if t.techno in req.technos]
    if req.mix_scenarios:
        mix_list = [m for m in mix_list if m.scenario in req.mix_scenarios]

    if not technos:
        raise HTTPException(400, "Aucune techno trouvée")
    if not mix_list:
        raise HTTPException(400, "Aucun mix trouvé")

    params    = ParamsScenario(p_it_kw=req.p_it_kw, prix_kwh=req.prix_kwh)
    resultats = calculer_comparatif("dashboard", params, technos, mix_list)

    rows = []
    for r in resultats:
        techno_obj = next(t for t in technos if t.techno == r.techno)
        eau_lh          = round(req.p_it_kw * techno_obj.wue, 3)
        eau_annuelle_m3 = round(req.p_it_kw * techno_obj.wue * 8760 / 1000, 2)

        row = {
            "techno"            : r.techno,
            "mix_scenario"      : r.mix_scenario,
            "p_it_kw"           : r.p_it_kw,
            "e_totale"          : r.e_totale.__dict__,
            "e_refroidissement" : r.e_refroidissement.__dict__,
            "e_it_pure"         : r.e_it_pure.__dict__,
            "eau_annuelle"      : r.eau_annuelle.__dict__,
            "co2e_annuel"       : r.co2e_annuel.__dict__,
            "nb_racks"          : r.nb_racks.__dict__,
            "empreinte_m2"      : r.empreinte_m2.__dict__,
            "e_recuperee"       : r.e_recuperee.__dict__ if r.e_recuperee else None,
            "economie_annuelle" : r.economie_annuelle.__dict__ if r.economie_annuelle else None,
            "surcout_capex"     : r.surcout_capex.__dict__ if r.surcout_capex else None,
            "roi_annees"        : r.roi_annees.__dict__ if r.roi_annees else None,
        }
        rows.append(row)

        cur.execute("""
            INSERT INTO user_calculation (
                techno, mix_scenario, p_it_kw,
                pue_calcule, wue_calcule,
                e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
                eau_lh, eau_annuelle_m3, co2e_kg,
                nb_racks, empreinte_m2,
                roi_annees, economie_annuelle_eur,
                erf_calcule, perimetre_inclus, hypotheses
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            r.techno, r.mix_scenario, r.p_it_kw,
            r.e_totale.inputs["pue_typ"], techno_obj.wue,
            r.e_totale.valeur, r.e_refroidissement.valeur,
            r.e_it_pure.valeur, eau_lh, eau_annuelle_m3,
            r.co2e_annuel.valeur,
            int(r.nb_racks.valeur), r.empreinte_m2.valeur,
            r.roi_annees.valeur if r.roi_annees else None,
            r.economie_annuelle.valeur if r.economie_annuelle else None,
            techno_obj.erf_typ,
            r.e_totale.perimetre_inclus,
            json.dumps({
                "pue_source": r.e_totale.source,
                "co2_source": r.co2e_annuel.source,
                "hypothese":  r.co2e_annuel.hypothese,
            }),
        ))

    conn.commit()
    cur.close()
    conn.close()
    return {"resultats": rows}


@app.get("/history")
def history(limit: int = 20):
    # N derniers calculs utilisateur via les sliders.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT techno, mix_scenario, p_it_kw,
               pue_calcule, wue_calcule, erf_calcule,
               e_totale_kw, e_refroidissement_kw,
               eau_annuelle_m3, co2e_kg,
               nb_racks, empreinte_m2,
               roi_annees, economie_annuelle_eur,
               created_at
        FROM user_calculation
        ORDER BY created_at DESC
        LIMIT %s
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"history": rows}


@app.get("/rt/latest")
def rt_latest():
    # Dernière mesure par rack — polling toutes les 5s par le front.
    # Retourne capteurs bruts + métriques calculées pour les 4 technos.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Dernière mesure brute par rack
    cur.execute("""
        SELECT DISTINCT ON (rack_id)
            rack_id, techno, timestamp_heure, p_it_kw,
            cpu_usage_percent, cpu_temp_c,
            ddr_temp_c, psu_temp_c,
            gpu_usage_percent, gpu_temp_c,
            hbm_temp_c, free_gpu_mem_percent,
            room_temp_c, iteesv, source
        FROM sensors_raw
        ORDER BY rack_id, timestamp_heure DESC
    """)
    sensors = {r["rack_id"]: dict(r) for r in cur.fetchall()}

    # Dernière métrique calculée par rack * techno * mix
    cur.execute("""
        SELECT DISTINCT ON (rack_id, techno, mix_scenario)
            rack_id, techno, mix_scenario, timestamp_heure,
            p_it_kw, pue_calcule, wue_calcule, erf_calcule,
            e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
            eau_lh, eau_annuelle_m3, co2e_kg
        FROM processed_rt
        ORDER BY rack_id, techno, mix_scenario, timestamp_heure DESC
    """)
    metrics = [dict(r) for r in cur.fetchall()]

    cur.close()
    conn.close()
    return {"sensors": sensors, "metrics": metrics}


@app.get("/rt/history")
def rt_history(
    technos: Optional[list[str]] = Query(default=None),
    mix_scenarios: Optional[list[str]] = Query(default=None),
    window: str = Query(default="1h", description="30m | 1h | 24h"),
):
    # Série temporelle pour les courbes RT.
    windows = {"30m": "30 minutes", "1h": "1 hour", "24h": "24 hours"}
    interval = windows.get(window, "1 hour")

    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    filters = [f"timestamp_heure >= NOW() - INTERVAL '{interval}'"]
    args    = []
    if technos:
        filters.append("techno = ANY(%s)")
        args.append(technos)
    if mix_scenarios:
        filters.append("mix_scenario = ANY(%s)")
        args.append(mix_scenarios)

    where = "WHERE " + " AND ".join(filters)

    cur.execute(f"""
        SELECT
            timestamp_heure, rack_id, techno, mix_scenario,
            p_it_kw, pue_calcule, wue_calcule, erf_calcule,
            e_totale_kw, e_refroidissement_kw,
            eau_lh, co2e_kg
        FROM processed_rt
        {where}
        ORDER BY timestamp_heure ASC, techno, mix_scenario
    """, args)

    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"window": window, "data": rows}


@app.post("/stream-reco")
async def stream_reco(req: CalculateRequest):
    # Lance le calcul puis stream la recommandation IA token par token.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    technos  = fetch_technos(cur)
    mix_list = fetch_mix(cur)
    if req.technos:
        technos = [t for t in technos if t.techno in req.technos]
    if req.mix_scenarios:
        mix_list = [m for m in mix_list if m.scenario in req.mix_scenarios]
    cur.close()
    conn.close()

    params    = ParamsScenario(p_it_kw=req.p_it_kw, prix_kwh=req.prix_kwh)
    resultats = calculer_comparatif("reco", params, technos, mix_list)

    summary = [
        {
            "techno"      : r.techno,
            "mix"         : r.mix_scenario,
            "e_totale_kw" : r.e_totale.valeur,
            "co2e_tco2"   : r.co2e_annuel.valeur,
            "roi_ans"     : r.roi_annees.valeur if r.roi_annees else None,
            "eau_m3"      : r.eau_annuelle.valeur,
            "nb_racks"    : r.nb_racks.valeur,
        }
        for r in resultats
    ]

    async def generate():
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", f"{AI_URL}/recommend",
                                     json={"resultats": summary, "p_it_kw": req.p_it_kw}) as resp:
                async for chunk in resp.aiter_text():
                    yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")