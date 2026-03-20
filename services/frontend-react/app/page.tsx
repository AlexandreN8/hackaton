"use client";

import { useState } from "react";
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

const API_URL = "http://localhost:8000";

// --- Helpers ---

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

// --- Page ---

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastParams, setLastParams] = useState<SimulationParams | null>(null);
  const [aiPayload, setAiPayload] = useState<object | null>(null);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [hasResults, setHasResults] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onCalculate={handleCalculate} isLoading={isLoading} />

      <main className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="relative border-b border-white/6 bg-white/2 px-8 py-6">
          {/* Subtle gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Comparatif Refroidissement Datacenter IA
                </h1>
              </div>
              <p className="text-sm text-white/40 ml-4 pl-0.5">
                Immersion Cooling · Air Cooling · RDHx · DLC — Hackathon Cisco
              </p>
            </div>
            {hasResults && lastParams && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/6 border border-white/8">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white/50 font-medium">
                    {lastParams.p_it_kw.toLocaleString("fr-FR")} kW ·{" "}
                    {lastParams.mix_scenario}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* ── Metric Cards ── */}
          <section>
            <SectionLabel label="Indicateurs Clés" />
            <MetricCards data={metricData} />
          </section>

          {/* ── Énergie & CO2 ── */}
          <section>
            <SectionLabel label="Énergie & Émissions" />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <EnergyChart data={energyData} />
              <Co2Chart data={co2Data} technos={selectedTechnos} />
            </div>
          </section>

          {/* ── TCO & Radar ── */}
          <section>
            <SectionLabel label="Analyse Économique & Multicritère" />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TcoChart data={tcoData} technos={selectedTechnos} />
              <RadarCompareChart data={radarData} technos={selectedTechnos} />
            </div>
          </section>

          {/* ── IA ── */}
          <section>
            <SectionLabel label="Recommandation IA" />
            <AiReco payload={aiPayload} apiUrl={API_URL} />
          </section>

          {/* ── Hypothèses ── */}
          {hypothesesData.length > 0 && (
            <section>
              <SectionLabel label="Périmètre & Hypothèses" />
              <Hypotheses data={hypothesesData} />
            </section>
          )}

          {/* ── Historique ── */}
          <section>
            <SectionLabel label="Historique" />
            <HistoryTable apiUrl={API_URL} refreshTrigger={refreshHistory} />
          </section>
        </div>
      </main>
    </div>
  );
}

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
