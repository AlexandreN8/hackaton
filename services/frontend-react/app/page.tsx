"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

// -- Imports de tes composants (vérifie que les chemins sont bons) --
import Sidebar, { SimulationParams } from "@/components/dashboard/Sidebar";
import MetricCards, { MetricData } from "@/components/dashboard/MetricCards";
import EnergyChart, {
  EnergyDataPoint,
} from "@/components/dashboard/EnergyChart";
import Co2Chart, { Co2DataPoint } from "@/components/dashboard/Co2Chart";
import TcoChart, { TcoDataPoint } from "@/components/dashboard/TcoChart";
import RadarCompareChart, {
  RadarDataPoint,
} from "@/components/dashboard/RadarCompareChart";
import AiReco from "@/components/dashboard/AiReco";
import Hypotheses, { HypothesisData } from "@/components/dashboard/Hypotheses";
import HistoryTable from "@/components/dashboard/HistoryTable";
import MetricDrawer from "@/components/dashboard/MetricDrawer";

// -- Imports des hooks de ton collègue --
import { useRT, useRTHistory } from "@/hooks/useApi";

const API_URL = "http://localhost:8000";
type Tab = "sim" | "rt" | "hist";

// --- Helpers pour le Simulateur ---

function buildMetricData(resultats: any[], p_it_kw: number): MetricData | null {
  const ac = resultats.find((r) => r.techno === "AC");
  const ic = resultats.find((r) => r.techno === "IC");
  if (!ac || !ic) return null;
  return {
    p_it_kw,
    nb_racks_ac: ac.nb_racks?.valeur ?? 0,
    nb_racks_ic: ic.nb_racks?.valeur ?? 0,
    empreinte_ac: ac.empreinte_m2?.valeur ?? 0,
    empreinte_ic: ic.empreinte_m2?.valeur ?? 0,
    eau_ac: ac.eau_annuelle?.valeur ?? 0,
    eau_ic: ic.eau_annuelle?.valeur ?? 0,
    pue_ac: ac.e_totale?.inputs?.pue_typ ?? 0,
    pue_ic: ic.e_totale?.inputs?.pue_typ ?? 0,
  };
}

function buildEnergyData(resultats: any[], mix: string): EnergyDataPoint[] {
  return resultats
    .filter((r) => r.mix_scenario === mix)
    .map((r) => ({
      techno: r.techno,
      it: r.e_it_pure?.valeur ?? 0,
      refroidissement: r.e_refroidissement?.valeur ?? 0,
      auxiliaires:
        (r.e_totale?.valeur ?? 0) -
        (r.e_it_pure?.valeur ?? 0) -
        (r.e_refroidissement?.valeur ?? 0),
    }));
}

function buildCo2Data(resultats: any[], technos: string[]): Co2DataPoint[] {
  const mixSet = Array.from(new Set(resultats.map((r) => r.mix_scenario)));
  return mixSet.map((mix) => {
    const point: Co2DataPoint = { mix };
    for (const techno of technos) {
      const r = resultats.find(
        (r) => r.techno === techno && r.mix_scenario === mix,
      );
      if (r) point[techno] = r.co2e_annuel?.valeur ?? 0;
    }
    return point;
  });
}

function buildTcoData(
  resultats: any[],
  mix: string,
  prix_kwh: number,
): TcoDataPoint[] {
  const filtered = resultats.filter((r) => r.mix_scenario === mix);
  return Array.from({ length: 11 }, (_, annee) => {
    const point: TcoDataPoint = { annee };
    for (const r of filtered) {
      const energie = r.e_totale?.valeur ?? 1000;
      const capex = r.techno === "AC" ? energie * 1500 : energie * 2000;
      const opex = energie * 8760 * prix_kwh;
      point[r.techno] = capex + opex * annee;
    }
    return point;
  });
}

