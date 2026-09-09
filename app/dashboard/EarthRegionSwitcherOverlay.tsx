'use client'

import { useEffect, useState } from 'react'

const EARTH_REGION_COOKIE = 'noxia-earth-region'
const SAUERLAND_REGION = 'earth-sauerland'
const NAMIBIA_REGION = 'earth-namibia-erongo'

type EarthRegionId = typeof SAUERLAND_REGION | typeof NAMIBIA_REGION

function readRegion(): EarthRegionId {
  if (typeof document === 'undefined') return SAUERLAND_REGION
  const item = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${EARTH_REGION_COOKIE}=`))
  const value = item ? decodeURIComponent(item.slice(EARTH_REGION_COOKIE.length + 1)) : SAUERLAND_REGION
  return value === NAMIBIA_REGION ? NAMIBIA_REGION : SAUERLAND_REGION
}

function selectRegion(region: EarthRegionId) {
  document.cookie = `${EARTH_REGION_COOKIE}=${encodeURIComponent(region)}; Path=/; Max-Age=31536000; SameSite=Lax`
  window.location.reload()
}

export default function EarthRegionSwitcherOverlay() {
  const [visible, setVisible] = useState(false)
  const [region, setRegion] = useState<EarthRegionId>(SAUERLAND_REGION)

  useEffect(() => {
    const sync = () => {
      setVisible(Boolean(document.querySelector('.earth-map')))
      setRegion(readRegion())
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!visible) return null

  const buttonStyle = (id: EarthRegionId): React.CSSProperties => ({
    border: 0,
    borderRadius: 6,
    padding: '7px 10px',
    background: region === id ? '#173f4d' : 'transparent',
    color: region === id ? '#fffaf0' : '#b7c9d0',
    font: '800 9px system-ui, sans-serif',
    letterSpacing: '.02em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  return (
    <div
      aria-label="Erdregion auswählen"
      style={{
        position: 'fixed',
        zIndex: 2260,
        top: 51,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 3,
        alignItems: 'center',
        padding: 3,
        border: '1px solid rgba(104,131,138,.72)',
        borderRadius: 9,
        background: 'rgba(7,17,27,.90)',
        boxShadow: '0 8px 24px rgba(0,0,0,.22)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
      }}
    >
      <button type="button" style={buttonStyle(SAUERLAND_REGION)} onClick={() => selectRegion(SAUERLAND_REGION)}>
        Deutschland · Sauerland
      </button>
      <button type="button" style={buttonStyle(NAMIBIA_REGION)} onClick={() => selectRegion(NAMIBIA_REGION)}>
        Namibia · Erongo
      </button>
    </div>
  )
}
