import React from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { TC, CHART_BASE, fK, f, TECHNO_ORDER } from '../constants.js'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler
)

export function EnergyChart({ results }) {
  const data = {
    labels: TECHNO_ORDER.filter(t => results.some(r => r.techno === t)),
    datasets: [
      { label: 'E IT (kW)',       data: TECHNO_ORDER.filter(t => results.some(r => r.techno === t)).map(t => results.find(r => r.techno === t)?.e_it_pure?.valeur || 0),          backgroundColor: '#60a5fa', stack: 's' },
      { label: 'Refroid. (kW)',  data: TECHNO_ORDER.filter(t => results.some(r => r.techno === t)).map(t => results.find(r => r.techno === t)?.e_refroidissement?.valeur || 0),  backgroundColor: '#f59e0b', stack: 's' },
      { label: 'E récup. (kW)',  data: TECHNO_ORDER.filter(t => results.some(r => r.techno === t)).map(t => results.find(x => x.techno === t)?.e_recuperee?.valeur || 0), backgroundColor: '#34d39980', stack: 's2' },
    ]
  }
  const options = {
    ...CHART_BASE,
    scales: {
      ...CHART_BASE.scales,
      x: { ...CHART_BASE.scales.x, stacked: true },
      y: { ...CHART_BASE.scales.y, stacked: true },
    }
  }
  return (
    <div className="chart-card fade-in">
      <div className="chart-title">Énergie par poste</div>
      <div className="chart-sub">kW — IT · Refroidissement · Énergie récupérable (stack séparé)</div>
      <div className="ch"><Bar data={data} options={options} /></div>
    </div>
  )
}

// Compare les émissions CO2 par technologie et par scénario électrique
export function CO2Chart({ allResults }) {
  const mixes   = [...new Set(allResults.map(r => r.mix_scenario))]
  const technos = TECHNO_ORDER.filter(t => allResults.some(r => r.techno === t))
  const data = {
    labels: mixes.map(m => m.replace('Mix ', '')),
    datasets: technos.map(t => ({
      label: t,
      backgroundColor: TC[t] + 'cc', // Couleur définie dans les constantes avec transparence
      data: mixes.map(m => allResults.find(r => r.techno === t && r.mix_scenario === m)?.co2e_annuel?.valeur || 0),
    }))
  }
  const options = {
    ...CHART_BASE,
    scales: {
      ...CHART_BASE.scales,
      x: { ...CHART_BASE.scales.x, ticks: { ...CHART_BASE.scales.x.ticks, font: { family: 'DM Sans', size: 9 } } }
    }
  }
  return (
    <div className="chart-card fade-in">
      <div className="chart-title">Émissions CO₂e par mix</div>
      <div className="chart-sub">tCO₂/an selon le scénario électrique</div>
      <div className="ch"><Bar data={data} options={options} /></div>
    </div>
  )
}

// Affiche la courbe de rentabilité (ROI) sur 10 ans
export function ROIChart({ results }) {
  const years = Array.from({ length: 11 }, (_, i) => i)
  const data = {
    labels: years.map(a => `An ${a}`),
    datasets: TECHNO_ORDER.filter(t => results.some(r => r.techno === t)).map(t => { const r = results.find(x => x.techno === t); return ({
      label: r.techno,
      borderColor: TC[r.techno],
      backgroundColor: `${TC[r.techno]}10`,
      fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2,
      // Coût cumulé = CAPEX + (énergie * prix * années) - économies
      data: years.map(a =>
        (r.surcout_capex?.valeur || 0) +
        ((r.e_totale?.valeur || 0) * 8760 * 0.15) * a -
        (r.economie_annuelle?.valeur || 0) * a
      )
    })})
  }
  const options = {
    ...CHART_BASE,
    scales: {
      ...CHART_BASE.scales,
      y: { ...CHART_BASE.scales.y, ticks: { ...CHART_BASE.scales.y.ticks, callback: v => fK(v) + '€' } }
    }
  }
  return (
    <div className="chart-card fade-in">
      <div className="chart-title">Courbe ROI — payback cumulé</div>
      <div className="chart-sub">Coût total sur 10 ans (CAPEX + OPEX)</div>
      <div className="ch"><Line data={data} options={options} /></div>
    </div>
  )
}