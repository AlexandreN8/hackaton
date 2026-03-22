import React from 'react'
import { TC, LABELS, TC_BG, f } from '../constants.js'

const ROWS = [
  { l: 'E totale',     g: r => r?.e_totale?.valeur,          u: 'kW',   low: true  },
  { l: 'E refroid.',   g: r => r?.e_refroidissement?.valeur, u: 'kW',   low: true  },
  { l: 'CO₂e annuel', g: r => r?.co2e_annuel?.valeur,       u: 'tCO₂', low: true  },
  { l: 'Eau annuelle', g: r => r?.eau_annuelle?.valeur,      u: 'm³',   low: true  },
  { l: 'Nb racks',     g: r => r?.nb_racks?.valeur,          u: '',     low: true  },
  { l: 'Empreinte',    g: r => r?.empreinte_m2?.valeur,      u: 'm²',   low: true  },
  { l: 'ROI',          g: r => r?.roi_annees?.valeur,        u: 'ans',  low: true  },
  { l: 'Économie',     g: r => r?.economie_annuelle?.valeur, u: '€/an', low: false },
]

function TechnoCard({ techno, data, allData, acRef }) {
  const colors = TC_BG[techno] || {}
  const tc = TC[techno]

  return (
    <div className="techno-card">
      <div className="tc-stripe" style={{ background: tc }} />
      <div className="tc-header">
        <div className="tc-name" style={{ color: tc }}>{techno}</div>
        <div className="tc-badge" style={{ background: colors.bg, color: colors.color }}>
          {LABELS[techno] || techno}
        </div>
      </div>
      <div className="tc-metrics">
        {ROWS.map(row => {
          const v = row.g(data)
          const vals = allData.map(d => row.g(d)).filter(x => x != null)
          const best = vals.length ? (row.low ? Math.min : Math.max)(...vals) : null
          const isBest = v != null && v === best
          const refV = acRef ? row.g(acRef) : null
          const delta = refV && v != null && techno !== 'AC' ? (v - refV) / Math.abs(refV) * 100 : null
          const good = delta != null && ((row.low && delta < 0) || (!row.low && delta > 0))

          return (
            <div key={row.l} className="tc-row">
              <span className="tc-lbl">{row.l}</span>
              <span className={`tc-val ${isBest ? 'best' : ''}`}>
                {v == null ? '—' : `${f(v, 1)} ${row.u}`}
                {delta != null && (
                  <span className={`delta ${good ? 'good' : 'bad'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TechnoCards({ results, mix }) {
  const filtered = results.filter(r => r.mix_scenario === mix)
  if (!filtered.length) {
    return (
      <div className="techno-grid">
        <div className="empty" style={{ gridColumn: '1/-1' }}>
          Lance un calcul pour voir les résultats par technologie
        </div>
      </div>
    )
  }

  const technos = [...new Set(filtered.map(r => r.techno))]
  const byT = Object.fromEntries(technos.map(t => [t, filtered.find(r => r.techno === t)]))
  const acRef = byT['AC'] || null

  return (
    <div className="techno-grid fade-in">
      {technos.map(t => (
        <TechnoCard
          key={t}
          techno={t}
          data={byT[t]}
          allData={filtered}
          acRef={acRef}
        />
      ))}
    </div>
  )
}
