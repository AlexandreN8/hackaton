import React, { useState, useEffect } from 'react'
import { TC, f } from '../constants.js'
import RTTable from './RTTable.jsx'
import MetricDrawer from './MetricDrawer.jsx'
import { useRTHistory } from '../hooks/useApi.js'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineElement, PointElement, Filler, Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip)

function PowerChart({ rackId, history, color }) {
  const values = history?.[rackId]?.p_it_kw || []
  if (values.length < 2) return (
    <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '10px', color: 'var(--text3)' }}>En attente...</span>
    </div>
  )

  const labels = values.map((_, i) => {
    const secsAgo = (values.length - 1 - i) * 2
    return secsAgo === 0 ? 'now' : secsAgo % 30 === 0 ? `-${secsAgo}s` : ''
  })

  const data = {
    labels,
    datasets: [{
      data: values,
      borderColor: color,
      backgroundColor: `${color}18`,
      fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0,
    }]
  }

  const options = {
    responsive: true, maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${f(ctx.parsed.y, 1)} kW` } }
    },
    scales: {
      x: { display: false },
      y: {
        display: true,
        ticks: { color: 'var(--text3)', font: { size: 9 }, maxTicksLimit: 3, callback: v => `${f(v,0)}kW` },
        grid: { color: 'rgba(0,0,0,0.04)' },
        border: { display: false },
      }
    }
  }

  return (
    <div style={{ height: '48px', marginTop: '8px', position: 'relative', width: '100%', overflow: 'hidden' }}>
      <Line data={data} options={options} />
    </div>
  )
}

function KPICard({ sensor, history }) {
  const tc = TC[sensor.techno] || 'var(--cisco)'
  const gpuLoad = Math.min(100, sensor.gpu_usage_percent || 0)
  return (
    <div className={`kpi-card kpi-${sensor.techno}`}>
      <div className="kpi-rack">{sensor.rack_id}</div>
      <div className="kpi-val" style={{ color: tc }}>
        {f(sensor.p_it_kw, 1)}<span className="kpi-unit"> kW</span>
      </div>
      <div className="kpi-sub">
        CPU {f(sensor.cpu_temp_c, 0)}°C · GPU {f(sensor.gpu_temp_c, 0)}°C<br />
        ITEEsv {f(sensor.iteesv, 3)}
      </div>
      <div className="kpi-bar">
        <div className="kpi-fill" style={{ width: `${gpuLoad}%`, background: tc }} />
      </div>
      <PowerChart rackId={sensor.rack_id} history={history} color={tc} />
    </div>
  )
}

export default function RTPage({ rtData, referentiel }) {
  const [mix, setMix] = useState('')
  const [selectedMetric, setSelectedMetric] = useState(null)

  // Historique persisté : hydraté depuis DB au montage, puis enrichi par polling
  const history = useRTHistory(true, rtData)

  const mixList = referentiel?.mix || []

  useEffect(() => {
    if (mixList.length && !mix) setMix(mixList[0].scenario)
  }, [mixList])

  const sensors = rtData?.sensors ? Object.values(rtData.sensors) : []
  const nPts = Object.values(history)[0]?.p_it_kw?.length || 0

  return (
    <>
      {sensors.length > 0 && (
        <div className="kpi-grid fade-in">
          {sensors.map(s => (
            <KPICard key={s.rack_id} sensor={s} history={history} />
          ))}
        </div>
      )}

      <div className="card fade-in">
        <div className="sec-row">
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Tableau comparatif temps réel</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {nPts > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
                {nPts} pts · ~{Math.round(nPts * 2 / 60)} min
              </span>
            )}
            <select className="mini-sel" value={mix} onChange={e => setMix(e.target.value)}>
              {mixList.map(m => (
                <option key={m.scenario} value={m.scenario}>{m.scenario}</option>
              ))}
            </select>
          </div>
        </div>

        <RTTable
          rtData={rtData}
          mix={mix}
          onSelectMetric={row => setSelectedMetric(
            selectedMetric?.field === row.field ? null : { field: row.field, label: row.l }
          )}
          selectedMetric={selectedMetric}
        />
      </div>

      {!rtData && <div className="empty">En attente de données capteurs...</div>}

      {selectedMetric && (
        <MetricDrawer
          metric={selectedMetric}
          history={history}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </>
  )
}
