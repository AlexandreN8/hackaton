# Producer simulateur de capteurs.
# Lit le dataset JSONL ligne par ligne et envoie chaque message
# dans le topic sensors.raw avec un délai de SEND_INTERVAL secondes.
# Quand le fichier est épuisé, repart du début en boucle.

import os
import json
import time
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

KAFKA_BOOTSTRAP  = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
TOPIC_RAW        = "sensors.raw"
DATASET_PATH     = os.getenv("DATASET_PATH", "/dataset.jsonl")
SEND_INTERVAL    = float(os.getenv("SEND_INTERVAL", "5"))


def connect(retries=15, delay=3):
    for i in range(retries):
        try:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            print(f"Producer connecté à Kafka ({KAFKA_BOOTSTRAP})")
            return producer
        except NoBrokersAvailable:
            print(f"Kafka pas prêt, retry {i+1}/{retries}...")
            time.sleep(delay)
    raise RuntimeError("Impossible de se connecter à Kafka.")


def run():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset introuvable : {DATASET_PATH}")

    producer = connect()
    sent     = 0
    loop     = 0

    print(f"Lecture de {DATASET_PATH} → topic '{TOPIC_RAW}' (intervalle: {SEND_INTERVAL}s)\n")

    while True:
        loop += 1
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            batch     = []
            last_ts   = None

            for line in f:
                line = line.strip()
                if not line:
                    continue

                msg = json.loads(line)
                ts  = msg.get("timestamp")

                # Envoie le batch quand on change de timestamp (nouveau cycle de 4 racks)
                if last_ts is not None and ts != last_ts:
                    for m in batch:
                        producer.send(TOPIC_RAW, m)
                    producer.flush()
                    sent += len(batch)

                    if sent % 100 == 0:
                        print(f"  {sent} messages envoyés (boucle {loop})")

                    time.sleep(SEND_INTERVAL)
                    batch = []

                batch.append(msg)
                last_ts = ts

            # Dernier batch
            if batch:
                for m in batch:
                    producer.send(TOPIC_RAW, m)
                producer.flush()
                sent += len(batch)

        print(f"  Fin de boucle {loop} — {sent} messages envoyés au total. Reprise...")


if __name__ == "__main__":
    run()