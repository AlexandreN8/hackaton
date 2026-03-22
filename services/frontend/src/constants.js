export const TC = {
  AC:   '#2563eb',
  IC:   '#049fd4',
  RDHx: '#7c3aed',
  DLC:  '#059669',
}

export const LABELS = {
  AC:   'Air Cooling',
  IC:   'Immersion',
  RDHx: 'Rear Door',
  DLC:  'Direct Liquid',
}

export const TC_BG = {
  AC:   { bg: 'var(--ac-bg)',   color: 'var(--ac)' },
  IC:   { bg: 'var(--ic-bg)',   color: 'var(--cisco-dark)' },
  RDHx: { bg: 'var(--rdhx-bg)', color: 'var(--rdhx)' },
  DLC:  { bg: 'var(--dlc-bg)',  color: 'var(--dlc)' },
}

export const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#8898aa', font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 12 }
    }
  },
  scales: {
    x: { ticks: { color: '#8898aa', font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
    y: { ticks: { color: '#8898aa', font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
  }
}

export const f  = (v, d = 2) => v == null ? '—' : Number(v).toFixed(d)
export const fK = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : Number(v).toFixed(0)
