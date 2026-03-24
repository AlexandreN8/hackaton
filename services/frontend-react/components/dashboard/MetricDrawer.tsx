"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// --- Métadonnées exactes du collègue ---
const METRIC_META: Record<string, any> = {
  p_it_kw: {
    formule: "P_it = P_baseline + P_cpu_max × cpu% + P_gpu_max × gpu%",
    source: "Modèle physique — loi de consommation linéaire par composant",
    unite: "kW",
    note: "La puissance IT est dérivée des usages mesurés, pas estimée directement.",
  },
  cpu_usage_percent: {
    formule: "Mesure directe — capteur IPMI / BMC",
    source: "Intel RAPL / AMD μProf",
    unite: "%",
    note: "Moyenne sur tous les cœurs physiques du socket.",
  },
  cpu_temp_c: {
    formule: "T_cpu(t+dt) = T_cpu(t) + (T_target - T_cpu(t)) / τ_cpu + ε",
    source:
      "Modèle thermique 1er ordre — τ_cpu selon techno (AC: 60s, IC: 30s)",
    unite: "°C",
    note: "T_target = T_idle + (T_train - T_idle) × cpu% + sensibilité × ΔT_salle",
  },
  gpu_usage_percent: {
    formule: "Mesure directe — capteur GPU (AMD MI300X / Nvidia)",
    source: "ROCm SMI / NVML",
    unite: "%",
    note: "Utilisation des SM (Streaming Multiprocessors) du GPU.",
  },
  gpu_temp_c: {
    formule: "T_gpu(t+dt) = T_gpu(t) + (T_target - T_gpu(t)) / τ_gpu + ε",
    source:
      "Modèle thermique 1er ordre — τ_gpu selon techno (AC: 120s, IC: 60s)",
    unite: "°C",
    note: "Inertie thermique plus longue que CPU — die GPU plus massif.",
  },
  hbm_temp_c: {
    formule: "T_hbm = T_gpu + offset_hbm + ε",
    source: "AMD MI300X spec — HBM stack intégré sur le die",
    unite: "°C",
    note: "La mémoire HBM est physiquement collée au die GPU (offset ≈ -2°C).",
  },
  room_temp_c: {
    formule: "T_salle(t+dt) = T_salle(t) + N(0, 0.03) + (24 - T_salle) × 0.001",
    source: "Capteur température ambiante — ASHRAE TC9.9",
    unite: "°C",
    note: "Mean-reversion vers 24°C (consigne ASHRAE A1). Plage opérationnelle 20–28°C.",
  },
  iteesv: {
    formule: "ITEEsv = (cpu_usage + gpu_usage) / 2 / P_it_kw",
    source: "ISO/IEC 30134-6 — IT Equipment Energy Efficiency for Servers",
    unite: "perf/W",
    note: "Plus ITEEsv est élevé, plus le serveur est efficace énergétiquement.",
  },
};

const TC: Record<string, string> = {
  AC: "#3b82f6",
  IC: "#22c55e",
  RDHx: "#f97316",
  DLC: "#a855f7",
};

interface MetricDrawerProps {
  metric: { label: string; field: string } | null;
  history: any;
  onClose: () => void;
}

export default function MetricDrawer({
  metric,
  history,
  onClose,
}: MetricDrawerProps) {
  // Fermeture du drawer à l'appui sur Échap (logique du collègue)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!metric) return null;

  const meta = METRIC_META[metric.field] || {};
  const rackIds = Object.keys(history);
  const maxLen = Math.max(
    ...rackIds.map((id) => history[id]?.[metric.field]?.length || 0),
    0,
  );

  // Génère les données temporelles pour Recharts (adaptation de sa logique)
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const secsAgo = (maxLen - 1 - i) * 2;
    let timeLabel = "maintenant";
    if (secsAgo > 0 && secsAgo < 60) timeLabel = `-${secsAgo}s`;
    else if (secsAgo >= 60) timeLabel = `-${Math.round(secsAgo / 60)}m`;

    const point: any = { time: timeLabel };

    rackIds.forEach((rackId) => {
      const values = history[rackId]?.[metric.field] || [];
      const offset = maxLen - values.length;
      const techno = rackId.includes("AC")
        ? "AC"
        : rackId.includes("RDHx")
          ? "RDHx"
          : rackId.includes("DLC")
            ? "DLC"
            : "IC";

      // On padde avec du null si les données sont incomplètes
      point[techno] = i >= offset ? values[i - offset] : null;
    });
    return point;
  });

  // Calcule les stats par rack (logique exacte du collègue)
  const stats = rackIds.map((rackId) => {
    const values = history[rackId]?.[metric.field] || [];
    const techno = rackId.includes("AC")
      ? "AC"
      : rackId.includes("RDHx")
        ? "RDHx"
        : rackId.includes("DLC")
          ? "DLC"
          : "IC";
    return {
      rackId,
      techno,
      last: values.length ? values[values.length - 1] : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      avg: values.length
        ? values.reduce((a: number, b: number) => a + b, 0) / values.length
        : null,
    };
  });

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-slate-950 border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5 shrink-0">
          <div>
            <div className="text-lg font-bold text-white flex items-baseline gap-2">
              {metric.label}
              {meta.unite && (
                <span className="text-xs text-white/40 font-normal">
                  {meta.unite}
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/40 mt-1">
              {maxLen} points · fenêtre ~{Math.round((maxLen * 2) / 60)} min
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cartes stats (min, max, avg par rack) */}
        <div className="grid grid-cols-4 gap-px bg-white/10 border-b border-white/10 shrink-0">
          {stats.map((s) => (
            <div key={s.rackId} className="bg-slate-950 p-4">
              <div
                className="text-[10px] font-bold mb-1.5 uppercase tracking-wider"
                style={{ color: TC[s.techno] }}
              >
                {s.techno}
              </div>
              <div className="text-xl font-bold text-white mb-2">
                {s.last != null ? s.last.toFixed(2) : "—"}
                <span className="text-[10px] text-white/40 ml-1 font-normal">
                  {meta.unite}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-[10px] text-white/40 font-mono">
                <div className="flex justify-between">
                  <span>Min</span>{" "}
                  <span className="text-white/70">
                    {s.min != null ? s.min.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Max</span>{" "}
                  <span className="text-white/70">
                    {s.max != null ? s.max.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Moy</span>{" "}
                  <span className="text-white/70">
                    {s.avg != null ? s.avg.toFixed(2) : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Graphique */}
        <div className="flex-1 p-5 min-h-0">
          {maxLen < 2 ? (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">
              En attente de données... ({maxLen} point{maxLen > 1 ? "s" : ""})
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="time"
                  stroke="#ffffff40"
                  fontSize={10}
                  tickMargin={10}
                  minTickGap={30}
                />
                <YAxis stroke="#ffffff40" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#ffffff20",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#ffffff80", marginBottom: "4px" }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                {stats.map((s) => (
                  <Line
                    key={s.techno}
                    type="monotone"
                    dataKey={s.techno}
                    name={`${s.techno} (${s.rackId})`}
                    stroke={TC[s.techno]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Formule & Source */}
        {meta.formule && (
          <div className="p-5 border-t border-white/10 bg-white/5 shrink-0">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
              Formule & Source
            </div>
            <div className="font-mono text-[11px] text-blue-400 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 mb-2">
              {meta.formule}
            </div>
            {meta.note && (
              <div className="text-[11px] text-white/60 leading-relaxed mb-1">
                {meta.note}
              </div>
            )}
            <div className="text-[10px] text-white/40">
              Source : {meta.source}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
