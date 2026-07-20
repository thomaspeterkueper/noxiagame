'use client'

// DashboardGate.tsx
// Aktualisiert: 04.07.2026 — Header ergänzt; Auth-Gate
// Version:      0.1.0
import React, { useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import DashboardClient from './DashboardClient'
import { T } from './ui'

export default function DashboardGate({ locations, prices, orders }: { locations: any[]; prices: any[]; orders: any[] }) {
  const loaded = useGameStore(s => s.loaded)
  const loadFromServer = useGameStore(s => s.loadFromServer)

  useEffect(() => {
    loadFromServer()
  }, [loadFromServer])

  if (!loaded) {
    return (
      <main style={{ minHeight: '100vh', background: T.bg, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', color: T.blue, fontSize: '1.4rem', letterSpacing: '0.14em' }}>noχ¹ᐃ</div>
          <div style={{ marginTop: 10, color: T.inkFaint, fontSize: '0.8rem' }}>Lade aktuellen Standort …</div>
        </div>
      </main>
    )
  }

  return <DashboardClient locations={locations} prices={prices} orders={orders} />
}
