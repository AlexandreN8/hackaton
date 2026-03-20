# Test d'intégration — valide la chaîne complète DB → calculator.
# Nécessite que Docker soit lancé (docker compose up).

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from app.core.calculator import ParamsTechno, ParamsMix, ParamsScenario, calculer_comparatif

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hackathon:hackathon@localhost:5432/hackathon")


def fetch_technos(cur):
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


def fetch_mix(cur):
    cur.execute("SELECT * FROM mix_electrique ORDER BY co2_kwh")
    return [
        ParamsMix(scenario=r["scenario"], pays=r["pays"],
                  co2_kwh=float(r["co2_kwh"]), source=r["source"])
        for r in cur.fetchall()
    ]


def run():
    print("=== Smoke test ===\n")
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    print("1. Lecture référentiel...")
    technos  = fetch_technos(cur)
    mix_list = fetch_mix(cur)
    print(f"   {len(technos)} technos : {[t.techno for t in technos]}")
    print(f"   {len(mix_list)} mix    : {[m.scenario for m in mix_list]}")

    print("\n2. Workload (5 premières lignes)...")
    cur.execute("SELECT timestamp_heure, etat, p_it_kw FROM workload_data ORDER BY timestamp_heure LIMIT 5")
    for row in cur.fetchall():
        print(f"   {row['timestamp_heure']} | {row['etat']:10} | {row['p_it_kw']} kW")

    print("\n3. Calcul comparatif P_it=50 kW...")
    params    = ParamsScenario(p_it_kw=50.0)
    resultats = calculer_comparatif("smoke_test", params, technos, mix_list[:3])
    print(f"   {len(resultats)} résultats (2 technos × 3 mix)")

    print("\n4. Résultats :")
    for r in resultats:
        roi = f"ROI={r.roi_annees.valeur:.1f}ans" if r.roi_annees else "référence"
        print(f"   {r.techno:4} × {r.mix_scenario:20} | E={r.e_totale.valeur}kW | CO2e={r.co2e_annuel.valeur:.2f}t | {roi}")

    print("\n5. Traçabilité...")
    r0 = resultats[0]
    assert r0.co2e_annuel.source != ""
    assert r0.e_totale.perimetre_inclus != ""
    assert r0.co2e_annuel.formule != ""
    print("   source, périmètre, formule ✓")
    p_its = {r.p_it_kw for r in resultats}
    assert len(p_its) == 1
    print(f"   P_it identique ({p_its.pop()} kW) ✓")

    cur.close()
    conn.close()
    print("\n=== Smoke test PASSED ✅ ===")


if __name__ == "__main__":
    run()
