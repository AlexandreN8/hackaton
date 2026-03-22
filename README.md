# i-Cooling - Hackathon Cisco

Comparatif objectivé des technologies de refroidissement datacenter IA (AC, IC, RDHx, DLC) avec données capteurs en temps réel, score composite configurable et recommandation IA.

## Stack

- **Backend** : FastAPI + PostgreSQL
- **Broker** : Kafka + Zookeeper
- **Calcul** : bloc métier Python pur (`calculator.py`) - fonctions pures, zéro I/O
- **Frontend** : React + Vite + Chart.js - dashboard responsive mobile/desktop
- **IA** : service recommandation LLM & prédiction (à implémenter)

## Démarrage

```bash
cp .env.example .env
docker compose up --build
```

Le service `init` charge automatiquement le référentiel (4 technos, 6 mix électriques) au démarrage.

## Endpoints

### Temps réel (données capteurs Kafka)

| Route | Description |
|---|---|
| `GET /rt/latest` | Dernière mesure par rack - capteurs bruts + métriques calculées |
| `GET /rt/history` | Série temporelle - params : `window=30m\|1h\|24h`, `technos=AC`, `mix_scenarios=...` |

### Simulateur (mode what-if)

| Route | Description |
|---|---|
| `POST /calculate` | Calcul comparatif - body : `{"p_it_kw": 50, "technos": ["AC","IC"], "prix_kwh": 0.15}` |
| `GET /history` | N derniers calculs utilisateur |
| `POST /stream-reco` | Recommandation IA streaming SSE |

### Référentiel et utilitaires

| Route | Description |
|---|---|
| `GET /referentiel` | Technos et mix disponibles |
| `GET /health` | Healthcheck |
| `GET /docs` | Swagger |

## Topics Kafka

| Topic | Producteur | Consommateur |
|---|---|---|
| `sensors.raw` | `producer` (dataset simulé) | `consumer` → `processed_rt` |
| `sensors.predicted` | service IA prédictive | `consumer` → `processed_predicted` |

## Payload capteur (`sensors.raw`)

```json
{
  "timestamp": "2026-03-20T11:40:15Z",
  "rack_id": "Rack-01-AC",
  "techno": "AC",
  "p_it_kw": 12.88,
  "cpu_usage_percent": 7.2,
  "cpu_temp_c": 44.0,
  "ddr_temp_c": 25.3,
  "psu_temp_c": 42.2,
  "gpu_usage_percent": 1.8,
  "gpu_temp_c": 54.6,
  "hbm_temp_c": 51.5,
  "free_gpu_mem_percent": 91.0,
  "room_temp_c": 24.0,
  "source": "simulation_dataset"
}
```

> Les 4 racks tournent le **même workload simultanément** - règle de comparaison obligatoire du sujet. Les températures diffèrent selon la techno de refroidissement.

## Dataset

Générer le dataset de simulation (modèle physique réaliste) :

```bash
cd data
python genset_sync.py
# → écrit data/dataset_ia_72h_sync.jsonl (72h à 2s/mesure × 4 racks)
```

Modèle physique :
- `p_it_kw = baseline + P_cpu_max × cpu% + P_gpu_max × gpu%`
- Inertie thermique du 1er ordre par composant et techno (τ_gpu AC=120s, IC=60s)
- Machine à états partagée idle/training - transitions progressives (~4 min idle, ~10 min training)

## Tests

```bash
# Unitaires
docker compose exec backend python -m pytest tests/unit/

# Intégration
docker compose exec backend python -m tests.integration.smoke_test

# Test manuel Kafka
docker compose exec kafka bash
echo '{"timestamp":"2026-03-20T12:00:00Z","rack_id":"Rack-01-AC","techno":"AC","p_it_kw":12.88,...}' \
  | kafka-console-producer --bootstrap-server localhost:9092 --topic sensors.raw
```

## Structure

```
services/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── calculator.py      # bloc métier - fonctions pures, zéro I/O
│   │   ├── main.py                # routes FastAPI
│   │   ├── init_db.py             # chargement référentiel au boot
│   │   └── kafka_consumer.py      # consumer Kafka → calculator → DB
│   └── tests/
│       ├── unit/
│       └── integration/
├── producer/
│   └── app/
│       ├── producer.py            # lit dataset.jsonl → Kafka
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # orchestrateur - 3 onglets
│   │   ├── components/
│   │   │   ├── SimPage.jsx        # simulateur what-if
│   │   │   ├── RTPage.jsx         # temps réel + drawer historique
│   │   │   ├── TechnoCards.jsx    # cards résultats par techno
│   │   │   ├── Charts.jsx         # énergie, CO2e, ROI
│   │   │   ├── ScoreChart.jsx     # score composite configurable
│   │   │   ├── RTTable.jsx        # tableau comparatif RT
│   │   │   ├── MetricDrawer.jsx   # drawer historique + formules
│   │   │   ├── AIReco.jsx         # recommandation IA SSE
│   │   │   ├── HistPage.jsx       # historique simulations
│   │   │   └── Topbar.jsx         # navigation + hamburger mobile
│   │   ├── hooks/
│   │   │   └── useApi.js          # hooks API + historique RT persisté
│   │   └── constants.js           # couleurs, helpers
│   ├── Dockerfile                 # multi-stage node build → nginx
│   └── nginx.conf                 # proxy /api → backend
├── ai/                            # service IA (à implémenter)
└── postgres/
    └── migrations/
        └── 001_init.sql           # schéma complet - 6 tables
```

## Tables DB

| Table | Type | Description |
|---|---|---|
| `referentiel_pue` | Statique | Constantes métier par techno (PUE, WUE, ERF, CAPEX...) |
| `mix_electrique` | Statique | Facteurs CO₂e par mix électrique (6 scénarios) |
| `sensors_raw` | RT | Mesures brutes capteurs archivées |
| `processed_rt` | RT | Résultats calculator sur mesures réelles (4 technos × 6 mix par message) |
| `processed_predicted` | RT | Résultats calculator sur mesures prédites |
| `user_calculation` | On-demand | Calculs lancés depuis le simulateur |

## Dashboard - fonctionnalités

### Onglet Simulateur
- Paramètres : charge IT (kW), mix électrique, technologies à comparer
- Cards comparatives par techno avec delta % vs AC
- Bar chart énergie par poste (IT / Refroidissement / Overhead)
- Bar chart CO₂e × 6 mix électriques
- Courbe ROI payback cumulé sur 10 ans
- **Score composite configurable** - 4 profils (Environnemental, Économique, Zone sèche, Haute densité) + mode personnalisé avec poids ajustables
- Périmètre & hypothèses sourcés (ASHRAE, GHG Protocol, Uptime Institute)
- Recommandation IA streaming SSE

### Onglet Temps Réel
- KPI cards par rack avec courbe p_it_kw intégrée (historique ~2 min)
- Tableau comparatif live - métriques capteurs + PUE/WUE/ERF calculés
- **Drawer au clic** sur une métrique - courbe historique plein format + stats min/max/moy + formule sourcée
- Historique persisté en DB - résiste aux refreshs de page

### Onglet Historique
- Liste des N dernières simulations utilisateur