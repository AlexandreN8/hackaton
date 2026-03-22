import React, { useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { TC, CHART_BASE, f } from '../constants.js'

// Profils prédéfinis 
const ICONS = {
  env: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M12 12C12 7 17 3 22 3c0 5-3 9-10 9zM12 12C12 7 7 3 2 3c0 5 3 9 10 9z"/></svg>,
  eco: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  dry: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v6m0 0C9 12 5 15 5 18a7 7 0 0014 0c0-3-4-6-7-10z"/></svg>,
  dense: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  custom: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
}

const PROFILES = [
  {
    id: 'env',
    label: 'Environnemental',
    description: 'Priorité réduction CO₂e et eau — objectifs ESG / GHG Protocol',
    weights: { pue: 20, co2: 40, eau: 30, densite: 5, roi: 5 },
  },
  {
    id: 'eco',
    label: 'Économique',
    description: 'Priorité ROI et efficacité énergétique — optimisation TCO',
    weights: { pue: 30, co2: 10, eau: 5, densite: 20, roi: 35 },
  },
  {
    id: 'dry',
    label: 'Zone sèche',
    description: 'Contrainte hydrique forte — Moyen-Orient, zones de stress eau',
    weights: { pue: 15, co2: 15, eau: 55, densite: 10, roi: 5 },
  },
  {
    id: 'dense',
    label: 'Haute densité',
    description: 'Maximiser densité rack — hyperscalers, espace limité',
    weights: { pue: 20, co2: 10, eau: 5, densite: 50, roi: 15 },
  },
  {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Définissez vos propres priorités',
    weights: { pue: 20, co2: 20, eau: 20, densite: 20, roi: 20 },
  },
]

// Définition des critères avec justification
const CRITERIA_DEF = [
  {
    key: 'pue',
    label: 'Efficacité énergie',
    unit: 'PUE',
    get: r => r.e_totale?.inputs?.pue_typ,
    invert: true,
    tooltip: {
      formule: 'PUE = E_totale / E_IT',
      note: 'Plus le PUE est proche de 1.0, plus le refroidissement est efficace. IC atteint 1.05 vs 1.50 pour AC.',
      source: 'Uptime Institute — PUE definition v1.5 / Green Grid',
    },
  },
  {
    key: 'co2',
    label: 'Empreinte CO₂e',
    unit: 'tCO₂/an',
    get: r => r.co2e_annuel?.valeur,
    invert: true,
    tooltip: {
      formule: 'CO₂e = P_it × PUE × co2_kwh × 8760 / 1 000 000',
      note: 'Scope 2 uniquement (émissions indirectes liées à l\'électricité). Varie selon le mix électrique choisi.',
      source: 'GHG Protocol Scope 2 / RTE Bilan électrique 2023',
    },
  },
  {
    key: 'eau',
    label: 'Consomm. eau',
    unit: 'm³/an',
    get: r => r.eau_annuelle?.valeur,
    invert: true,
    tooltip: {
      formule: 'Eau = P_it × WUE × 8760 / 1000',
      note: 'IC : WUE=0 (circuit fermé, zéro évaporation). AC : WUE=1.8 L/kWh via tours évaporatives.',
      source: 'The Green Grid WUE / Green Revolution Cooling 2023',
    },
  },
  {
    key: 'densite',
    label: 'Densité rack',
    unit: 'nb racks',
    get: r => r.nb_racks?.valeur,
    invert: true,
    tooltip: {
      formule: 'nb_racks = ceil(P_it / densité_max_kW)',
      note: 'IC/DLC supportent 100 kW/rack vs 20 kW/rack pour AC. Moins de racks = moins de surface datacenter.',
      source: 'NVIDIA DGX H100 specs / TIA-942 Telecommunications Infrastructure Standard',
    },
  },
  {
    key: 'roi',
    label: 'ROI payback',
    unit: 'ans',
    get: r => r.roi_annees?.valeur ?? null,
    invert: true,
    tooltip: {
      formule: 'ROI = surcout_capex / economie_annuelle',
      note: 'Payback simple non actualisé. IC : surcout CAPEX +25% amorti en 0.4 ans grâce aux économies énergie.',
      source: 'Uptime Institute Cost per kW 2023 / Eurostat B2B 2023',
    },
  },
]

// Tooltip composant 
function CriteriaTooltip({ criterion, visible }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '12px', zIndex: 50,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: 'DM Mono, monospace', fontSize: '11px',
        color: 'var(--cisco-dark)', background: 'var(--cisco-light)',
        padding: '6px 10px', borderRadius: '6px', marginBottom: '6px',
      }}>
        {criterion.tooltip.formule}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '4px' }}>
        {criterion.tooltip.note}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
        Source : {criterion.tooltip.source}
      </div>
    </div>
  )
}

function normalize(results, criteria) {
  return criteria.map(c => {
    const vals  = results.map(r => c.get(r)).filter(v => v != null)
    if (!vals.length) return results.map(() => 0)
    const min   = Math.min(...vals)
    const max   = Math.max(...vals)
    const range = max - min || 1
    return results.map(r => {
      const v = c.get(r)
      // Si valeur null (ex: ROI d'AC) : score neutre 0.5 sur ce critère
      if (v == null) return 0.5
      const norm = (v - min) / range
      return c.invert ? 1 - norm : norm
    })
  })
}

