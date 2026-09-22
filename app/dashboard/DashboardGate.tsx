'use client'

// DashboardGate.tsx
// Aktualisiert: 22.09.2026 — Earth-Navigation strikt auf den Earth-Kontext begrenzen
// Version:      0.7.2
import React, { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import DashboardClient from './DashboardClient'
import DashboardHudManager from './DashboardHudManager'
import DashboardLocationDockManager from './DashboardLocationDockManager'
import DashboardTopbarManager from './DashboardTopbarManager'
import DashboardCockpit from './DashboardCockpit'
import DashboardCockpitPolish from './DashboardCockpitPolish'
import DashboardShipPanelPolish from './DashboardShipPanelPolish'
import DashboardCockpitResponsive from './DashboardCockpitResponsive'
import DashboardContextManager from './DashboardContextManager'
import DashboardFeedOverlay from './DashboardFeedOverlay'
import DashboardWorldDevelopmentOverlay from './DashboardWorldDevelopmentOverlay'
import DashboardMoonSurface from './DashboardMoonSurface'
import DashboardProfileBridge from './DashboardProfileBridge'
import EarthInteractionManager from './EarthInteractionManager'
import EarthRegionSwitcherOverlay from './EarthRegionSwitcherOverlay'
import EarthOrbitFlightPanel from './EarthOrbitFlightPanel'
import WelcomeSetup from './WelcomeSetup'
import { T } from './ui'

function LoadingScreen({ label }: { label: string }) {
  return (
    <main style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', color: T.blue, fontSize: '1.4rem', letterSpacing: '0.14em' }}>noχ¹ᐃ</div>
        <div style={{ marginTop: 10, color: T.inkFaint, fontSize: '0.8rem' }}>{label}</div>
      </div>
    </main>
  )
}

export default function DashboardGate({ locations, prices, orders }: { locations: any[]; prices: any[]; orders: any[] }) {
  const loaded = useGameStore(s => s.loaded)
  const loadFromServer = useGameStore(s => s.loadFromServer)
  const location = useGameStore(s => s.location)

  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [existingUsername, setExistingUsername] = useState<string | undefined>(undefined)
  const [autoOpenJourney, setAutoOpenJourney] = useState(false)

  useEffect(() => {
    loadFromServer()
    ;(async () => {
      // Direkt nach einem harten Reload kann die Supabase-Session kurz fehlen.
      // Nicht vorschnell erneut ins Onboarding schicken.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const token = await getToken()
          const res = await fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json()
          if (res.ok && data?.profile) {
            setOnboarded(Boolean(data.profile.onboarded))
            setExistingUsername(data.profile.username || undefined)
            return
          }
        } catch {
          // weiter zum nächsten Versuch
        }
        await new Promise(r => setTimeout(r, 400))
      }
      setOnboarded(true)
    })()
  }, [loadFromServer])

  if (onboarded === null) {
    return <LoadingScreen label="Lade Profil …" />
  }

  if (!onboarded) {
    return <WelcomeSetup initialUsername={existingUsername} onDone={(opts) => { setOnboarded(true); if (opts?.openJourney) setAutoOpenJourney(true) }} />
  }

  if (!loaded) {
    return <LoadingScreen label="Lade aktuellen Standort …" />
  }

  return <>
    <DashboardClient locations={locations} prices={prices} orders={orders} autoOpenJourney={autoOpenJourney} />
    <DashboardMoonSurface locations={locations} prices={prices} orders={orders} />
    <DashboardProfileBridge />
    <DashboardHudManager />
    <DashboardLocationDockManager />
    <DashboardTopbarManager />
    <DashboardCockpit />
    <DashboardCockpitPolish />
    <DashboardShipPanelPolish />
    <DashboardCockpitResponsive />
    <DashboardContextManager />
    <DashboardFeedOverlay />
    <DashboardWorldDevelopmentOverlay />
    <EarthInteractionManager />
    {location === 'earth' && <EarthRegionSwitcherOverlay />}
    <EarthOrbitFlightPanel />
  </>
}
