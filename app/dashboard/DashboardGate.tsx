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
      // BUGFIX 16.09.2026: Direkt nach einem harten Reload (z.B. Regionswechsel
      // in EarthRegionSwitcherOverlay.tsx) ist die Supabase-Session manchmal
      // noch nicht sofort verfuegbar; /api/game/profile antwortet dann kurz
      // mit 401 statt mit dem Profil. Vorher wurde ein fehlendes profile.onboarded
      // faelschlich als "false" gelesen -> Onboarding erschien erneut, obwohl
      // der Account laengst onboarded war. Jetzt: bei Fehlschlag bis zu 3x mit
      // kurzer Pause erneut versuchen, statt sofort false anzunehmen.
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
          // weiter zum naechsten Versuch
        }
        await new Promise(r => setTimeout(r, 400))
      }
      // Alle Versuche fehlgeschlagen: nicht aussperren, aber auch nicht
      // faelschlich das Onboarding erneut zeigen.
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
