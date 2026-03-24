# Infrastructure Monitoring Setup - Structure Complète

## 📁 Structure des fichiers créés

```
services/
├── infrastructure/                    # 🆕 Nouveau service
│   ├── README.md                      # Documentation détaillée
│   ├── prometheus/
│   │   ├── prometheus.yml             # Config scrape + alertes
│   │   ├── alerts.yml                 # 🔴 Règles d'alertes
│   │   └── jmx_exporter_config.json   # Config JMX parsing
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── prometheus.yml     # DataSource Prometheus
│           └── dashboards/
│               ├── kafka-dashboard.json       # Dashboard 1
│               ├── kafka-health.json          # Dashboard 2
│               └── dashboard-provider.yml     # Provisioning config
```

---

## 🐳 Services Docker Ajoutés

| Container | Image | Port | Role |
|-----------|-------|------|------|
| **prometheus** | prom/prometheus:latest | 9090 | Collecte métriques |
| **grafana** | grafana/grafana:latest | 3000 | Dashboards |
| **kafka-jmx** | sscaling/jmx-exporter:latest | 5556 | Kafka metrics → Prometheus |
| **zookeeper-jmx** | sscaling/jmx-exporter:latest | 5557 | Zookeeper metrics |
| **node-exporter** | prom/node-exporter:latest | 9100 | System metrics |

---

## 🔧 Modifications au docker-compose.yml

### 1. Kafka - Ajout JMX
```yaml
kafka:
  ports:
    - "9092:9092"
    - "9999:9999"  # 🆕 JMX port
  environment:
    KAFKA_JMX_PORT: 9999
    KAFKA_JMX_HOSTNAME: kafka
    KAFKA_JMX_OPTS: -Dcom.sun.management.jmxremote...
```

### 2. Volumes - Ajout data persistence
```yaml
volumes:
  postgres_data:
  prometheus_data:     # 🆕
  grafana_data:        # 🆕
```

---

## 📊 Flux de données

```
┌─────────────────────┐
│   KAFKA BROKER      │
│   (port 9092/9999)  │
└──────────┬──────────┘
           │ JMX metrics
           ↓
┌─────────────────────┐
│  JMX EXPORTER       │
│  (port 5556)        │
└──────────┬──────────┘
           │ :9090 format
           ↓
┌─────────────────────┐
│  PROMETHEUS         │
│  (port 9090)        │ ← Scrape every 10s
└──────────┬──────────┘
           │ Store data
           ↓
┌─────────────────────┐
│  GRAFANA            │
│  (port 3000)        │ ← Query & render
└─────────────────────┘
```

---

## 🚀 Lancer l'infrastructure

### Option 1: Démarrage standard
```bash
cd /path/to/hackaton
docker-compose up -d
```

### Option 2: Rebuild + démarrage
```bash
docker-compose up -d --build
```

### Option 3: Voir les logs en direct
```bash
docker-compose up
# Ctrl+C pour arrêter
```

---

## ✅ Vérifications après lancement

### 1. Vérifier les containers sont UP
```bash
docker-compose ps
# Tous les statuts doivent être "Up"
```

### 2. Vérifier Prometheus scrape Kafka
```bash
# Accéder à http://localhost:9090/targets
# "kafka" job doit être UP/green
```

### 3. Vérifier les dashboards Grafana
```bash
# Accéder à http://localhost:3000
# Login: admin / admin
# 2 dashboards doivent être visibles
```

### 4. Vérifier les métriques Kafka
```bash
docker exec hackathon_prometheus curl -s http://kafka-jmx:5556/metrics | grep kafka_server | head -5
```

---

## 📌 Endpoints clés

### Prometheus
- **Web UI**: http://localhost:9090
- **Targets**: http://localhost:9090/targets
- **Alerts**: http://localhost:9090/alerts
- **Query API**: http://localhost:9090/api/v1/query

### Grafana
- **Web UI**: http://localhost:3000
- **Login**: admin / admin
- **API**: http://localhost:3000/api/v1/

### Exporters
- **Kafka JMX**: http://localhost:5556/metrics
- **Zookeeper JMX**: http://localhost:5557/metrics
- **Node Exporter**: http://localhost:9100/metrics

---

## 🎯 Métriques clés par service

