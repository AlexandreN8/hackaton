# Hackathon Cisco — Comparatif IC vs AC

Comparatif objectivé des technologies de refroidissement datacenter IA (AC, IC, RDHx, DLC) avec données capteurs en temps réel.

## Stack

- **Backend** : FastAPI + PostgreSQL
- **Broker** : Kafka + Zookeeper
- **Calcul** : bloc métier Python pur (`calculator.py`) — fonctions pures, zéro I/O
- **IA** : service recommandation LLM (à implémenter)
- **Frontend** : dashboard 

## Démarrage

```bash
cp .env.example .env
docker compose up --build
```

Le service `init` charge automatiquement le référentiel (4 technos, 6 mix électriques) au démarrage.

## Endpoints

### Mode temps réel (données capteurs Kafka)

| Route | Description |
|---|---|
| `GET /rt/latest` | Dernière mesure par rack — capteurs bruts + métriques calculées (polling 5s) |
| `GET /rt/history` | Série temporelle — params : `window=30m\|1h\|24h`, `technos=AC`, `mix_scenarios=Mix+Décarboné` |

### Mode what-if (sliders utilisateur)

| Route | Description |
|---|---|
| `POST /calculate` | Calcul comparatif à la demande — body : `{"p_it_kw": 50, "technos": ["AC","IC"], "mix_scenarios": [...]}` |
| `GET /history` | N derniers calculs utilisateur |
| `POST /stream-reco` | Recommandation IA streaming SSE — même body que `/calculate` |

### Référentiel et utilitaires

| Route | Description |
|---|---|
| `GET /referentiel` | Technos et mix disponibles — pour pré-remplir les sélecteurs front |
| `GET /health` | Healthcheck |
| `GET /docs` | Swagger — test interactif de toutes les routes |

## Topics Kafka

| Topic | Producteur | Consommateur |
|---|---|---|
| `sensors.raw` | `producer` (capteurs simulés) | `consumer` → `processed_rt` |
| `sensors.predicted` | service IA prédictive | `consumer` → `processed_predicted` |

## Payload capteur attendu (`sensors.raw`)

```json
{
  "timestamp": "2026-03-20T11:40:15Z",
  "rack_id": "Rack-01-IC",
  "techno": "IC",
  "p_it_kw": 47.3,
  "cpu_usage_percent": 35.0,
  "cpu_temp_c": 52.5,
  "ddr_temp_c": 45.0,
  "psu_temp_c": 38.0,
  "gpu_usage_percent": 80.0,
  "gpu_temp_c": 68.0,
  "hbm_temp_c": 55.0,
  "free_gpu_mem_percent": 15.0,
  "room_temp_c": 22.1,
  "source": "simulation"
}
```

## Tests

```bash
# Unitaires — pas de DB requise
docker compose exec backend python -m pytest tests/unit/

# Intégration — Docker doit tourner
docker compose exec backend python -m tests.integration.smoke_test

# Test manuel Kafka
docker compose exec kafka bash
echo '{"timestamp": "...", "rack_id": "Rack-01-AC", "techno": "AC", "p_it_kw": 12.88, ...}' \
  | kafka-console-producer --bootstrap-server localhost:9092 --topic sensors.raw
```

## Structure

```
services/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── calculator.py    # bloc métier — fonctions pures, zéro I/O
│   │   ├── main.py              # routes FastAPI
│   │   ├── init_db.py           # chargement référentiel au boot
│   │   └── kafka_consumer.py    # consumer Kafka → calculator → DB
│   └── tests/
│       ├── unit/                # pas de DB requis
│       └── integration/         # Docker requis
├── producer/                    # simulateur capteurs (à implémenter)
├── ai/                          # service IA — recommandation + prédiction (à implémenter)
├── frontend/                    # dashboard (à implémenter)
└── postgres/
    └── migrations/
        └── 001_init.sql         # schéma complet — 6 tables
```

## Tables DB

| Table | Type | Description |
|---|---|---|
| `referentiel_pue` | Statique | Constantes métier par techno (PUE, WUE, ERF, CAPEX...) |
| `mix_electrique` | Statique | Facteurs CO2e par mix électrique |
| `sensors_raw` | RT | Mesures brutes capteurs archivées |
| `processed_rt` | RT | Résultats calculator sur mesures réelles |
| `processed_predicted` | RT | Résultats calculator sur mesures prédites |
| `user_calculation` | On-demand | Calculs lancés depuis les sliders utilisateur |