'use client'

// app/_components/MusicControls.tsx
// Floating Music-Controller for non-dashboard pages. The dashboard cockpit
// consumes the same MusicProvider directly and suppresses this global chrome.

import { useState } from 'react'
import { useMusicContext } from './MusicProvider'

export default function MusicControls() {
  const { playing, volume, toggle, setVolume } = useMusicContext()
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="noxia-global-music-controls"
      data-noxia-role="global-music-controls"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.5rem',
      }}
    >
      {expanded && (
        <div style={{
          background: 'rgba(10,18,28,0.92)',
          border: '1px solid rgba(42,78,122,0.4)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <span style={{ fontSize: '0.55rem', color: 'rgba(201,169,97,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Lautstärke
          </span>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            style={{ width: '80px', accentColor: '#c9a961', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.55rem', color: 'rgba(200,212,224,0.5)' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          title="Lautstärke"
          style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: 'rgba(10,18,28,0.85)',
            border: '1px solid rgba(42,78,122,0.4)',
            color: 'rgba(201,169,97,0.7)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {expanded ? '✕' : '🎛️'}
        </button>

        <button
          onClick={toggle}
          title={playing ? 'Musik pausieren' : 'Musik abspielen'}
          style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: playing ? 'rgba(42,78,122,0.9)' : 'rgba(10,18,28,0.85)',
            border: `1px solid ${playing ? 'rgba(201,169,97,0.6)' : 'rgba(42,78,122,0.4)'}`,
            color: playing ? '#c9a961' : 'rgba(200,212,224,0.5)',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  )
}
