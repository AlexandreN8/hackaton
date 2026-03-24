import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { TC, LABELS, TC_BG, f, TECHNO_ORDER } from "../constants.js";

const ROW_META = {
  "E totale": {
    formule: "E_totale = P_it × PUE",
    note: "Énergie totale consommée — IT + refroidissement + auxiliaires.",
    source: "Uptime Institute — PUE definition v1.5",
  },
  "E refroid.": {
    formule: "E_refroid. = P_it × (PUE − 1)",
    note: "Fraction dédiée au refroidissement.",
    source: "ASHRAE TC9.9 (2021) / Green Revolution Cooling (2023)",
  },
  "CO₂e annuel": {
    formule: "CO₂e = P_it × PUE × co2_kwh × 8760 / 1 000 000",
    note: "Scope 2 uniquement — émissions indirectes liées à l'électricité.",
    source: "GHG Protocol Scope 2 / RTE Bilan électrique 2023",
  },
  "Eau annuelle": {
    formule: "Eau = P_it × WUE × 8760 / 1000",
    note: "IC : WUE=0 (circuit fermé). AC : WUE=1.8 L/kWh tours évaporatives.",
    source: "The Green Grid WUE / Green Revolution Cooling 2023",
  },
  "Nb racks": {
    formule: "nb_racks = ceil(P_it / densité_max_kW)",
    note: "IC/DLC : 100 kW/rack. AC : 20 kW/rack.",
    source: "NVIDIA DGX H100 specs / TIA-942",
  },
  Empreinte: {
    formule: "empreinte = nb_racks × 2.0 m²",
    note: "2.0 m² par rack — rack + allées de service chaud/froid.",
    source: "TIA-942 Telecommunications Infrastructure Standard",
  },
  ROI: {
    formule: "ROI = surcout_capex / economie_annuelle",
    note: "Payback simple non actualisé. IC : surcout +25% CAPEX.",
    source: "Uptime Institute Cost per kW 2023",
  },
  "E récupérée": {
    formule: "E_récup. = P_it × PUE × ERF",
    note: "Puissance thermique récupérable en continu (kW). Soit ~MWh/an = valeur × 8.76. IC/DLC sortent le fluide à >40°C — exploitable pour chauffage urbain ou serres.",
    source:
      "EN 50600-4-6 (2022) / Green Revolution Cooling / Google Finland DC",
  },
  Économie: {
    formule: "Économie = (PUE_AC − PUE_x) × P_it × 8760 × prix_kwh",
    note: "Économie annuelle sur la facture électrique vs Air Cooling.",
    source: "Eurostat — Electricity prices non-household 2023",
  },
};

function FloatingTooltip({ meta, anchorRef, visible }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + window.scrollX,
    });
  }, [visible]);

  if (!visible || !meta) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translateY(-100%)",
        width: "260px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "10px 12px",
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: "10px",
          color: "var(--cisco-dark)",
          background: "var(--cisco-light)",
          padding: "5px 8px",
          borderRadius: "5px",
          marginBottom: "6px",
          lineHeight: 1.5,
        }}
      >
        {meta.formule}
      </div>
      <div
        style={{
          fontSize: "10px",
          color: "var(--text2)",
          lineHeight: 1.6,
          marginBottom: "4px",
        }}
      >
        {meta.note}
      </div>
      <div style={{ fontSize: "9px", color: "var(--text3)" }}>
        Source : {meta.source}
      </div>
    </div>,
    document.body,
  );
}

function MetricRow({ row, data, allData, acRef, techno }) {
  const [hover, setHover] = useState(false);
  const anchorRef = useRef(null);
  const meta = ROW_META[row.l];

  const v = row.g(data);
  const vals = allData.map((d) => row.g(d)).filter((x) => x != null);
  const best = vals.length ? (row.low ? Math.min : Math.max)(...vals) : null;
  const isBest = v != null && v === best;
  const refV = acRef ? row.g(acRef) : null;
  const delta =
    refV && v != null && techno !== "AC"
      ? ((v - refV) / Math.abs(refV)) * 100
      : null;
  const good =
    delta != null && ((row.low && delta < 0) || (!row.low && delta > 0));

  return (
    <div className="tc-row">
      <span
        ref={anchorRef}
        className="tc-lbl"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          cursor: meta ? "help" : "default",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {row.l}
        {meta && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text3)"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </span>
      <FloatingTooltip meta={meta} anchorRef={anchorRef} visible={hover} />
      <span className={`tc-val ${isBest ? "best" : ""}`}>
        {v == null ? "—" : `${f(v, 1)} ${row.u}`}
        {delta != null && (
          <span className={`delta ${good ? "good" : "bad"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}%
          </span>
        )}
      </span>
    </div>
  );
}

const ROWS = [
  { l: "E totale", g: (r) => r?.e_totale?.valeur, u: "kW", low: true },
  {
    l: "E refroid.",
    g: (r) => r?.e_refroidissement?.valeur,
    u: "kW",
    low: true,
  },
  { l: "CO₂e annuel", g: (r) => r?.co2e_annuel?.valeur, u: "tCO₂", low: true },
  { l: "Eau annuelle", g: (r) => r?.eau_annuelle?.valeur, u: "m³", low: true },
  { l: "Nb racks", g: (r) => r?.nb_racks?.valeur, u: "", low: true },
  { l: "Empreinte", g: (r) => r?.empreinte_m2?.valeur, u: "m²", low: true },
  { l: "ROI", g: (r) => r?.roi_annees?.valeur, u: "ans", low: true },
  { l: "E récupérée", g: (r) => r?.e_recuperee?.valeur, u: "kW", low: false },
  {
    l: "Économie",
    g: (r) => r?.economie_annuelle?.valeur,
    u: "€/an",
    low: false,
  },
];

function TechnoCard({ techno, data, allData, acRef }) {
  const colors = TC_BG[techno] || {};
  const tc = TC[techno];

  return (
    <div className="techno-card">
      <div className="tc-stripe" style={{ background: tc }} />
      <div className="tc-header">
        <div className="tc-name" style={{ color: tc }}>
          {techno}
        </div>
        <div
          className="tc-badge"
          style={{ background: colors.bg, color: colors.color }}
        >
          {LABELS[techno] || techno}
        </div>
      </div>
      <div className="tc-metrics">
        {ROWS.map((row) => (
          <MetricRow
            key={row.l}
            row={row}
            data={data}
            allData={allData}
            acRef={acRef}
            techno={techno}
          />
        ))}
      </div>
    </div>
  );
}

export default function TechnoCards({ results, mix }) {
  const filtered = results.filter((r) => r.mix_scenario === mix);
  if (!filtered.length) {
    return (
      <div className="techno-grid">
        <div className="empty" style={{ gridColumn: "1/-1" }}>
          Lance un calcul pour voir les résultats par technologie
        </div>
      </div>
    );
  }

  const byT = Object.fromEntries(filtered.map((r) => [r.techno, r]));
  const technos = TECHNO_ORDER.filter((t) => byT[t]);
  const acRef = byT["AC"] || null;

  return (
    <div className="techno-grid fade-in">
      {technos.map((t) => (
        <TechnoCard
          key={t}
          techno={t}
          data={byT[t]}
          allData={filtered}
          acRef={acRef}
        />
      ))}
    </div>
  );
}
