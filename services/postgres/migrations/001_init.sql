CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Constantes métier — chargées une fois au boot, jamais modifiées en runtime
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
    erf_typ             NUMERIC(5,3) DEFAULT 0.0, 
    perimetre           TEXT,
    source              TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Facteurs d'émission CO2e par mix électrique
CREATE TABLE IF NOT EXISTS mix_electrique (
    id          SERIAL PRIMARY KEY,
    scenario    VARCHAR(50) NOT NULL UNIQUE,
    pays        VARCHAR(50),
    co2_kwh     NUMERIC(6,1) NOT NULL,
    source      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Mesures brutes capteurs — archivage tel quel, pas de transformation
CREATE TABLE IF NOT EXISTS sensors_raw (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_heure       TIMESTAMPTZ NOT NULL,
    rack_id               VARCHAR(50),
    techno                VARCHAR(20),

    -- Avg Rack Density 
    p_it_kw               NUMERIC(10,2) NOT NULL,

    -- CPU
    cpu_usage_percent     NUMERIC(5,2),
    cpu_temp_c            NUMERIC(5,2),

    -- RAM DDR
    ddr_temp_c            NUMERIC(5,2),

    -- Alimentation
    psu_temp_c            NUMERIC(5,2),

    -- GPU AMD MI300X 
    gpu_usage_percent     NUMERIC(5,2),
    gpu_temp_c            NUMERIC(5,2),
    hbm_temp_c            NUMERIC(5,2),
    free_gpu_mem_percent  NUMERIC(5,2),

    -- Environnement salle
    room_temp_c           NUMERIC(5,2),

    -- ITEEsv  
    iteesv                NUMERIC(8,4),

    source                VARCHAR(20) DEFAULT 'simulation',
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Résultats calculés sur mesures réelles (depuis sensors.raw)
CREATE TABLE IF NOT EXISTS processed_rt (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_heure         TIMESTAMPTZ NOT NULL,
    rack_id                 VARCHAR(50),
    techno                  VARCHAR(20) NOT NULL,
    mix_scenario            VARCHAR(50) NOT NULL,

    -- Avg Rack Density
    p_it_kw                 NUMERIC(10,2) NOT NULL,

    -- Avg PUE et Avg WUE 
    pue_calcule             NUMERIC(5,3) NOT NULL,
    wue_calcule             NUMERIC(6,3) NOT NULL,

    -- Énergie
    e_totale_kw             NUMERIC(10,3) NOT NULL,
    e_refroidissement_kw    NUMERIC(10,3) NOT NULL,
    e_it_pure_kw            NUMERIC(10,3) NOT NULL,

    -- Eau instantanée (L/h) pour le RT
    eau_lh                  NUMERIC(10,3),
    -- Eau annualisée (m³/an) pour les KPI cards
    eau_annuelle_m3         NUMERIC(10,2),

    -- Impact carbone
    co2e_kg                 NUMERIC(10,3) NOT NULL,

    -- ERF (Energy Reuse Factor)
    erf_calcule             NUMERIC(5,3) DEFAULT 0.0,

    -- Traçabilité
    perimetre_inclus        TEXT,
    hypotheses              JSONB,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Résultats calculés sur mesures prédites (depuis sensors.predicted)
CREATE TABLE IF NOT EXISTS processed_predicted (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_heure         TIMESTAMPTZ NOT NULL,
    rack_id                 VARCHAR(50),
    techno                  VARCHAR(20) NOT NULL,
    mix_scenario            VARCHAR(50) NOT NULL,
    p_it_kw                 NUMERIC(10,2) NOT NULL,
    pue_calcule             NUMERIC(5,3) NOT NULL,
    wue_calcule             NUMERIC(6,3) NOT NULL,
    e_totale_kw             NUMERIC(10,3) NOT NULL,
    e_refroidissement_kw    NUMERIC(10,3) NOT NULL,
    e_it_pure_kw            NUMERIC(10,3) NOT NULL,
    eau_lh                  NUMERIC(10,3),
    eau_annuelle_m3         NUMERIC(10,2),
    co2e_kg                 NUMERIC(10,3) NOT NULL,
    erf_calcule             NUMERIC(5,3) DEFAULT 0.0,
    perimetre_inclus        TEXT,
    hypotheses              JSONB,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Calculs on-demand depuis les sliders utilisateur
CREATE TABLE IF NOT EXISTS user_calculation (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    techno                  VARCHAR(20) NOT NULL,
    mix_scenario            VARCHAR(50) NOT NULL,
    p_it_kw                 NUMERIC(10,2) NOT NULL,
    pue_calcule             NUMERIC(5,3) NOT NULL,
    wue_calcule             NUMERIC(6,3) NOT NULL,
    e_totale_kw             NUMERIC(10,3) NOT NULL,
    e_refroidissement_kw    NUMERIC(10,3) NOT NULL,
    e_it_pure_kw            NUMERIC(10,3) NOT NULL,
    eau_lh                  NUMERIC(10,3),
    eau_annuelle_m3         NUMERIC(10,2),
    co2e_kg                 NUMERIC(10,3) NOT NULL,
    nb_racks                INTEGER,
    empreinte_m2            NUMERIC(8,2),
    roi_annees              NUMERIC(6,2),
    economie_annuelle_eur   NUMERIC(12,2),
    erf_calcule             NUMERIC(5,3) DEFAULT 0.0,
    perimetre_inclus        TEXT,
    hypotheses              JSONB,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_rt_ts       ON processed_rt(timestamp_heure DESC);
CREATE INDEX IF NOT EXISTS idx_processed_rt_techno   ON processed_rt(techno, mix_scenario);
CREATE INDEX IF NOT EXISTS idx_processed_pred_ts     ON processed_predicted(timestamp_heure DESC);
CREATE INDEX IF NOT EXISTS idx_sensors_raw_ts        ON sensors_raw(timestamp_heure DESC);
CREATE INDEX IF NOT EXISTS idx_sensors_raw_rack      ON sensors_raw(rack_id, techno);
