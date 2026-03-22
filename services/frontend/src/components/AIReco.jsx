import React from 'react'

export default function AIReco({ text, streaming }) {
  return (
    <div className="card fade-in">
      <div className="sec-hd" style={{ marginBottom: '10px' }}>Recommandation IA</div>
      <div className="ai-box">
        <div className="ai-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 4a1 1 0 100 2 1 1 0 000-2zm0 4a1 1 0 00-1 1v5a1 1 0 002 0v-5a1 1 0 00-1-1z"/>
          </svg>
          Analyse IA
        </div>
        <div>
          {text || (!streaming && <span style={{ color: 'var(--text3)' }}>Lance un calcul pour obtenir une recommandation.</span>)}
          {streaming && <span className="ai-cursor" />}
        </div>
      </div>
    </div>
  )
}
