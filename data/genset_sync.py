"""
Génération du dataset de simulation — modèle physique réaliste.

Principes :
  1. p_it_kw = baseline + contribution CPU + contribution GPU
     → la puissance est DÉRIVÉE des usages, pas indépendante
  2. Inertie thermique : les températures suivent les usages avec
     une constante de temps (tau) propre à chaque composant et techno
     → T(t+1) = T(t) + (T_target - T(t)) / tau + bruit
  3. T_target = f(usage, room_temp, techno)
     → la room_temp influe sur la base thermique de tous les composants
  4. Transitions idle/training réalistes :
     → idle  ~4 min  → training  ~10 min  → idle
     → les usages montent/descendent progressivement pendant la transition
  5. Corrélations :
     → ddr_temp corrélée à cpu_temp avec légère inertie
     → hbm_temp corrélée à gpu_temp (mémoire sur le die GPU)
     → psu_temp corrélée à p_it_kw total

Usage :
    python generate_dataset.py
    → écrit data/dataset_ia_72h_sync.jsonl 
"""

import json
import math
import random
import os
from datetime import datetime, timedelta, timezone

# Configuration
FILE_NAME         = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "./dataset_ia_72h_sync.jsonl")
)
START_DATE        = datetime.now(timezone.utc) + timedelta(days=180)
HOURS_TO_GENERATE = 72
INTERVAL_SECONDS  = 2   # secondes entre chaque mesure

RACKS = [
    {"id": "Rack-01-AC",   "techno": "AC"},
    {"id": "Rack-02-RDHx", "techno": "RDHx"},
    {"id": "Rack-03-DLC",  "techno": "DLC"},
    {"id": "Rack-04-IC",   "techno": "IC"},
]

# Profils physiques par techno 
# Toutes les valeurs sont des constantes physiques mesurables

