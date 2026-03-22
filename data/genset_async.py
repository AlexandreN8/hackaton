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
    → écrit data/dataset_ia_72h_async.jsonl 
"""

import json
import math
import random
import os
from datetime import datetime, timedelta, timezone

# Configuration 
FILE_NAME         = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "./dataset_ia_72h_async.jsonl")
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
def init_state(rack):
    p = PROFILES[rack["techno"]]
    return {
        # Mode courant
        "mode":           "idle",
        "mode_steps":     random.randint(0, 48),   # phase aléatoire au départ
        "transition":     False,                    # en cours de transition ?

        # Usages courants (%)
        "cpu_usage":  random.uniform(5.0, 15.0),
        "gpu_usage":  random.uniform(0.0,  5.0),
        "free_gpu":   random.uniform(85.0, 99.0),

        # Températures courantes
        "cpu_temp":   p["cpu_temp_idle"] + random.uniform(-2, 2),
        "gpu_temp":   p["gpu_temp_idle"] + random.uniform(-2, 2),
        "ddr_temp":   p["cpu_temp_idle"] + p["ddr_offset"] + random.uniform(-1, 1),
        "psu_temp":   p["psu_temp_idle"] + random.uniform(-2, 2),
    }


def thermal_step(current, target, tau, noise_std=0.15):
    """
    Modèle thermique du 1er ordre :
    T(t+dt) = T(t) + (T_target - T(t)) * (dt/tau) + bruit
    tau en steps. Plus tau est grand, plus la réaction est lente.
    """
    alpha = 1.0 / tau
    return current + (target - current) * alpha + random.gauss(0, noise_std)


def compute_record(state, rack, room_temp, step):
    p  = PROFILES[rack["techno"]]
    dt = INTERVAL_SECONDS

    # Transitions de mode 
    state["mode_steps"] += 1

    if state["mode"] == "idle" and not state["transition"]:
        # Toutes les ~4 min en moyenne : démarrage training
        prob = 1 - math.exp(-dt / (4 * 60))
        if random.random() < prob:
            state["transition"] = True
            state["mode"] = "training"
            state["mode_steps"] = 0

    elif state["mode"] == "training" and state["mode_steps"] > 120:
        # Après ~10 min minimum : retour idle
        prob = 1 - math.exp(-dt / (8 * 60))
        if random.random() < prob:
            state["transition"] = True
            state["mode"] = "idle"
            state["mode_steps"] = 0

    is_training = state["mode"] == "training"

    # Cibles d'usage selon le mode 
    if is_training:
        target_cpu_usage = random.gauss(72.0, 5.0)
        target_gpu_usage = random.gauss(95.0, 2.0)
        target_free_gpu  = random.gauss(8.0,  2.0)
    else:
        target_cpu_usage = random.gauss(10.0, 3.0)
        target_gpu_usage = random.gauss(2.0,  1.5)
        target_free_gpu  = random.gauss(92.0, 2.0)

    # Interpolation usage (tau court — électronique réagit vite)
    state["cpu_usage"] = thermal_step(state["cpu_usage"], target_cpu_usage, tau=6,  noise_std=0.8)
    state["gpu_usage"] = thermal_step(state["gpu_usage"], target_gpu_usage, tau=8,  noise_std=0.5)
    state["free_gpu"]  = thermal_step(state["free_gpu"],  target_free_gpu,  tau=8,  noise_std=0.3)

    # Clamp usages
    cpu = max(0.0, min(100.0, state["cpu_usage"]))
    gpu = max(0.0, min(100.0, state["gpu_usage"]))
    fgm = max(0.0, min(100.0, state["free_gpu"]))

    # Puissance IT dérivée des usages (modèle physique) 
    # P = baseline + P_cpu_max * cpu_frac + P_gpu_max * gpu_frac
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
    state["cpu_temp"] = thermal_step(state["cpu_temp"], cpu_target, p["tau_cpu"], noise_std=0.15)
    state["gpu_temp"] = thermal_step(state["gpu_temp"], gpu_target, p["tau_gpu"], noise_std=0.15)
    state["psu_temp"] = thermal_step(state["psu_temp"], psu_target, p["tau_psu"], noise_std=0.10)

    # DDR corrélée au CPU avec offset
    ddr_target = state["cpu_temp"] + p["ddr_offset"]
    state["ddr_temp"] = thermal_step(state["ddr_temp"], ddr_target, p["tau_ddr"], noise_std=p["ddr_noise"])

    # HBM corrélée au GPU
    hbm_temp = state["gpu_temp"] + p["hbm_offset"] + random.gauss(0, p["hbm_noise"])

    return {
        "timestamp":            "",   # rempli à l'extérieur
        "rack_id":              rack["id"],
        "techno":               rack["techno"],
        "p_it_kw":              p_it_kw,
        "cpu_usage_percent":    round(cpu, 1),
        "cpu_temp_c":           round(state["cpu_temp"], 1),
        "ddr_temp_c":           round(state["ddr_temp"], 1),
        "psu_temp_c":           round(state["psu_temp"], 1),
        "gpu_usage_percent":    round(gpu, 1),
        "gpu_temp_c":           round(state["gpu_temp"], 1),
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
    states       = {r["id"]: init_state(r) for r in RACKS}

    print(f"Génération du dataset — modèle physique réaliste")
    print(f"  Durée      : {HOURS_TO_GENERATE}h | Intervalle : {INTERVAL_SECONDS}s")
    print(f"  Racks      : {len(RACKS)} ({', '.join(r['techno'] for r in RACKS)})")
    print(f"  Total      : {total_steps * len(RACKS):,} lignes")
    print(f"  Destination: {out_path}\n")

    with open(out_path, "w", encoding="utf-8") as f:
        for step in range(total_steps):
            # Room temp — marche aléatoire lente avec mean-reversion vers 24°C
            room_temp += random.gauss(0, 0.03) + (24.0 - room_temp) * 0.001
            room_temp  = max(20.0, min(28.0, room_temp))

            ts = current_time.isoformat().replace("+00:00", "Z")

            for rack in RACKS:
                record = compute_record(states[rack["id"]], rack, room_temp, step)
                record["timestamp"] = ts
                f.write(json.dumps(record) + "\n")

            current_time += timedelta(seconds=INTERVAL_SECONDS)

            if (step + 1) % 10000 == 0:
                pct = (step + 1) / total_steps * 100
                # Affiche un exemple de valeurs pour vérification
                sample = states[RACKS[3]["id"]]  # IC
                print(
                    f"  {pct:5.1f}% | step {step+1:>6}/{total_steps} | "
                    f"IC: mode={sample['mode']:<8} "
                    f"gpu={sample['gpu_usage']:5.1f}% "
                    f"gpu_temp={sample['gpu_temp']:5.1f}°C "
                    f"p_it~={(sample['gpu_usage']/100*33+sample['cpu_usage']/100*7.5+1.5):.1f}kW"
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