function buildRadarData(resultats: any[], mix: string): RadarDataPoint[] {
  const filtered = resultats.filter((r) => r.mix_scenario === mix);
  const axes = ["PUE", "CO₂e", "Densité", "Conso Eau", "Énergie Totale"];
  const raw: Record<string, Record<string, number>> = {};
  for (const r of filtered) {
    raw[r.techno] = {
      PUE: r.e_totale?.inputs?.pue_typ ?? 1,
      "CO₂e": r.co2e_annuel?.valeur ?? 0,
      Densité: r.nb_racks?.valeur ?? 0,
      "Conso Eau": r.eau_annuelle?.valeur ?? 0,
      "Énergie Totale": r.e_totale?.valeur ?? 0,
    };
  }
  return axes.map((axis) => {
    const values = Object.values(raw).map((v) => v[axis]);
    const max = Math.max(...values, 1);
    const point: RadarDataPoint = { axis };
    for (const techno of Object.keys(raw)) {
      point[techno] = parseFloat(((raw[techno][axis] ?? 0) / max).toFixed(3));
    }
    return point;
  });
}

function buildHypothesesData(resultats: any[], mix: string): HypothesisData[] {
  return resultats
    .filter((r) => r.mix_scenario === mix)
    .map((r) => ({
      techno: r.techno,
      perimetre_inclus: r.e_totale?.perimetre_inclus ?? "N/A",
      perimetre_exclus: r.e_totale?.perimetre_exclus,
      hypothese: r.e_totale?.hypothese ?? "N/A",
      source: r.e_totale?.source ?? "N/A",
    }));
}

// --- Couleurs par techno ---
const TC: Record<string, string> = {
  AC: "#3b82f6",
  IC: "#22c55e",
  RDHx: "#f97316",
  DLC: "#a855f7",
};

