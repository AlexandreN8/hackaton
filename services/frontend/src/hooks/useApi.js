import { useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export function useReferentiel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`${API}/referentiel`).then(r => r.json()).then(setData).catch(() => {})
  }, [])
  return data
}

export function useCalculate() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const calculate = async (payload) => {
    setLoading(true)
    try {
      const d = await fetch(`${API}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json())
      setResults(d.resultats || [])
      setLoading(false)
      return d.resultats || []
    } catch (e) {
      setLoading(false)
      return []
    }
  }

  return { results, loading, calculate }
}

export function useRT(enabled) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!enabled) return
    const poll = () => fetch(`${API}/rt/latest`).then(r => r.json()).then(setData).catch(() => {})
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [enabled])
  return data
}

// ── Historique RT persisté en DB ──────────────────────────────────────────
// Au montage : charge l'historique depuis /rt/history (DB)
// Ensuite : accumule les nouveaux points en mémoire via polling

const FIELDS = [
  'p_it_kw', 'cpu_usage_percent', 'cpu_temp_c',
  'gpu_usage_percent', 'gpu_temp_c', 'hbm_temp_c',
  'room_temp_c', 'iteesv'
]
const MAX_POINTS = 1800 // 1h à 2s/point

// Mapping champ sensor : champ processed_rt pour l'hydratation depuis DB
const DB_FIELDS = {
  p_it_kw:              'p_it_kw',
  cpu_usage_percent:    'cpu_usage_percent',
  cpu_temp_c:           'cpu_temp_c',
  gpu_usage_percent:    'gpu_usage_percent',
  gpu_temp_c:           'gpu_temp_c',
  hbm_temp_c:           'hbm_temp_c',
  room_temp_c:          'room_temp_c',
}

export function useRTHistory(enabled, rtData) {
  const historyRef = useRef({})
  const [history, setHistory] = useState({})
  const hydrated = useRef(false)

  // 1. Au montage — tente d'hydrater depuis /rt/history (DB)
  // Si ça échoue on continue silencieusement avec le polling
  useEffect(() => {
    if (!enabled || hydrated.current) return
    hydrated.current = true // marquer immédiatement pour ne pas bloquer

    fetch(`${API}/rt/history?window=1h`)
      .then(r => r.json())
      .then(d => {
        const rows = d.data || []
        if (!rows.length) return

        const next = {}
        // Grouper par rack_id — un point par timestamp unique
        const seen = {}
        rows.forEach(row => {
          const rackId = row.rack_id
          const ts = row.timestamp_heure
          const key = `${rackId}_${ts}`
          if (seen[key]) return // dédupliquer les lignes multi-mix
          seen[key] = true

          if (!next[rackId]) next[rackId] = {}
          Object.entries(DB_FIELDS).forEach(([field, dbField]) => {
            if (!next[rackId][field]) next[rackId][field] = []
            const v = row[dbField]
            if (v != null) next[rackId][field].push(v)
          })
        })

        // Limiter à MAX_POINTS
        Object.keys(next).forEach(rackId =>
          Object.keys(next[rackId]).forEach(field => {
            next[rackId][field] = next[rackId][field].slice(-MAX_POINTS)
          })
        )

        historyRef.current = next
        setHistory({ ...next })
      })
      .catch(() => {}) // échec silencieux — le polling prend le relais
  }, [enabled])

  // 2. À chaque nouveau poll RT — ajoute en mémoire
  useEffect(() => {
    if (!rtData?.sensors) return

    const next = { ...historyRef.current }
    Object.values(rtData.sensors).forEach(sensor => {
      const id = sensor.rack_id
      if (!next[id]) next[id] = {}
      FIELDS.forEach(field => {
        if (!next[id][field]) next[id][field] = []
        const v = sensor[field]
        if (v != null) {
          next[id][field] = [...next[id][field], v].slice(-MAX_POINTS)
        }
      })
    })

    historyRef.current = next
    setHistory({ ...next })
  }, [rtData])

  return history
}

export function useHistory(enabled) {
  const [data, setData] = useState([])
  useEffect(() => {
    if (!enabled) return
    fetch(`${API}/history?limit=25`)
      .then(r => r.json())
      .then(d => setData(d.history || []))
      .catch(() => {})
  }, [enabled])
  return data
}

export function useStreamReco(payload, trigger) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    if (!trigger || !payload) return
    setText('')
    setStreaming(true)
    const ctrl = new AbortController()

    fetch(`${API}/stream-reco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    }).then(res => {
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      const read = () => reader.read().then(({ done, value }) => {
        if (done) { setStreaming(false); return }
        dec.decode(value).split('\n').forEach(line => {
          if (line.startsWith('data: ')) {
            const d = line.slice(6)
            if (d !== '[DONE]') setText(p => p + d)
          }
        })
        read()
      })
      read()
    }).catch(() => setStreaming(false))

    return () => ctrl.abort()
  }, [trigger])

  return { text, streaming }
}