export default function ScoreChart({ results }) {
  const [activeProfile, setActiveProfile] = useState('env')
  const [customWeights, setCustomWeights] = useState({ pue: 20, co2: 20, eau: 20, densite: 20, roi: 20 })
  const [hoveredCriteria, setHoveredCriteria] = useState(null)

  if (!results?.length) return null

  const profile = PROFILES.find(p => p.id === activeProfile)
  const rawWeights = activeProfile === 'custom' ? customWeights : profile.weights

  // Normaliser les poids à 100%
  const total = Object.values(rawWeights).reduce((a, b) => a + b, 0) || 1
  const normWeights = Object.fromEntries(
    Object.entries(rawWeights).map(([k, v]) => [k, v / total])
  )

  const criteria   = CRITERIA_DEF.map(c => ({ ...c, wNorm: normWeights[c.key] }))
  const normalized = normalize(results, criteria)

  const scores = results.map((_, i) =>
    criteria.reduce((sum, c, ci) => sum + c.wNorm * normalized[ci][i], 0)
  )

  const sorted = results
    .map((r, i) => ({ techno: r.techno, score: scores[i], idx: i }))
    .sort((a, b) => b.score - a.score)

  const winner = sorted[0]

  const data = {
    labels: sorted.map(s => s.techno),
    datasets: [{
      data:            sorted.map(s => Math.round(s.score * 100)),
      backgroundColor: sorted.map(s => TC[s.techno] + 'cc'),
      borderColor:     sorted.map(s => TC[s.techno]),
      borderWidth: 1, borderRadius: 4,
    }]
  }

  const options = {
    ...CHART_BASE,
    indexAxis: 'y',
    plugins: {
      ...CHART_BASE.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: ctx => `${ctx[0].label} — Score ${ctx[0].parsed.x}/100`,
          label: () => '',
          afterBody: ctx => {
            const techno = sorted[ctx[0].dataIndex].techno
            const r      = results.find(x => x.techno === techno)
            const ni     = results.findIndex(x => x.techno === techno)
            return criteria.map((c, ci) => {
              const pts = Math.round(c.wNorm * normalized[ci][ni] * 100)
              const v   = c.get(r)
              return ` ${c.label}: ${v != null ? f(v, 1) : '—'} ${c.unit}  →  ${pts} pts`
            })
          }
        }
      }
    },
    scales: {
      x: { ...CHART_BASE.scales.x, min: 0, max: 100, ticks: { ...CHART_BASE.scales.x.ticks, callback: v => `${v}` } },
      y: { ...CHART_BASE.scales.y }
    }
  }

  return (
    <div className="chart-card fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div>
          <div className="chart-title">Score composite — recommandation</div>
          <div className="chart-sub">{profile.description}</div>
        </div>
        {winner && (
          <span style={{
            fontSize: '11px', fontWeight: 600, flexShrink: 0, marginLeft: '12px',
            color: TC[winner.techno] || 'var(--cisco)',
            background: 'var(--surface2)',
            border: `1px solid ${TC[winner.techno] || 'var(--cisco)'}`,
            padding: '3px 10px', borderRadius: '20px',
          }}>
            ★ {winner.techno} recommandé
          </span>
        )}
      </div>

      {/* Sélecteur de profils */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {PROFILES.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProfile(p.id)}
            style={{
              padding: '5px 12px', border: '1px solid',
              borderColor: activeProfile === p.id ? 'var(--cisco)' : 'var(--border)',
              borderRadius: '20px', cursor: 'pointer',
              fontSize: '12px', fontWeight: activeProfile === p.id ? 600 : 400,
              color: activeProfile === p.id ? 'var(--cisco)' : 'var(--text2)',
              background: activeProfile === p.id ? 'var(--cisco-light)' : 'var(--surface)',
              transition: 'all .15s', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <span style={{display:"flex",alignItems:"center",gap:"5px"}}>{ICONS[p.id]}{p.label}</span>
          </button>
        ))}
      </div>

      {/* Poids avec tooltips */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px 14px',
        marginBottom: '16px',
        padding: '12px',
        background: 'var(--surface2)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
      }}>
        {criteria.map(c => (
          <div key={c.key} style={{ position: 'relative' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', cursor: 'help' }}
              onMouseEnter={() => setHoveredCriteria(c.key)}
              onMouseLeave={() => setHoveredCriteria(null)}
            >
              <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {c.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--cisco)', fontWeight: 700, minWidth: '30px', textAlign: 'right' }}>
                {Math.round(normWeights[c.key] * 100)}%
              </span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={rawWeights[c.key]}
              disabled={activeProfile !== 'custom'}
              onChange={e => setCustomWeights(w => ({ ...w, [c.key]: Number(e.target.value) }))}
              style={{
                width: '100%',
                accentColor: 'var(--cisco)',
                cursor: activeProfile === 'custom' ? 'pointer' : 'default',
                opacity: activeProfile === 'custom' ? 1 : 0.5,
              }}
            />
            <CriteriaTooltip criterion={c} visible={hoveredCriteria === c.key} />
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="ch"><Bar data={data} options={options} /></div>
    </div>
  )
}