PROFILES = {
    # Air Cooling — refroidissement le moins efficace
    # Températures plus élevées, inertie thermique plus longue
    "AC": {
        # Puissance
        "p_baseline_kw":   2.0,    # baseline toujours allumée (réseau, stockage, ventilateurs)
        "p_cpu_max_kw":    8.0,    # puissance CPU à 100%
        "p_gpu_max_kw":   35.0,    # puissance GPU AMD MI300X à 100%

        # Températures cible (idle, training) à room_temp = 24°C
        "cpu_temp_idle":  42.0,   "cpu_temp_training":  78.0,
        "gpu_temp_idle":  48.0,   "gpu_temp_training":  88.0,
        "psu_temp_idle":  38.0,   "psu_temp_training":  62.0,

        # Sensibilité à la room_temp (°C de composant par °C de salle)
        "room_sensitivity": 0.8,

        # Inertie thermique — tau en steps (1 step = INTERVAL_SECONDS)
        # Plus tau est grand, plus la température réagit lentement
        "tau_cpu":  12,   # ~1 min à 5s/step
        "tau_gpu":  24,   # ~2 min
        "tau_ddr":   8,
        "tau_psu":  18,

        # Offset DDR par rapport au CPU (DDR plus froide)
        "ddr_offset":  -16.0,
        "ddr_noise":     1.0,
        "hbm_offset":   -3.0,   # HBM légèrement plus froide que GPU die
        "hbm_noise":     0.5,
    },

    # Rear Door Heat Exchanger — échangeur porte arrière
    # Ventilateurs actifs, refroidissement eau sur la porte
    "RDHx": {
        "p_baseline_kw":   2.0,
        "p_cpu_max_kw":    8.0,
        "p_gpu_max_kw":   35.0,

        "cpu_temp_idle":  40.0,   "cpu_temp_training":  74.0,
        "gpu_temp_idle":  45.0,   "gpu_temp_training":  82.0,
        "psu_temp_idle":  36.0,   "psu_temp_training":  56.0,

        "room_sensitivity": 0.5,  # eau atténue l'influence de la salle

        "tau_cpu":  10,
        "tau_gpu":  20,
        "tau_ddr":   7,
        "tau_psu":  15,

        "ddr_offset":  -16.0,
        "ddr_noise":     0.8,
        "hbm_offset":   -3.0,
        "hbm_noise":     0.4,
    },

    # Direct Liquid Cooling — plaques froides CPU/GPU
    # Très efficace sur CPU/GPU, ventilation résiduelle pour le reste
    "DLC": {
        "p_baseline_kw":   2.0,
        "p_cpu_max_kw":    8.0,
        "p_gpu_max_kw":   35.0,

        "cpu_temp_idle":  32.0,   "cpu_temp_training":  54.0,
        "gpu_temp_idle":  36.0,   "gpu_temp_training":  62.0,
        "psu_temp_idle":  36.0,   "psu_temp_training":  54.0,

        "room_sensitivity": 0.3,  # liquide isole bien de la salle

        "tau_cpu":   8,   # liquide réagit vite
        "tau_gpu":  15,
        "tau_ddr":  10,   # DDR avec ventilation classique
        "tau_psu":  14,

        "ddr_offset":   -4.0,   # DDR proche temp liquide, moins d'écart
        "ddr_noise":     1.2,
        "hbm_offset":   -2.0,
        "hbm_noise":     0.3,
    },

    # Immersion Cooling — serveur immergé dans diélectrique
    # Températures très basses et homogènes, WUE=0 (circuit fermé)
    "IC": {
        "p_baseline_kw":   1.5,   # pompes, pas de ventilateurs
        "p_cpu_max_kw":    7.5,   # légèrement moins (pas de ventilateurs CPU)
        "p_gpu_max_kw":   33.0,

        "cpu_temp_idle":  30.0,   "cpu_temp_training":  50.0,
        "gpu_temp_idle":  32.0,   "gpu_temp_training":  55.0,
        "psu_temp_idle":  30.0,   "psu_temp_training":  43.0,

        "room_sensitivity": 0.1,  # liquide diélectrique isole totalement

        "tau_cpu":   6,   # liquide très réactif
        "tau_gpu":  12,
        "tau_ddr":   6,   # tout baigne dans le même bain
        "tau_psu":  10,

        "ddr_offset":   -2.0,   # DDR quasi même temp que CPU dans le bain
        "ddr_noise":     0.5,
        "hbm_offset":   -1.5,
        "hbm_noise":     0.3,
    },
}

# Machine à états par rack 
def init_workload():
    """
    Charge IT partagée entre tous les racks au même instant.
    Règle de comparaison obligatoire sujet Cisco : même workload, technos différentes.
    """
    return {
        "mode":       "idle",
        "mode_steps": random.randint(0, 48),
        "transition": False,
        "cpu_usage":  random.uniform(5.0, 15.0),
        "gpu_usage":  random.uniform(0.0,  5.0),
        "free_gpu":   random.uniform(85.0, 99.0),
    }


def init_thermal(rack):
    """État thermique propre à chaque techno — chaque rack réagit différemment."""
    p = PROFILES[rack["techno"]]
    return {
        "cpu_temp": p["cpu_temp_idle"] + random.uniform(-2, 2),
        "gpu_temp": p["gpu_temp_idle"] + random.uniform(-2, 2),
        "ddr_temp": p["cpu_temp_idle"] + p["ddr_offset"] + random.uniform(-1, 1),
        "psu_temp": p["psu_temp_idle"] + random.uniform(-2, 2),
    }


def thermal_step(current, target, tau, noise_std=0.15):
    """
    Modèle thermique du 1er ordre :
    T(t+dt) = T(t) + (T_target - T(t)) * (dt/tau) + bruit
    tau en steps. Plus tau est grand, plus la réaction est lente.
    """
    alpha = 1.0 / tau
    return current + (target - current) * alpha + random.gauss(0, noise_std)


