# Hackathon Cisco — Comparatif IC vs AC

Comparatif objectivé des technologies de refroidissement datacenter IA.

## Stack

- **Backend** : FastAPI + PostgreSQL
- **Calcul** : bloc métier Python pur (calculator.py)
- **IA** : service Anthropic streaming
- **Frontend** : à venir

## Démarrage

```bash
cp .env.example .env
# remplir LLM_API_KEY dans .env
docker compose up --build
```

## Endpoints

| Route | Description |
|---|---|
| `GET /health` | Healthcheck |
| `GET /referentiel` | Technos et mix disponibles |
| `POST /calculate` | Lance un calcul comparatif |
| `GET /history` | Historique des calculs |
| `POST /stream-reco` | Recommandation IA en streaming |
| `/docs` | Swagger |

## Tests

```bash
# Unitaires
docker compose exec backend python -m pytest tests/unit/

# Intégration (Docker doit tourner)
docker compose exec backend python -m tests.integration.smoke_test
```

## Structure

```
services/
├── backend/
│   ├── app/
│   │   ├── core/calculator.py   # bloc métier — fonctions pures
│   │   ├── main.py              # routes FastAPI
│   │   └── init_db.py           # chargement initial DB
│   └── tests/
│       ├── unit/                # pas de DB requis
│       └── integration/         # Docker requis
├── ai/                          # service recommandation LLM
├── frontend/                    # dashboard (à venir)
└── postgres/migrations/         # schéma SQL
```
