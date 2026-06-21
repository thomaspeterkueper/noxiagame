// app/dashboard/LandingOverlay.tsx
// Erstellt:     21.06.2026
// Aktualisiert: 21.06.2026
// Version:      1.0.0
//
// Landeplatz-Overlay — öffnet sich beim Klick auf landing_pad im Grid.
// Zeigt Sonnensystem-Karte + Reiseziele mit Energiekosten + Flug-Button.
// Ersetzt die Fliegen-Buttons im Dashboard-Kolonien-Tab.

'use client'

import { useState } from 'react'
import { LOC_ICON, LOC_NAME } from './ui'
import { flightEnergyCost } from '@/lib/game/ships'
import { orbitalBaseSeconds } from '@/lib/game/orbits'
import SolarSystem from './SolarSystem'

interface LandingOverlayProps {
  currentLocation: string
  locations:       { slug: string; name: string; population: number }[]
  cargo:           Record<string, number>
  shipRange:       number
  currentTick:     number
  inTransit:       boolean
  onTravel:        (dest: string) => void
  onClose:         () => void
}

export default function LandingOverlay({
  currentLocation, locations, cargo, shipRange,
  currentTick, inTransit, onTravel, onClose,
}: LandingOverlayProps) {
  const [showMap, setShowMap] = useState(false)

  const energyOnBoard = cargo['energy'] ?? 0

  // Reiseziele = alle Stationen außer aktueller
  const destinations = locations.filter(l => l.slug !== currentLocation)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#0d1a26', border: '1px solid #2a4e7a', borderRadius: '14px',
        width: showMap ? 'min(720px, 98vw)' : 'min(480px, 95vw)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 48px rgba(0,0,0,0.7)', fontFamily: "'Courier Prime', monospace",
        color: '#cdd6e0', overflow: 'hidden', transition: 'width 0.3s ease',
      }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', background: '#0a1520', borderBottom: '1px solid rgba(42,78,122,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#5aaeff', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase' }}>
              🛸 Landeplatz · {LOC_NAME[currentLocation] ?? currentLocation}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#cdd6e0', marginTop: '2px' }}>
              Abflugkontrolle
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', background: energyOnBoard >= 8 ? 'rgba(95,218,165,0.15)' : 'rgba(231,76,60,0.15)', color: energyOnBoard >= 8 ? '#5dcaa5' : '#e74c3c' }}>
              ⚡ {energyOnBoard}t Energie
            </div>
            <button
              onClick={() => setShowMap(m => !m)}
              style={{ background: showMap ? 'rgba(42,78,122,0.4)' : 'transparent', border: '1px solid #2a4e7a', color: '#8ab0d0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.65rem', cursor: 'pointer' }}
            >
              {showMap ? 'Karte ausblenden' : '🌌 Karte'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
        </div>

        {/* Sonnensystem-Karte */}
        {showMap && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(42,78,122,0.3)', background: '#070b14' }}>
            <SolarSystem
              currentTick={currentTick}
              shipRange={shipRange}
              currentLocation={currentLocation}
            />
          </div>
        )}

        {/* Reiseziele */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#2a4e7a', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Reiseziele
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {destinations.map(loc => {
              const energyCost   = flightEnergyCost(currentLocation, loc.slug)
              const travelSecs   = orbitalBaseSeconds(currentLocation, loc.slug, currentTick)
              const reachable    = travelSecs != null && travelSecs <= shipRange
              const hasEnergy    = energyOnBoard >= energyCost
              const canFly       = reachable && hasEnergy && !inTransit

              return (
                <div key={loc.slug} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: canFly ? 'rgba(42,78,122,0.2)' : 'rgba(42,78,122,0.08)',
                  border: `1px solid ${canFly ? '#2a4e7a' : '#1a2a3a'}`,
                  borderRadius: '8px', opacity: reachable ? 1 : 0.5,
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: canFly ? '#cdd6e0' : '#5a7a9a' }}>
                      {LOC_ICON[loc.slug] ?? '🪐'} {loc.name}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '3px', fontSize: '0.65rem', color: '#5a7a9a' }}>
                      {travelSecs != null && (
                        <span>⏱ {travelSecs}s</span>
                      )}
                      <span style={{ color: hasEnergy ? '#5dcaa5' : '#e74c3c' }}>
                        ⚡ {energyCost}t
                        {!hasEnergy && ` (fehlt ${energyCost - energyOnBoard}t)`}
                      </span>
                      {!reachable && travelSecs != null && (
                        <span style={{ color: '#e74c3c' }}>außer Reichweite</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (canFly) { onTravel(loc.slug); onClose() } }}
                    disabled={!canFly}
                    style={{
                      background: canFly ? '#2a4e7a' : '#1a2a3a',
                      color: canFly ? '#c9a961' : '#3a5a7a',
                      border: `1px solid ${canFly ? '#c9a961' : '#2a3a4a'}`,
                      borderRadius: '6px', padding: '0.5rem 1rem',
                      fontSize: '0.75rem', fontWeight: 700,
                      cursor: canFly ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {inTransit ? 'Im Flug …' : 'Fliegen →'}
                  </button>
                </div>
              )
            })}
          </div>

          {destinations.length === 0 && (
            <div style={{ color: '#5a7a9a', fontSize: '0.8rem', padding: '1rem 0' }}>
              Keine weiteren Stationen bekannt.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid rgba(42,78,122,0.3)', fontSize: '0.58rem', color: '#2a4e7a', textAlign: 'center' }}>
          Energie wird beim Abflug aus dem Laderaum entnommen
        </div>
      </div>
    </div>
  )
}
