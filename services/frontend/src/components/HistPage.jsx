import React from "react";
import { TC_BG, f } from "../constants.js";

export default function HistPage({ history }) {
  return (
    <div className="card fade-in">
      <div className="sec-hd" style={{ marginBottom: "16px" }}>
        Historique des simulations
      </div>
      {history.length === 0 ? (
        <div className="empty">Aucune simulation enregistrée</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Date",
                  "Techno",
                  "Mix",
                  "P_it",
                  "E totale",
                  "CO₂e",
                  "PUE",
                  "ROI",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => {
                const colors = TC_BG[h.techno] || {};
                return (
                  <tr key={i}>
                    <td style={{ fontSize: "11px", color: "var(--text3)" }}>
                      {new Date(h.created_at).toLocaleString("fr")}
                    </td>
                    <td>
                      <span
                        className="h-badge"
                        style={{ background: colors.bg, color: colors.color }}
                      >
                        {h.techno}
                      </span>
                    </td>
                    <td style={{ fontSize: "11px", color: "var(--text3)" }}>
                      {h.mix_scenario}
                    </td>
                    <td>{f(h.p_it_kw, 1)} kW</td>
                    <td>{f(h.e_totale_kw, 1)} kW</td>
                    <td>{f(h.co2e_kg, 2)} kg</td>
                    <td>{f(h.pue_calcule, 3)}</td>
                    <td>{h.roi_annees ? f(h.roi_annees, 2) + " ans" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
