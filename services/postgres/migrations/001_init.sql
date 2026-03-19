-- ============================================================
-- 001_init.sql
-- Exécuté automatiquement par Postgres au premier démarrage
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : referentiel_pue
-- ============================================================
CREATE TABLE IF NOT EXISTS referentiel_pue (
    id                  SERIAL PRIMARY KEY,
    techno              VARCHAR(20) NOT NULL UNIQUE,
    pue_typ             NUMERIC(5,3) NOT NULL,
    pue_min             NUMERIC(5,3) NOT NULL,
    pue_max             NUMERIC(5,3) NOT NULL,
    wue                 NUMERIC(6,3) NOT NULL,
    cooling_fraction    NUMERIC(5,3) NOT NULL,
    capex_index         NUMERIC(5,3) NOT NULL,
    max_rack_density_kw INTEGER NOT NULL,
    m2_par_rack         NUMERIC(4,1) NOT NULL DEFAULT 2.0,
    perimetre           TEXT,
    source              TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE : mix_electrique
-- ============================================================
CREATE TABLE IF NOT EXISTS mix_electrique (
    id          SERIAL PRIMARY KEY,
    scenario    VARCHAR(50) NOT NULL UNIQUE,
    pays        VARCHAR(50),
    co2_kwh     NUMERIC(6,1) NOT NULL,
    source      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE : workload_data
-- 8760 lignes — une par heure sur 1 an
-- ============================================================
CREATE TABLE IF NOT EXISTS workload_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_heure TIMESTAMPTZ NOT NULL,
    etat            VARCHAR(20) NOT NULL,
    p_it_kw         NUMERIC(10,2) NOT NULL,
    source          VARCHAR(20) DEFAULT 'simulation',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE : processed_metrics
-- Résultats calculés — une ligne par heure × techno × mix
-- ============================================================
CREATE TABLE IF NOT EXISTS processed_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_heure         TIMESTAMPTZ NOT NULL,
    techno                  VARCHAR(20) NOT NULL,
    mix_scenario            VARCHAR(50) NOT NULL,
    etat                    VARCHAR(20) NOT NULL,
    p_it_kw                 NUMERIC(10,2) NOT NULL,
    pue_utilise             NUMERIC(5,3) NOT NULL,
    co2_kwh_utilise         NUMERIC(6,1) NOT NULL,
    prix_kwh                NUMERIC(6,4) NOT NULL DEFAULT 0.15,
    e_totale_kw             NUMERIC(10,3) NOT NULL,
    e_refroidissement_kw    NUMERIC(10,3) NOT NULL,
    e_it_pure_kw            NUMERIC(10,3) NOT NULL,
    eau_annuelle_m3         NUMERIC(10,2),
    co2e_kg                 NUMERIC(10,3) NOT NULL,
    nb_racks                INTEGER NOT NULL,
    empreinte_m2            NUMERIC(8,2) NOT NULL,
    perimetre_inclus        TEXT,
    hypotheses              JSONB,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_techno_mix
    ON processed_metrics(techno, mix_scenario);

CREATE INDEX IF NOT EXISTS idx_processed_timestamp
    ON processed_metrics(timestamp_heure);

CREATE INDEX IF NOT EXISTS idx_workload_timestamp
    ON workload_data(timestamp_heure);
