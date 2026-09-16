'use client'

// DashboardGate.tsx
// Aktualisiert: 16.09.2026 — BUGFIX: Onboarding-Gate vor die Spieloberfläche
// gezogen. Vorher prüfte nur DashboardClient (tief im Baum) profile.onboarded
// und zeigte WelcomeSetup als Overlay — DashboardMoonSurface & Co. liefen
// aber als Geschwisterkomponenten bereits mit und konnten das Overlay
// optisch verdecken (sichtbar geworden durch den Mond-Standort-Bug vom
// selben Tag, s. Commit d6f6c5d + DB-Migration
// fix_new_player_starting_location_earth_not_moon). Jetzt: profiles.onboarded
// wird HIER zuerst geprüft; bei false wird ausschließlich WelcomeSetup
// gerendert, nichts vom eigentlichen Spiel mountet vorher.
// Vorher: 15.09.2026 — Profil-Cockpit öffnet das vollständige Profil
// Version:      0.7.0
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

  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [existingUsername, setExistingUsername] = useState<string | undefined>(undefined)
  const [autoOpenJourney, setAutoOpenJourney] = useState(false)

  useEffect(() => {
    loadFromServer()
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setOnboarded(Boolean(data?.profile?.onboarded))
        setExistingUsername(data?.profile?.username || undefined)
      } catch {
        // Bei Fehlschlag lieber nicht blockieren als einen Spieler dauerhaft aussperren.
        setOnboarded(true)
      }
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
    <DashboardMoonSurface />
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
    <EarthRegionSwitcherOverlay />
  </>
}