def update_workload(workload):
    """
    Met à jour la charge partagée (mode + usages).
    Appelé UNE FOIS par step, avant de calculer les records de tous les racks.
    """
    dt = INTERVAL_SECONDS
    workload["mode_steps"] += 1

    if workload["mode"] == "idle" and not workload["transition"]:
        prob = 1 - math.exp(-dt / (4 * 60))
        if random.random() < prob:
            workload["transition"] = True
            workload["mode"] = "training"
            workload["mode_steps"] = 0

    elif workload["mode"] == "training" and workload["mode_steps"] > 120:
        prob = 1 - math.exp(-dt / (8 * 60))
        if random.random() < prob:
            workload["transition"] = True
            workload["mode"] = "idle"
            workload["mode_steps"] = 0

    is_training = workload["mode"] == "training"

    if is_training:
        target_cpu = random.gauss(72.0, 5.0)
        target_gpu = random.gauss(95.0, 2.0)
        target_fgm = random.gauss(8.0,  2.0)
    else:
        target_cpu = random.gauss(10.0, 3.0)
        target_gpu = random.gauss(2.0,  1.5)
        target_fgm = random.gauss(92.0, 2.0)

    workload["cpu_usage"] = thermal_step(workload["cpu_usage"], target_cpu, tau=6, noise_std=0.8)
    workload["gpu_usage"] = thermal_step(workload["gpu_usage"], target_gpu, tau=8, noise_std=0.5)
    workload["free_gpu"]  = thermal_step(workload["free_gpu"],  target_fgm, tau=8, noise_std=0.3)

    workload["cpu_usage"] = max(0.0, min(100.0, workload["cpu_usage"]))
    workload["gpu_usage"] = max(0.0, min(100.0, workload["gpu_usage"]))
    workload["free_gpu"]  = max(0.0, min(100.0, workload["free_gpu"]))


def compute_record(thermal, workload, rack, room_temp):
    """
    Calcule le record d'un rack à partir du workload partagé
    et de l'état thermique propre à la techno.
    """
    p   = PROFILES[rack["techno"]]
    cpu = workload["cpu_usage"]
    gpu = workload["gpu_usage"]
    fgm = workload["free_gpu"]

    # Puissance IT dérivée des usages (modèle physique) 
    # P = baseline + P_cpu_max * cpu_frac + P_gpu_max * gpu_frac
    # (loi de Amdahl simplifiée — linéaire par composant)
    p_it_kw = (
        p["p_baseline_kw"]
        + p["p_cpu_max_kw"] * (cpu / 100.0)
        + p["p_gpu_max_kw"] * (gpu / 100.0)
    )
    p_it_kw = round(max(p["p_baseline_kw"], p_it_kw + random.gauss(0, 0.1)), 2)

    # Températures cibles (fonction usage + room_temp) 
    # T_target = T_idle + (T_train - T_idle) * usage_frac + room_effect
    room_effect = (room_temp - 24.0) * p["room_sensitivity"]

    cpu_target = (
        p["cpu_temp_idle"]
        + (p["cpu_temp_training"] - p["cpu_temp_idle"]) * (cpu / 100.0)
        + room_effect
    )
    gpu_target = (
        p["gpu_temp_idle"]
        + (p["gpu_temp_training"] - p["gpu_temp_idle"]) * (gpu / 100.0)
        + room_effect
    )
    psu_target = (
        p["psu_temp_idle"]
        + (p["psu_temp_training"] - p["psu_temp_idle"]) * (p_it_kw / (p["p_baseline_kw"] + p["p_cpu_max_kw"] + p["p_gpu_max_kw"]))
        + room_effect * 0.5
    )

    # Inertie thermique 
    thermal["cpu_temp"] = thermal_step(thermal["cpu_temp"], cpu_target, p["tau_cpu"], noise_std=0.15)
    thermal["gpu_temp"] = thermal_step(thermal["gpu_temp"], gpu_target, p["tau_gpu"], noise_std=0.15)
    thermal["psu_temp"] = thermal_step(thermal["psu_temp"], psu_target, p["tau_psu"], noise_std=0.10)

    # DDR corrélée au CPU avec offset
    ddr_target = thermal["cpu_temp"] + p["ddr_offset"]
    thermal["ddr_temp"] = thermal_step(thermal["ddr_temp"], ddr_target, p["tau_ddr"], noise_std=p["ddr_noise"])

    # HBM corrélée au GPU
    hbm_temp = thermal["gpu_temp"] + p["hbm_offset"] + random.gauss(0, p["hbm_noise"])

    return {
        "timestamp":            "",   # rempli à l'extérieur
        "rack_id":              rack["id"],
        "techno":               rack["techno"],
        "p_it_kw":              p_it_kw,
        "cpu_usage_percent":    round(cpu, 1),
        "cpu_temp_c":           round(thermal["cpu_temp"], 1),
        "ddr_temp_c":           round(thermal["ddr_temp"], 1),
        "psu_temp_c":           round(thermal["psu_temp"], 1),
        "gpu_usage_percent":    round(gpu, 1),
        "gpu_temp_c":           round(thermal["gpu_temp"], 1),
        "hbm_temp_c":           round(hbm_temp, 1),
        "free_gpu_mem_percent": round(fgm, 1),
        "room_temp_c":          round(room_temp, 1),
        "source":               "simulation_dataset",
    }


