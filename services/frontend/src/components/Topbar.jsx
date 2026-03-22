import React, { useState, useEffect, useRef } from 'react'

export default function Topbar({ tab, setTab, rtData }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const sensors = rtData?.sensors ? Object.values(rtData.sensors) : []

  // Fermer le menu si clic extérieur
  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleTab = (id) => {
    setTab(id)
    setMenuOpen(false)
  }

  const TABS = [['sim', 'Simulateur'], ['rt', 'Temps Réel'], ['hist', 'Historique']]

  return (
    <div className="topbar">
      <div className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
        </div>
        <div className="logo-text">i-<span>Cooling</span></div>
        <div className="logo-sep" />
        <div className="logo-sub">Datacenter Cooling Analytics</div>
      </div>

      {/* Live badge */}
      <div className="live-badge">
        <div className="live-dot" />
        {sensors.length > 0
          ? <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
              {sensors.map(s => `${s.techno}: ${Number(s.p_it_kw).toFixed(1)}kW`).join(' · ')}
            </span>
          : <span>LIVE</span>
        }
      </div>
      
      {/* Tabs desktop */}
      <div className="tabs" style={{ marginLeft: 'auto' }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => handleTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Hamburger mobile */}
      <div ref={menuRef} className="hamburger" style={{
        marginLeft: 'auto', position: 'relative'
      }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: '36px', height: '36px', border: '1px solid var(--border)',
            borderRadius: '6px', background: menuOpen ? 'var(--cisco-light)' : 'var(--surface2)',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}
        >
          {menuOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cisco)" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <>
              <span style={{ width: '16px', height: '2px', background: 'var(--text2)', borderRadius: '1px' }}/>
              <span style={{ width: '16px', height: '2px', background: 'var(--text2)', borderRadius: '1px' }}/>
              <span style={{ width: '16px', height: '2px', background: 'var(--text2)', borderRadius: '1px' }}/>
            </>
          )}
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '44px', right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)',
            minWidth: '160px', padding: '4px', zIndex: 200,
          }}>
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => handleTab(id)}
                style={{
                  display: 'block', width: '100%', padding: '10px 14px',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                  fontSize: '13px', fontWeight: tab === id ? 600 : 400,
                  color: tab === id ? 'var(--cisco)' : 'var(--text2)',
                  background: tab === id ? 'var(--cisco-light)' : 'transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.target.style.background = tab === id ? 'var(--cisco-light)' : 'var(--surface2)'}
                onMouseLeave={e => e.target.style.background = tab === id ? 'var(--cisco-light)' : 'transparent'}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}