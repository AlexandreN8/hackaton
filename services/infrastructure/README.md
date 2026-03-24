# 🚀 Infrastructure Monitoring - Grafana + Prometheus

Service dockerisé de monitoring complet pour ton application i-Cooling.

## 📊 Composants

### 1. **Prometheus** (Collecte des métriques)
- **Port**: 9090
- **URL**: `http://localhost:9090`
- **Rôle**: Scrape les métriques Kafka, Zookeeper, PostgreSQL, système
- **Retention**: 30 jours

### 2. **Grafana** (Dashboards)
- **Port**: 3000
- **URL**: `http://localhost:3000`
- **Login**: `admin` / `admin`
- **Rôle**: Visualisation des métriques en temps réel

### 3. **JMX Exporter** (Kafka & Zookeeper)
- **Kafka JMX Port**: 5556
- **Zookeeper JMX Port**: 5557
- **Rôle**: Expose les JMX metrics au format Prometheus

### 4. **Node Exporter** (Système)
- **Port**: 9100
- **Rôle**: Collecte CPU, mémoire, disque, réseau du système hôte

---

## 🚀 Lancer l'infrastructure

```bash
# Démarrer tous les services
docker-compose up -d

# Ou rebuild + démarrer
docker-compose up -d --build
```

**Temps de démarrage**: ~45 secondes (Prometheus et Grafana peuvent être lents à démarrer)

---

## 📈 Dashboards disponibles

### ✅ **Kafka Broker Monitoring**
Métriques brutes du broker Kafka :
- Messages in/out (messages/sec)
- Bytes in/out (volume)
- In-Sync Replicas (ISR)
- Request Latency (par type)
- Active Controllers

**URL**: Créé automatiquement dans Grafana (`http://localhost:3000`)

### ✅ **Kafka Health & Performance**
Vue complète de la santé Kafka :
- Throughput (5min avg)
- Latency by Request Type
- Under-replicated Partitions
- Active Controllers

---

## 🎯 Topics monitorés

| Topic | Métrique | Alerte |
|-------|---------|--------|
| `sensors.raw` | Messages/latence | ⚠️ Alerte si pas de données |
| `sensors.predicted` | Messages (optionnel) | ℹ️ Info si pas de prédictions |

---

## ⚠️ Alertes configurées

### Critiques 🔴
- ❌ **Kafka Broker Down** - Broker indisponible > 1 min
- ❌ **Zookeeper Down** - Zookeeper indisponible > 1 min
- ❌ **Controller Down** - Pas de contrôleur actif

### Warnings 🟡
- ⏱️ **High Latency** - Temps réponse > 1000ms pendant 5 min
- 🔄 **Under-replicated Partitions** - Partitions non répliquées > 5 min
- 📉 **Producer Errors** - Erreurs production détectées
- 🐢 **Consumer Lag** - Latence consommateur > 5s pendant 10 min
- 📊 **Throughput Drop** - Débit < 1 msg/sec pendant 5 min

---

## 🔗 Connexions automatiques

Prometheus scrape automatiquement :

```yaml
# Kafka
kafka-jmx:5556

# Zookeeper
zookeeper-jmx:5557

# Système
node-exporter:9100
```

**Configuré dans** : `services/infrastructure/prometheus/prometheus.yml`

---

## 🛠️ Accès aux services

| Service | URL | Port | Healthcheck |
|---------|-----|------|-------------|
| **Prometheus** | http://localhost:9090 | 9090 | ✅ Actif |
| **Grafana** | http://localhost:3000 | 3000 | ✅ Actif |
| **Kafka JMX** | http://localhost:5556 | 5556 | `-/metrics` |
| **Zookeeper JMX** | http://localhost:5557 | 5557 | `-/metrics` |
| **Node Exporter** | http://localhost:9100 | 9100 | ✅ Actif |
| **Kafka Broker** | localhost:9092 | 9092 | ✅ Actif |

---

## 📝 Configuration

### Ajouter une nouvelle source de données dans Prometheus

Édite `services/infrastructure/prometheus/prometheus.yml` :

```yaml
scrape_configs:
  - job_name: 'mon_service'
    static_configs:
      - targets: ['mon-service:9090']
    scrape_interval: 15s
```

Puis relance :
```bash
docker-compose restart prometheus
```

### Ajouter une nouvelle alerte

Édite `services/infrastructure/prometheus/alerts.yml` et ajoute une règle :

```yaml
- alert: MonAlerte
  expr: metric_name > 100
  for: 5m
  annotations:
    summary: "Description"
```

Puis relance :
```bash
docker-compose restart prometheus
```

---

## 📊 Métriques Kafka principales

### Performance
- `kafka_server_brokertopicmetrics_messages_in_total` - Messages reçus
- `kafka_network_requestmetrics_total_time_ms` - Latence requêtes
- `kafka_server_brokertopicmetrics_fetch_consumer_total_time_ms` - Latence fetch

### Santé
- `kafka_server_replicamanager_isr` - In-Sync Replicas
- `kafka_server_replicamanager_under_replicated_partitions` - Partitions sous-répliquées
- `kafka_controller_kafkacontroller_active_controllers` - Contrôleurs actifs

### Erreurs
- `kafka_server_brokertopicmetrics_failed_produce_total` - Erreurs production
- `up{job="kafka"}` - Status broker (1=UP, 0=DOWN)

---

## 🔍 Debug & Troubleshooting

### Vérifier la connexion Prometheus ↔ Kafka JMX

```bash
# Depuis le container prometheus
docker exec hackathon_prometheus wget -O- http://kafka-jmx:5556/metrics | head -20
```

### Voir les logs Grafana

```bash
docker logs hackathon_grafana | tail -50
```

### Vérifier Prometheus scrape targets

1. Ouvre Prometheus UI : http://localhost:9090
2. Va à `Status` → `Targets`
3. Vérifie que tous les jobs sont `UP`

### Reimporter un dashboard

1. Dans Grafana : `+` → `Import`
2. Colle le JSON du dashboard
3. Sélectionne la source Prometheus

---

## 📦 Structure

```
services/infrastructure/
├── prometheus/
│   ├── prometheus.yml              # Config scrape
│   ├── alerts.yml                  # Règles d'alertes
│   └── jmx_exporter_config.json    # Config JMX parsing
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml      # DataSource Prometheus
        └── dashboards/
            ├── kafka-dashboard.json        # Dashboard 1
            ├── kafka-health.json           # Dashboard 2
            └── dashboard-provider.yml      # Provisioning config
```

---

## 🎯 Prochaines étapes

### Ajouter PostgreSQL monitoring
```bash
# Déployer postgres_exporter
- job_name: 'postgres'
  static_configs:
    - targets: ['postgres-exporter:9187']
```

### Ajouter AlertManager (optionnel)
Pour envoyer les alertes par email/Slack

### Ajouter Loki (optionnel)
Pour les logs centralisés

---

## Besoin d'aide ?

- Prometheus docs: https://prometheus.io/docs/
- Grafana docs: https://grafana.com/docs/
- Kafka metrics: https://kafka.apache.org/documentation/#monitoring

---

**Crée par le Hackathon Cisco Team** 🚀
