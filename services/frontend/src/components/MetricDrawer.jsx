import React, { useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { TC, f } from "../constants.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const METRIC_META = {
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

export default function MetricDrawer({ metric, history, onClose }) {
  useEffect(() => {
    const handler = (e) => {
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

  const labels = Array.from({ length: maxLen }, (_, i) => {
    const secsAgo = (maxLen - 1 - i) * 2;
    if (secsAgo === 0) return "maintenant";
    if (secsAgo < 60) return `-${secsAgo}s`;
    return `-${Math.round(secsAgo / 60)}m`;
  });

  const datasets = rackIds.map((rackId) => {
    const values = history[rackId]?.[metric.field] || [];
    const padded = Array(maxLen - values.length)
      .fill(null)
      .concat(values);
    const techno = rackId.includes("AC")
      ? "AC"
      : rackId.includes("RDHx")
        ? "RDHx"
        : rackId.includes("DLC")
          ? "DLC"
          : "IC";
    const color = TC[techno] || "#049fd4";
    return {
      label: `${techno} (${rackId})`,
      data: padded,
      borderColor: color,
      backgroundColor: `${color}12`,
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      spanGaps: false,
    };
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    plugins: {
      legend: {
        labels: {
          color: "#4a5568",
          font: { family: "DM Sans", size: 12 },
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${ctx.parsed.y != null ? f(ctx.parsed.y, 2) : "—"} ${meta.unite || ""}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#8898aa",
          font: { family: "DM Sans", size: 10 },
          maxTicksLimit: 8,
        },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
      y: {
        min: 0,
        ticks: { color: "#8898aa", font: { family: "DM Sans", size: 10 } },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
    },
    interaction: { mode: "index", intersect: false },
  };

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
      last: values[values.length - 1] ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      avg: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
    };
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          zIndex: 200,
          animation: "fadeOverlay .2s ease",
        }}
      />

      <div className="drawer-panel">
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {metric.label}
              {meta.unite && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text3)",
                    fontWeight: 400,
                    marginLeft: "6px",
                  }}
                >
                  {meta.unite}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text3)",
                marginTop: "2px",
              }}
            >
              {maxLen} points · fenêtre ~{Math.round((maxLen * 2) / 60)} min
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--surface2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text3)",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: "1px",
            background: "var(--border)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.rackId}
              style={{ background: "var(--surface2)", padding: "12px 16px" }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: TC[s.techno] || "var(--cisco)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                {s.techno}
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: "4px",
                }}
              >
                {s.last != null ? f(s.last, 2) : "—"}
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text3)",
                    fontWeight: 400,
                    marginLeft: "4px",
                  }}
                >
                  {meta.unite}
                </span>
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text3)",
                  display: "flex",
                  gap: "8px",
                }}
              >
                <span>↓ {s.min != null ? f(s.min, 2) : "—"}</span>
                <span>↑ {s.max != null ? f(s.max, 2) : "—"}</span>
                <span>∅ {s.avg != null ? f(s.avg, 2) : "—"}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: "20px", minHeight: 0 }}>
          {maxLen < 2 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text3)",
                fontSize: "13px",
              }}
            >
              En attente de données... ({maxLen} point{maxLen > 1 ? "s" : ""})
            </div>
          ) : (
            <Line data={{ labels, datasets }} options={options} />
          )}
        </div>

        {meta.formule && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface2)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text3)",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: "8px",
              }}
            >
              Formule & source
            </div>
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: "11px",
                color: "var(--cisco-dark)",
                background: "var(--cisco-light)",
                padding: "8px 12px",
                borderRadius: "6px",
                marginBottom: "6px",
                lineHeight: "1.5",
              }}
            >
              {meta.formule}
            </div>
            {meta.note && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text2)",
                  lineHeight: "1.6",
                  marginBottom: "4px",
                }}
              >
                {meta.note}
              </div>
            )}
            <div style={{ fontSize: "10px", color: "var(--text3)" }}>
              Source : {meta.source}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeOverlay { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn     { from { transform: translateX(100%) } to { transform: none } }
      `}</style>
    </>
  );
}