### Kafka (dans Prometheus)
```
kafka_server_brokertopicmetrics_messages_in_total
kafka_server_brokertopicmetrics_bytes_in_total
kafka_network_requestmetrics_total_time_ms
kafka_server_replicamanager_isr
kafka_server_replicamanager_under_replicated_partitions
kafka_controller_kafkacontroller_active_controllers
```

### Système (Node Exporter)
```
node_cpu_seconds_total
node_memory_MemAvailable_bytes
node_disk_io_now
node_network_interface_transmit_bytes_total
```

---

## 🔔 Alertes Configurées (10x)

| Alert | Severity | Trigger |
|-------|----------|---------|
| KafkaBrokerDown | 🔴 | up == 0 for 1m |
| KafkaHighLatency | 🟡 | latency > 1000ms for 5m |
| UnderReplicatedPartitions | 🟡 | count > 0 for 5m |
| KafkaProducerErrors | 🟡 | error_rate > 0 for 1m |
| ConsumerLag | 🟡 | fetch_time > 5s for 10m |
| ControllerDown | 🔴 | active != 1 for 1m |
| ZookeeperDown | 🔴 | up == 0 for 1m |
| ProducerThroughputDrop | 🟡 | throughput < 1 msg/s for 5m |
| sensors.raw Issues | 🟡 | errors \| latency > 2s |
| sensors.predicted Issues | ℹ️ | no data for 5m |

---

## 🔗 Intégrations possibles après setup

### 1. AlertManager (envoyer alertes par email/Slack)
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### 2. Loki (logs centralisés)
Ajouter container `loki` + `promtail` pour les logs

### 3. PostgreSQL Exporter
```yaml
- job_name: 'postgres'
  static_configs:
    - targets: ['postgres-exporter:9187']
```

### 4. Redis Exporter (si utilisé)
```yaml
- job_name: 'redis'
  static_configs:
    - targets: ['redis-exporter:9121']
```

---

## 🛠️ Commandes de maintenance

### Redémarrer l'infrastructure complète
```bash
docker-compose restart prometheus grafana kafka-jmx
```

### Vider les données Prometheus (reset)
```bash
docker-compose down
docker volume rm hackaton_prometheus_data
docker-compose up -d
```

### Voir l'historique complet des alertes
```bash
# Dans Prometheus UI → http://localhost:9090/alerts
# Toutes les alertes firing + resolved
```

### Importer un dashboard custom
1. Aller sur Grafana: http://localhost:3000/dashboard/new/import
2. Coller le JSON du dashboard
3. Sélectionner Prometheus comme datasource

---

## 📝 Configuration Grafana

### Login par défaut
- **Username**: admin
- **Password**: admin

### Changer le mot de passe
1. Cliquer sur l'avatar (coin haut droit)
2. Change password
3. Sauvegarder

### Ajouter une nouvelle datasource
1. Configuration → Data Sources
2. Add new datasource
3. Sélectionner Prometheus
4. URL: http://prometheus:9090
5. Save & Test

---

## 🐛 Troubleshooting

### Prometheus ne scrape pas Kafka
```bash
# Vérifier la connexion réseau
docker exec hackathon_prometheus ping kafka-jmx
docker exec hackathon_prometheus curl -v http://kafka-jmx:5556/metrics
```

### Grafana ne voit pas Prometheus
```bash
# Vérifier la datasource
curl -s http://localhost:3000/api/datasources
```

### Alertes ne se trigger pas
```bash
# Vérifier prometheus.yml syntaxe
docker exec hackathon_prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Out of memory
Augmenter `prometheus_data` volume et/ou reducer retention time dans docker-compose.yml

---

## 📊 Données sauvegardées

- **Prometheus**: 30 jours d'historique (configurable)
- **Grafana**: Configuration + dashboards (volumes)
- **Kafka JMX**: Live metrics (pas de persisted)

---

## 🎯 Prochaines étapes

- [ ] Setup AlertManager pour notifications
- [ ] Créer des dashboards métier (coût, CO2)
- [ ] Intégrer PostgreSQL metrics
- [ ] Setup backup automatique des configurations
- [ ] Ajouter authentification LDAP/OAuth

---

**Service créé pour le Hackathon Cisco** 🚀
