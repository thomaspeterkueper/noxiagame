'use client'

// app/dashboard/StationTravelDock.tsx
// Erstellt:     23.06.2026
// Aktualisiert: 29.09.2026 — gemeinsame Transferquote + Navigationswissen
// Version:      0.3.0

import { useEffect, useState } from 'react'
import { transferQuote } from '@/lib/game/transfer'
import { navigationKnowledgeLabel, navigationProficiencyFromUnlocks } from '@/lib/knowledge/navigationProficiency'
import { getToken } from '@/lib/supabase/auth'
import { LOC_ICON, LOC_NAME } from './ui'

interface StationTravelDockProps {
  currentLocation: string
  locations: { slug: string; name: string; population?: number; location_type?: string }[]
  cargo: Record<string, number>
  shipRange: number
  currentTick: number
  inTransit: boolean
  onTravel: (dest: string) => void
  journeyDestination?: string
}

export default function StationTravelDock({
  currentLocation,
  locations,
  cargo,
  shipRange,
  currentTick,
  inTransit,
  onTravel,
  journeyDestination,
}: StationTravelDockProps) {
  const energyOnBoard = cargo.energy ?? 0
  const destinations = locations.filter(l => l.slug !== currentLocation)
  const [navigationProficiency, setNavigationProficiency] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadNavigationKnowledge() {
      try {
        const token = await getToken()
        const res = await fetch('/api/game/unlocks', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json() as { unlocks?: string[] }
        if (!cancelled) setNavigationProficiency(navigationProficiencyFromUnlocks(data.unlocks ?? []))
      } catch {
        // Fail closed: preview falls back to base transfer values.
      }
    }
    void loadNavigationKnowledge()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      background: '#0d1a26',
      border: '1px solid rgba(42,78,122,0.55)',
      borderRadius: '12px',
      padding: '0.9rem 1rem',
      color: '#cdd6e0',
      fontFamily: "'Courier Prime', monospace",
      boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.64rem', color: '#c9a961', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>
            🛸 Raumhafen / Abflugkontrolle
          </div>
          <div style={{ marginTop: '3px', fontSize: '0.72rem', color: '#5a7a9a' }}>
            Aktives Schiff am Standort {LOC_NAME[currentLocation] ?? currentLocation}
          </div>
          <div style={{ marginTop: '3px', fontSize: '0.58rem', color: '#6f8194' }}>
            Navigation: {navigationKnowledgeLabel(navigationProficiency)} · Effizienz {Math.round(navigationProficiency * 100)}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.62rem', padding: '3px 9px', borderRadius: '999px', background: energyOnBoard > 0 ? 'rgba(95,218,165,0.12)' : 'rgba(231,76,60,0.12)', color: energyOnBoard > 0 ? '#5dcaa5' : '#e74c3c', border: `1px solid ${energyOnBoard > 0 ? 'rgba(95,218,165,0.2)' : 'rgba(231,76,60,0.22)'}` }}>
            ⚡ {energyOnBoard}t Energie
          </span>
          <span style={{ fontSize: '0.62rem', padding: '3px 9px', borderRadius: '999px', background: 'rgba(42,78,122,0.22)', color: '#8ab0d0', border: '1px solid rgba(42,78,122,0.35)' }}>
            Reichweite {shipRange} Dist.
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
        {destinations.map(loc => {
          const quote = transferQuote(currentLocation, loc.slug, currentTick, { navigationProficiency })
          const travelSecs = quote?.durationSeconds ?? null
          const energyCost = quote?.energy ?? Number.POSITIVE_INFINITY
          const routeDistance = quote?.distance ?? Number.POSITIVE_INFINITY
          const reachable = !!quote && routeDistance <= shipRange
          const hasEnergy = Number.isFinite(energyCost) && energyOnBoard >= energyCost
          const canFly = reachable && hasEnergy && !inTransit

          const isJourneyTarget = journeyDestination === loc.slug
          return (
            <div key={loc.slug} style={{
              background: isJourneyTarget ? 'rgba(201,169,97,0.12)' : canFly ? 'rgba(42,78,122,0.24)' : 'rgba(42,78,122,0.08)',
              border: `1px solid ${isJourneyTarget ? '#c9a961' : canFly ? 'rgba(90,174,255,0.38)' : 'rgba(42,78,122,0.22)'}`,
              borderRadius: '8px',
              padding: '0.65rem 0.75rem',
              opacity: reachable ? 1 : 0.55,
              boxShadow: isJourneyTarget ? '0 0 12px rgba(201,169,97,0.25)' : 'none',
            }}>
              {isJourneyTarget && (
                <div style={{ fontSize: '0.55rem', color: '#c9a961', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>
                  ▶ Nächstes Ziel
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: canFly ? '#d8e6f4' : '#6f8194', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {LOC_ICON[loc.slug] ?? '🪐'} {LOC_NAME[loc.slug] ?? loc.name ?? loc.slug}
                  </div>
                  <div style={{ marginTop: '3px', display: 'flex', gap: '0.65rem', flexWrap: 'wrap', fontSize: '0.58rem', color: '#5a7a9a' }}>
                    <span>⏱ {travelSecs ?? '—'}s</span>
                    <span style={{ color: hasEnergy ? '#5dcaa5' : '#e74c3c' }}>⚡ {Number.isFinite(energyCost) ? energyCost : '—'}t</span>
                    <span>↔ {Number.isFinite(routeDistance) ? routeDistance.toFixed(1) : '—'} Dist.</span>
                  </div>
                </div>
                <button
                  disabled={!canFly}
                  onClick={() => onTravel(loc.slug)}
                  style={{
                    border: `1px solid ${canFly ? '#c9a961' : '#24384d'}`,
                    background: canFly ? 'rgba(201,169,97,0.12)' : 'transparent',
                    color: canFly ? '#c9a961' : '#46586b',
                    borderRadius: '6px',
                    padding: '0.35rem 0.55rem',
                    cursor: canFly ? 'pointer' : 'not-allowed',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    fontFamily: "'Courier Prime', monospace",
                    flexShrink: 0,
                  }}
                >
                  Start
                </button>
              </div>
              {!quote && <div style={{ marginTop: '5px', fontSize: '0.55rem', color: '#e8702a' }}>Kein Transfermodell verfügbar</div>}
              {quote && !reachable && <div style={{ marginTop: '5px', fontSize: '0.55rem', color: '#e8702a' }}>Außer Reichweite</div>}
              {reachable && !hasEnergy && <div style={{ marginTop: '5px', fontSize: '0.55rem', color: '#e74c3c' }}>Energie fehlt: {Math.max(0, energyCost - energyOnBoard)}t</div>}
              {isJourneyTarget && reachable && hasEnergy && currentLocation === 'earth' && (
                <div style={{ marginTop: '6px', fontSize: '0.54rem', color: '#8ab0d0', lineHeight: 1.45 }}>
                  Erdgravitation setzt einen festen Energie-Sockel; Navigationswissen optimiert nur den Transferanteil.
                </div>
              )}
              {inTransit && <div style={{ marginTop: '5px', fontSize: '0.55rem', color: '#e8702a' }}>Schiff im Transit</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
