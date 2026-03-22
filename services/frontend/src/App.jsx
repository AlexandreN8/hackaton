import React, { useState } from 'react'
import Topbar from './components/Topbar.jsx'
import SimPage from './components/SimPage.jsx'
import RTPage from './components/RTPage.jsx'
import HistPage from './components/HistPage.jsx'
import { useReferentiel, useCalculate, useRT, useHistory, useStreamReco } from './hooks/useApi.js'

export default function App() {
  const [tab, setTab] = useState('sim')
  const [aiTrigger, setAiTrigger] = useState(0)
  const [aiPayload, setAiPayload] = useState(null)

  const referentiel = useReferentiel()
  const { results, loading, calculate } = useCalculate()
  const rtData  = useRT(tab === 'rt')
  const history = useHistory(tab === 'hist')
  const { text: aiText, streaming: aiStreaming } = useStreamReco(aiPayload, aiTrigger)

  const handleCalculate = async (payload) => {
    await calculate(payload)
    setAiPayload(payload)
    setAiTrigger(t => t + 1)
  }

  return (
    <div className="layout">
      <Topbar tab={tab} setTab={setTab} rtData={rtData} />
      <div className="main">
        {tab === 'sim'  && <SimPage  referentiel={referentiel} results={results} loading={loading} onCalculate={handleCalculate} aiText={aiText} aiStreaming={aiStreaming} />}
        {tab === 'rt'   && <RTPage   rtData={rtData} referentiel={referentiel} />}
        {tab === 'hist' && <HistPage history={history} />}
      </div>
    </div>
  )
}
