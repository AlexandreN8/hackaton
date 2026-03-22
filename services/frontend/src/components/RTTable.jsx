import React from 'react'
import { TC, f } from '../constants.js'

const SENSOR_ROWS = [
  { l: 'Densité (kW)',  g: r => r.p_it_kw,            field: 'p_it_kw',           low: false },
  { l: 'CPU usage %',  g: r => r.cpu_usage_percent,   field: 'cpu_usage_percent', low: false },
  { l: 'CPU temp °C',  g: r => r.cpu_temp_c,          field: 'cpu_temp_c',        low: true  },
  { l: 'GPU usage %',  g: r => r.gpu_usage_percent,   field: 'gpu_usage_percent', low: false },
  { l: 'GPU temp °C',  g: r => r.gpu_temp_c,          field: 'gpu_temp_c',        low: true  },
  { l: 'HBM temp °C',  g: r => r.hbm_temp_c,          field: 'hbm_temp_c',        low: true  },
  { l: 'Room temp °C', g: r => r.room_temp_c,         field: 'room_temp_c',       low: true  },
  { l: 'ITEEsv',       g: r => r.iteesv,              field: 'iteesv',            low: false },
]

const CALC_ROWS = [
  { l: 'PUE calculé',  g: (r, gM) => gM(r, 'pue_calcule'), low: true  },
  { l: 'WUE',          g: (r, gM) => gM(r, 'wue_calcule'), low: true  },
  { l: 'ERF',          g: (r, gM) => gM(r, 'erf_calcule'), low: false },
]

function SensorRow({ row, racks, onSelect, selected }) {
  const vals = racks.map(r => ({ r, v: row.g(r) })).filter(x => x.v != null)
  const best = vals.length ? (row.low ? Math.min : Math.max)(...vals.map(x => x.v)) : null
  const isSelected = selected?.field === row.field

  return (
    <tr
      onClick={() => onSelect(row)}
      style={{
        cursor: 'pointer',
        background: isSelected ? 'var(--cisco-light)' : undefined,
        transition: 'background .1s',
      }}
    >
      <td className="metric-lbl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {row.l}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"
          style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.35 }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </td>
      {racks.map(r => {
        const v = row.g(r)
        const isBest = v != null && v === best
        return (
          <td key={r.rack_id} className={isBest ? 'td-best' : ''}>
            {v == null ? '—' : f(v, 2)}
          </td>
        )
      })}
    </tr>
  )
}

function CalcRow({ row, racks, gM }) {
  const vals = racks.map(r => ({ r, v: row.g(r, gM) })).filter(x => x.v != null)
  const best = vals.length ? (row.low ? Math.min : Math.max)(...vals.map(x => x.v)) : null
  return (
    <tr>
      <td className="metric-lbl">{row.l}</td>
      {racks.map(r => {
        const v = row.g(r, gM)
        return (
          <td key={r.rack_id} className={v != null && v === best ? 'td-best' : ''}>
            {v == null ? '—' : f(v, 2)}
          </td>
        )
      })}
    </tr>
  )
}

export default function RTTable({ rtData, mix, onSelectMetric, selectedMetric }) {
  if (!rtData?.sensors) return <div className="empty">En attente de données capteurs...</div>

  const racks = Object.values(rtData.sensors)
  const gM = (rack, field) =>
    rtData.metrics?.find(x => x.techno === rack.techno && x.mix_scenario === mix)?.[field]

  return (
    <div className="tbl-wrap">
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>
        Cliquez sur une ligne pour voir son historique en détail
      </div>
      <table>
        <thead>
          <tr>
            <th>Métrique</th>
            {racks.map(r => (
              <th key={r.rack_id}>
                <span style={{ color: TC[r.techno] || 'inherit', fontWeight: 700 }}>{r.techno}</span>
                <br />
                <span style={{ fontSize: '9px', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {r.rack_id}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SENSOR_ROWS.map(row => (
            <SensorRow
              key={row.l}
              row={row}
              racks={racks}
              onSelect={onSelectMetric}
              selected={selectedMetric}
            />
          ))}
          <tr className="sep-row">
            <td colSpan={racks.length + 1}>Métriques calculées</td>
          </tr>
          {CALC_ROWS.map(row => (
            <CalcRow key={row.l} row={row} racks={racks} gM={gM} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
