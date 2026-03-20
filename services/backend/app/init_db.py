# Chargement initial de la DB au démarrage du conteneur init.
# Tourne une seule fois — les données de référence ne changent pas en runtime.

import os
import csv
import time
import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hackathon:hackathon@localhost:5432/hackathon")

TECHNOS = [
    {
        "techno": "AC", "pue_typ": 1.50, "pue_min": 1.20, "pue_max": 2.00,
        "wue": 1.8, "cooling_fraction": 0.37, "capex_index": 1.0,
        "max_rack_density_kw": 20, "m2_par_rack": 2.0, "erf_typ": 0.05,
        "perimetre": "Serveurs (avec ventilateurs) + Chiller + Ventilation de la salle",
        "source": "Uptime Institute Global Survey 2023 ; Eurostat B2B 2023 ; ASHRAE TC9.9",
    },
    {
        "techno": "IC", "pue_typ": 1.05, "pue_min": 1.02, "pue_max": 1.10,
        "wue": 0.0, "cooling_fraction": 0.03, "capex_index": 1.25,
        "max_rack_density_kw": 100, "m2_par_rack": 2.0, "erf_typ": 0.40,
        "perimetre": "Serveurs (sans ventilateurs) + Pompes + CDU",
        "source": "Green Revolution Cooling 2023 ; Uptime Institute 2022 ; Nvidia DGX H100 specs",
    },
    {
        "techno": "RDHx", "pue_typ": 1.20, "pue_min": 1.15, "pue_max": 1.35,
        "wue": 0.8, "cooling_fraction": 0.17, "capex_index": 1.4,
        "max_rack_density_kw": 40, "m2_par_rack": 2.0, "erf_typ": 0.20,
        "perimetre": "Serveurs + Porte arrière refroidie eau + Chiller partiel",
        "source": "ASHRAE TC9.9 (2021) / Schneider Electric White Paper 253 (2022)",
    },
    {
        "techno": "DLC", "pue_typ": 1.10, "pue_min": 1.05, "pue_max": 1.20,
        "wue": 0.3, "cooling_fraction": 0.09, "capex_index": 1.9,
        "max_rack_density_kw": 100, "m2_par_rack": 2.0, "erf_typ": 0.35,
        "perimetre": "Serveurs + Plaques froides CPU/GPU + CDU + AC résiduel",
        "source": "Nvidia DGX H100 specs (2023) / Intel IDC Cooling Study 2022",
    },
]
MIX = [
    ("Mix Fossile",       "Pologne",            600, "Agence Européenne de l'Environnement"),
    ("Mix Moyen",         "Allemagne",           350, "AEE 2023"),
    ("Mix Décarboné",     "France",               50, "RTE Bilan électrique 2023"),
    ("Mix Nucléaire pur", "France (nuit hiver)",   20, "RTE eco2mix 2023"),
    ("Mix Renouvelable",  "Islande / Norvège",     15, "IRENA Renewable Power 2023"),
    ("États-Unis",        "USA",                  386, "EPA eGRID 2022"),
]


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


def load_referentiel(cur):
    print("Chargement référentiel technos...")
    cur.execute("DELETE FROM referentiel_pue")
    for t in TECHNOS:
        cur.execute("""
            INSERT INTO referentiel_pue
                (techno, pue_typ, pue_min, pue_max, wue, cooling_fraction,
                 capex_index, max_rack_density_kw, m2_par_rack, erf_typ, perimetre, source)
            VALUES
                (%(techno)s, %(pue_typ)s, %(pue_min)s, %(pue_max)s, %(wue)s,
                 %(cooling_fraction)s, %(capex_index)s, %(max_rack_density_kw)s,
                 %(m2_par_rack)s, %(erf_typ)s, %(perimetre)s, %(source)s)
            ON CONFLICT (techno) DO UPDATE SET
                pue_typ=EXCLUDED.pue_typ, pue_min=EXCLUDED.pue_min,
                pue_max=EXCLUDED.pue_max, wue=EXCLUDED.wue,
                cooling_fraction=EXCLUDED.cooling_fraction,
                capex_index=EXCLUDED.capex_index,
                max_rack_density_kw=EXCLUDED.max_rack_density_kw,
                m2_par_rack=EXCLUDED.m2_par_rack,
                erf_typ=EXCLUDED.erf_typ,
                perimetre=EXCLUDED.perimetre, source=EXCLUDED.source
        """, t)
    print(f"  {len(TECHNOS)} technos insérées.")


def load_mix(cur):
    print("Chargement mix électriques...")
    cur.execute("DELETE FROM mix_electrique")
    execute_values(cur, """
        INSERT INTO mix_electrique (scenario, pays, co2_kwh, source)
        VALUES %s
        ON CONFLICT (scenario) DO UPDATE SET co2_kwh=EXCLUDED.co2_kwh, source=EXCLUDED.source
    """, MIX)
    print(f"  {len(MIX)} mix insérés.")


def verify(cur):
    print("\n=== Vérification ===")
    cur.execute("SELECT techno, pue_typ, wue FROM referentiel_pue ORDER BY techno")
    for row in cur.fetchall():
        print(f"  referentiel_pue : {row}")
    cur.execute("SELECT scenario, co2_kwh FROM mix_electrique ORDER BY co2_kwh")
    for row in cur.fetchall():
        print(f"  mix_electrique  : {row}")


if __name__ == "__main__":
    conn = connect()
    cur  = conn.cursor()
    load_referentiel(cur)
    load_mix(cur)
    verify(cur)
    conn.commit()
    cur.close()
    conn.close()
    print("\nInitialisation terminée.")