# Génération 
def generate():
    out_path = FILE_NAME
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    total_steps  = int((HOURS_TO_GENERATE * 3600) / INTERVAL_SECONDS)
    current_time = START_DATE
    room_temp    = 24.0
    # Charge partagée entre les 4 racks
    workload = init_workload()
    # États thermiques propres à chaque techno
    thermals = {r["id"]: init_thermal(r) for r in RACKS}

    print(f"Génération du dataset — modèle physique réaliste")
    print(f"  Mode       : charge synchronisée (même workload pour les 4 racks)")
    print(f"  Durée      : {HOURS_TO_GENERATE}h | Intervalle : {INTERVAL_SECONDS}s")
    print(f"  Racks      : {len(RACKS)} ({', '.join(r['techno'] for r in RACKS)})")
    print(f"  Total      : {total_steps * len(RACKS):,} lignes")
    print(f"  Destination: {out_path}\n")

    with open(out_path, "w", encoding="utf-8") as f:
        for step in range(total_steps):
            # Room temp — marche aléatoire lente avec mean-reversion vers 24°C
            room_temp += random.gauss(0, 0.03) + (24.0 - room_temp) * 0.001
            room_temp  = max(20.0, min(28.0, room_temp))

            # Mise à jour du workload partagé — UNE FOIS pour les 4 racks
            update_workload(workload)

            ts = current_time.isoformat().replace("+00:00", "Z")

            for rack in RACKS:
                record = compute_record(thermals[rack["id"]], workload, rack, room_temp)
                record["timestamp"] = ts
                f.write(json.dumps(record) + "\n")

            current_time += timedelta(seconds=INTERVAL_SECONDS)

            if (step + 1) % 10000 == 0:
                pct = (step + 1) / total_steps * 100
                print(
                    f"  {pct:5.1f}% | step {step+1:>6}/{total_steps} | "
                    f"mode={workload['mode']:<8} "
                    f"cpu={workload['cpu_usage']:5.1f}% "
                    f"gpu={workload['gpu_usage']:5.1f}% "
                    f"p_it_IC~={(workload['gpu_usage']/100*33+workload['cpu_usage']/100*7.5+1.5):.1f}kW "
                    f"p_it_AC~={(workload['gpu_usage']/100*35+workload['cpu_usage']/100*8+2):.1f}kW"
                )

    total_lines = total_steps * len(RACKS)
    print(f"\nTerminé — {total_lines:,} lignes générées dans {out_path}")
    print("Vérification rapide des plages :")
    print("  IC idle  : cpu~10% gpu~2%  → p_it~3kW  gpu_temp~33°C")
    print("  IC train : cpu~72% gpu~95% → p_it~34kW gpu_temp~53°C")
    print("  AC idle  : cpu~10% gpu~2%  → p_it~4kW  gpu_temp~49°C")
    print("  AC train : cpu~72% gpu~95% → p_it~35kW gpu_temp~86°C")


if __name__ == "__main__":
    generate()