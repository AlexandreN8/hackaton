import React, { useState } from "react";
import { TC } from "../constants.js";
import TechnoCards from "./TechnoCards.jsx";
import { EnergyChart, CO2Chart, ROIChart } from "./Charts.jsx";
import ScoreChart from "./ScoreChart.jsx";
import AIReco from "./AIReco.jsx";

export default function SimPage({
  referentiel,
  results,
  loading,
  onCalculate,
  aiText,
  aiStreaming,
}) {
  const [pIt, setPIt] = useState(50);
  const [mix, setMix] = useState(referentiel?.mix?.[0]?.scenario || "");
  const [technos, setTechnos] = useState("AC,IC,RDHx,DLC");

  const mixList = referentiel?.mix || [];
  const activeMix = mix || mixList[0]?.scenario || "";
  const filtered = results.filter((r) => r.mix_scenario === activeMix);
  const hasResults = filtered.length > 0;

  const handleCalc = () => {
    onCalculate({
      p_it_kw: parseFloat(pIt),
      technos: technos.split(","),
      prix_kwh: 0.15,
    });
  };

  return (
    <>
      <div className="card fade-in">
        <div className="sec-hd" style={{ marginBottom: "14px" }}>
          Paramètres de simulation
        </div>
        <div className="cfg-grid">
          <div className="field">
            <label>Charge IT (kW)</label>
            <input
              type="number"
              value={pIt}
              min={1}
              max={5000}
              onChange={(e) => setPIt(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Mix électrique</label>
            <select value={activeMix} onChange={(e) => setMix(e.target.value)}>
              {mixList.map((m) => (
                <option key={m.scenario} value={m.scenario}>
                  {m.scenario} ({m.co2_kwh} gCO₂/kWh)
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Technologies</label>
            <select
              value={technos}
              onChange={(e) => setTechnos(e.target.value)}
            >
              <option value="AC,IC,RDHx,DLC">Toutes — 4 technologies</option>
              <option value="AC,IC">AC vs IC</option>
              <option value="AC,RDHx">AC vs RDHx</option>
              <option value="AC,DLC">AC vs DLC</option>
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={handleCalc}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> Calcul...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Calculer
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <div className="sec-hd">Résultats — {activeMix || "—"}</div>
        <TechnoCards results={results} mix={activeMix} />
      </div>

      {hasResults && (
        <>
          <div className="charts2">
            <EnergyChart results={filtered} />
            <CO2Chart allResults={results} />
          </div>
          <ROIChart results={filtered} />
          <ScoreChart results={filtered} />

          <div className="card fade-in">
            <div className="sec-hd" style={{ marginBottom: "14px" }}>
              Périmètre & hypothèses
            </div>
            <div className="hyp-grid">
              {filtered.map((r) => (
                <div key={r.techno} className="hyp-item">
                  <div
                    className="hyp-title"
                    style={{ color: TC[r.techno] || "var(--cisco)" }}
                  >
                    {r.techno}
                  </div>
                  <div className="hyp-body">
                    <strong>Périmètre :</strong>{" "}
                    {r.e_totale?.perimetre_inclus || "—"}
                    <br />
                    <strong>Exclu :</strong>{" "}
                    {r.e_totale?.perimetre_exclus || "—"}
                    <br />
                    <strong>Hypothèse :</strong>{" "}
                    {r.co2e_annuel?.hypothese || "—"}
                    <br />
                    <strong>Source :</strong> {r.e_totale?.source || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AIReco pIt={pIt} results={filtered} />
        </>
      )}
    </>
  );
}