// --- Composant KPI Card RT (avec mini-courbe animée) ---
function KpiCard({ sensor, history }: { sensor: any; history: number[] }) {
  const color = TC[sensor.techno] ?? "#94a3b8";
  const gpuLoad = Math.min(100, sensor.gpu_usage_percent ?? 0);
  const chartData = history.map((val) => ({ val }));

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-white/4 p-4 flex flex-col justify-between min-h-[160px]">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: color }}
      />

      {/* En-tête */}
      <div className="flex items-center justify-between mb-3 z-10 relative">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {sensor.techno}
        </span>
        <span className="text-[10px] text-white/30 font-mono">
          {sensor.rack_id}
        </span>
      </div>

      {/* Courbe en arrière-plan */}
      <div className="absolute bottom-12 left-0 right-0 h-20 opacity-25 pointer-events-none">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis domain={["auto", "auto"]} hide />
              <Line
                type="monotone"
                dataKey="val"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Données (z-10) */}
      <div className="z-10 relative">
        <div className="text-3xl font-bold font-mono text-white mb-1">
          {Number(sensor.p_it_kw ?? 0).toFixed(1)}
          <span className="text-sm font-normal text-white/40 ml-1">kW</span>
        </div>
        <div className="text-xs text-white/40 mb-3 space-y-0.5">
          <div>
            CPU {Number(sensor.cpu_temp_c ?? 0).toFixed(0)}°C · GPU{" "}
            {Number(sensor.gpu_temp_c ?? 0).toFixed(0)}°C
          </div>
          <div>ITEEsv {Number(sensor.iteesv ?? 0).toFixed(3)}</div>
        </div>

        {/* Barre GPU */}
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${gpuLoad}%`, background: color }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/25 mt-1">
          <span>GPU Load</span>
          <span>{gpuLoad.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// --- Composant RT Table (cliquable pour le Drawer) ---
const SENSOR_ROWS = [
  { l: "Densité (kW)", k: "p_it_kw", g: (r: any) => r.p_it_kw, low: false },
  {
    l: "CPU usage %",
    k: "cpu_usage_percent",
    g: (r: any) => r.cpu_usage_percent,
    low: false,
  },
  { l: "CPU temp °C", k: "cpu_temp_c", g: (r: any) => r.cpu_temp_c, low: true },
  {
    l: "GPU usage %",
    k: "gpu_usage_percent",
    g: (r: any) => r.gpu_usage_percent,
    low: false,
  },
  { l: "GPU temp °C", k: "gpu_temp_c", g: (r: any) => r.gpu_temp_c, low: true },
  { l: "HBM temp °C", k: "hbm_temp_c", g: (r: any) => r.hbm_temp_c, low: true },
  {
    l: "Room temp °C",
    k: "room_temp_c",
    g: (r: any) => r.room_temp_c,
    low: true,
  },
  { l: "ITEEsv", k: "iteesv", g: (r: any) => r.iteesv, low: false },
];

function RTTable({
  rtData,
  onRowClick,
}: {
  rtData: any;
  onRowClick: (label: string, key: string) => void;
}) {
  if (!rtData?.sensors)
    return (
      <div className="text-center text-white/30 text-sm py-12">
        En attente de données capteurs...
      </div>
    );

  const TECHNO_ORDER = ["AC", "IC", "RDHx", "DLC"];
  const allRacks = Object.values(rtData.sensors) as any[];
  const racks = TECHNO_ORDER.map((t) =>
    allRacks.find((r) => r.techno === t),
  ).filter(Boolean);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/8">
            <th className="text-left px-4 py-3 text-white/30 font-semibold uppercase tracking-wider text-[10px]">
              Métrique
            </th>
            {racks.map((r: any) => (
              <th key={r.rack_id} className="px-4 py-3 text-center">
                <span
                  className="font-bold text-sm"
                  style={{ color: TC[r.techno] ?? "#94a3b8" }}
                >
                  {r.techno}
                </span>
                <div className="text-[10px] text-white/25 font-normal">
                  {r.rack_id}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SENSOR_ROWS.map((row) => {
            const vals = racks
              .map((r: any) => row.g(r))
              .filter((v) => v != null) as number[];
            const best = vals.length
              ? (row.low ? Math.min : Math.max)(...vals)
              : null;
            return (
              <tr
                key={row.l}
                onClick={() => onRowClick(row.l, row.k)}
                className="border-b border-white/4 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <td className="px-4 py-2.5 text-white/50 font-medium">
                  {row.l}
                </td>
                {racks.map((r: any) => {
                  const v = row.g(r);
                  const isBest = v != null && v === best;
                  return (
                    <td
                      key={r.rack_id}
                      className="px-4 py-2.5 text-center font-mono"
                    >
                      <span
                        className={isBest ? "font-bold" : "text-white/60"}
                        style={
                          isBest ? { color: TC[r.techno] ?? "#94a3b8" } : {}
                        }
                      >
                        {v == null ? "—" : Number(v).toFixed(2)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Composant utilitaire de titre ---
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

// --- Page principale Dashboard ---
export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("sim");
  const [isLoading, setIsLoading] = useState(false);
  const [lastParams, setLastParams] = useState<SimulationParams | null>(null);
  const [aiPayload, setAiPayload] = useState<object | null>(null);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [hasResults, setHasResults] = useState(false);

  // État du Drawer
  const [drawerMetric, setDrawerMetric] = useState<{
    label: string;
    field: string;
  } | null>(null);

  // Données du Simulateur
  const [metricData, setMetricData] = useState<MetricData | null>(null);
  const [energyData, setEnergyData] = useState<EnergyDataPoint[]>([]);
  const [co2Data, setCo2Data] = useState<Co2DataPoint[]>([]);
  const [tcoData, setTcoData] = useState<TcoDataPoint[]>([]);
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [hypothesesData, setHypothesesData] = useState<HypothesisData[]>([]);
  const [selectedTechnos, setSelectedTechnos] = useState<string[]>([
    "AC",
    "IC",
  ]);

  // Hooks Temps Réel (ne s'activent que sur l'onglet "rt")
  const rtData = useRT(tab === "rt");
  const rtHistory = useRTHistory(tab === "rt", rtData);

  const handleCalculate = async (params: SimulationParams) => {
    setIsLoading(true);
    setLastParams(params);
    setSelectedTechnos(params.technos);
    try {
      const res = await fetch(`${API_URL}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_it_kw: params.p_it_kw,
          technos: params.technos,
          mix_scenario: params.mix_scenario,
          prix_kwh: params.prix_kwh,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const resultats = json.resultats ?? [];

      setMetricData(buildMetricData(resultats, params.p_it_kw));
      setEnergyData(buildEnergyData(resultats, params.mix_scenario));
      setCo2Data(buildCo2Data(resultats, params.technos));
      setTcoData(buildTcoData(resultats, params.mix_scenario, params.prix_kwh));
      setRadarData(buildRadarData(resultats, params.mix_scenario));
      setHypothesesData(buildHypothesesData(resultats, params.mix_scenario));
      setAiPayload({
        p_it_kw: params.p_it_kw,
        technos: params.technos,
        mix_scenario: params.mix_scenario,
        prix_kwh: params.prix_kwh,
      });
      setHasResults(true);
      setRefreshHistory((n) => n + 1);
    } catch (err) {
      console.error("Erreur calcul:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const rtSensors = rtData?.sensors
    ? (Object.values(rtData.sensors) as any[])
    : [];
  const TECHNO_ORDER = ["AC", "IC", "RDHx", "DLC"];
  const orderedSensors = TECHNO_ORDER.map((t) =>
    rtSensors.find((s) => s.techno === t),
  ).filter(Boolean);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onCalculate={handleCalculate} isLoading={isLoading} />

      <main className="flex-1 overflow-y-auto relative">
        {/* ── Header ── */}
        <div className="relative border-b border-white/6 bg-white/2 px-8 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="w-1 h-7 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Comparatif Refroidissement Datacenter IA
                </h1>
              </div>
              <p className="text-xs text-white/30 ml-4">
                Immersion Cooling · Air Cooling · RDHx · DLC — Hackathon Cisco
              </p>
            </div>

            <div className="flex items-center gap-3">
              {rtData && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] text-green-400 font-medium">
                    LIVE
                  </span>
                </div>
              )}
              {hasResults && lastParams && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/6 border border-white/8">
                  <span className="text-xs text-white/40 font-medium">
                    {lastParams.p_it_kw.toLocaleString("fr-FR")} kW ·{" "}
                    {lastParams.mix_scenario}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-1 mt-4">
            {(
              [
                ["sim", "Simulateur"],
                ["rt", "Temps Réel"],
                ["hist", "Historique"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === id
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {label}
                {id === "rt" && rtData && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-6 space-y-8 relative">
          {/* ══ TAB : SIMULATEUR ══ */}
          {tab === "sim" && (
            <>
              <section>
                <SectionLabel label="Indicateurs Clés" />
                <MetricCards data={metricData} />
              </section>
              <section>
                <SectionLabel label="Énergie & Émissions" />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <EnergyChart data={energyData} />
                  <Co2Chart data={co2Data} technos={selectedTechnos} />
                </div>
              </section>
              <section>
                <SectionLabel label="Analyse Économique & Multicritère" />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <TcoChart data={tcoData} technos={selectedTechnos} />
                  <RadarCompareChart
                    data={radarData}
                    technos={selectedTechnos}
                  />
                </div>
              </section>
              <section>
                <SectionLabel label="Recommandation IA" />
                <AiReco payload={aiPayload} apiUrl={API_URL} />
              </section>
              {hypothesesData.length > 0 && (
                <section>
                  <SectionLabel label="Périmètre & Hypothèses" />
                  <Hypotheses data={hypothesesData} />
                </section>
              )}
            </>
          )}

          {/* ══ TAB : TEMPS RÉEL ══ */}
          {tab === "rt" && (
            <>
              <section>
                <SectionLabel label="KPI par rack — temps réel" />
                {orderedSensors.length > 0 ? (
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {orderedSensors.map((s: any) => {
                      const rackHistory = rtHistory[s.rack_id]?.p_it_kw || [];
                      return (
                        <KpiCard
                          key={s.rack_id}
                          sensor={s}
                          history={rackHistory}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/8 bg-white/4 p-12 text-center">
                    <div className="text-white/20 text-sm">
                      En attente de données capteurs...
                    </div>
                  </div>
                )}
              </section>
              <section>
                <SectionLabel label="Tableau comparatif" />
                {/* Tableau avec le clic activé vers le Drawer */}
                <RTTable
                  rtData={rtData}
                  onRowClick={(label, field) =>
                    setDrawerMetric({ label, field })
                  }
                />
              </section>

              {/* Le Tiroir latéral (Metric Drawer) */}
              <MetricDrawer
                metric={drawerMetric}
                history={rtHistory}
                onClose={() => setDrawerMetric(null)}
              />
            </>
          )}

          {/* ══ TAB : HISTORIQUE ══ */}
          {tab === "hist" && (
            <section>
              <SectionLabel label="Historique des simulations" />
              <HistoryTable apiUrl={API_URL} refreshTrigger={refreshHistory} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
