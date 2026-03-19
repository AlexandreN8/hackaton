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

app = FastAPI(title="Hackathon Cisco — Comparatif IC vs AC")

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
    # Retourne les technos et mix disponibles — le front s'en sert pour pré-remplir les sélecteurs.
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
    # Mode sélecteur : l'utilisateur choisit p_it_kw et les technos/mix à comparer.
    # Calcule à la demande et stocke dans processed_metrics pour l'historique.
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
        rows.append({
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
            "economie_annuelle" : r.economie_annuelle.__dict__ if r.economie_annuelle else None,
            "surcout_capex"     : r.surcout_capex.__dict__ if r.surcout_capex else None,
            "roi_annees"        : r.roi_annees.__dict__ if r.roi_annees else None,
        })
        cur.execute("""
            INSERT INTO processed_metrics
                (timestamp_heure, techno, mix_scenario, etat, p_it_kw,
                 pue_utilise, co2_kwh_utilise, prix_kwh,
                 e_totale_kw, e_refroidissement_kw, e_it_pure_kw,
                 eau_annuelle_m3, co2e_kg, nb_racks, empreinte_m2,
                 perimetre_inclus, hypotheses)
            VALUES (NOW(), %s, %s, 'user', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            r.techno, r.mix_scenario, r.p_it_kw,
            r.e_totale.inputs["pue_typ"],
            r.co2e_annuel.inputs["co2_kwh"],
            req.prix_kwh,
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

    conn.commit()
    cur.close()
    conn.close()
    return {"resultats": rows}


@app.get("/history")
def history(limit: int = 20):
    # Les N derniers calculs lancés par l'utilisateur via /calculate.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT techno, mix_scenario, p_it_kw,
               e_totale_kw, e_refroidissement_kw, co2e_kg,
               nb_racks, empreinte_m2, created_at
        FROM processed_metrics
        WHERE etat = 'user'
        ORDER BY created_at DESC
        LIMIT %s
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"history": rows}


@app.get("/workload-results")
def workload_results(
    technos: Optional[list[str]] = Query(default=None),
    mix_scenarios: Optional[list[str]] = Query(default=None),
):
    # Résultats pré-calculés du workload annuel.
    # Retourne la série temporelle + les totaux annuels pour les KPIs.
    conn = get_db()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    filters = ["etat != 'user'"]
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
            DATE_TRUNC('hour', timestamp_heure) AS heure,
            techno, mix_scenario, etat,
            ROUND(AVG(p_it_kw)::numeric, 2)             AS p_it_kw,
            ROUND(AVG(e_totale_kw)::numeric, 3)         AS e_totale_kw,
            ROUND(AVG(e_refroidissement_kw)::numeric, 3) AS e_refroidissement_kw,
            ROUND(AVG(e_it_pure_kw)::numeric, 3)        AS e_it_pure_kw,
            ROUND(AVG(co2e_kg)::numeric, 4)             AS co2e_kg,
            ROUND(AVG(eau_annuelle_m3)::numeric, 3)     AS eau_annuelle_m3,
            AVG(nb_racks)::integer                      AS nb_racks,
            ROUND(AVG(empreinte_m2)::numeric, 2)        AS empreinte_m2
        FROM processed_metrics {where}
        GROUP BY DATE_TRUNC('hour', timestamp_heure), techno, mix_scenario, etat
        ORDER BY heure, techno, mix_scenario
    """, args)
    serie = [dict(r) for r in cur.fetchall()]

    cur.execute(f"""
        SELECT
            techno, mix_scenario,
            ROUND(SUM(co2e_kg)::numeric, 1)         AS co2e_total_tco2,
            ROUND(SUM(eau_annuelle_m3)::numeric, 1) AS eau_total_m3,
            ROUND(AVG(e_totale_kw)::numeric, 2)     AS e_totale_moy_kw,
            ROUND(AVG(nb_racks))::integer           AS nb_racks,
            ROUND(AVG(empreinte_m2)::numeric, 1)    AS empreinte_m2
        FROM processed_metrics {where}
        GROUP BY techno, mix_scenario
        ORDER BY techno, mix_scenario
    """, args)
    kpis = [dict(r) for r in cur.fetchall()]

    cur.close()
    conn.close()
    return {"serie_temporelle": serie, "kpis": kpis}


@app.post("/stream-reco")
async def stream_reco(req: CalculateRequest):
    # Lance le calcul puis stream la recommandation IA token par token.
    # Le front affiche les graphiques pendant que l'IA génère le texte.
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
