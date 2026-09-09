'use client'

// DashboardGate.tsx
// Aktualisiert: 09.09.2026 — Earth-Interaktionen und globale Erdregion-Auswahl
// Version:      0.5.8
import React, { useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
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
import EarthInteractionManager from './EarthInteractionManager'
import EarthRegionSwitcherOverlay from './EarthRegionSwitcherOverlay'
import { T } from './ui'

export default function DashboardGate({ locations, prices, orders }: { locations: any[]; prices: any[]; orders: any[] }) {
  const loaded = useGameStore(s => s.loaded)
  const loadFromServer = useGameStore(s => s.loadFromServer)

  useEffect(() => {
    loadFromServer()
  }, [loadFromServer])

  if (!loaded) {
    return (
      <main style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', color: T.blue, fontSize: '1.4rem', letterSpacing: '0.14em' }}>noχ¹ᐃ</div>
          <div style={{ marginTop: 10, color: T.inkFaint, fontSize: '0.8rem' }}>Lade aktuellen Standort …</div>
        </div>
      </main>
    )
  }

  return <>
    <DashboardClient locations={locations} prices={prices} orders={orders} />
    <DashboardHudManager />
    <DashboardLocationDockManager />
    <DashboardTopbarManager />
    <DashboardCockpit />
    <DashboardCockpitPolish />
    <DashboardShipPanelPolish />
    <DashboardCockpitResponsive />
    <DashboardContextManager />
    <DashboardFeedOverlay />
    <EarthInteractionManager />
    <EarthRegionSwitcherOverlay />
  </>
}
