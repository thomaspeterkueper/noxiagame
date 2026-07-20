'use client'

// app/dashboard/ShipyardOverlay.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 01.06.2026
// Version:      0.1.0
//
// Werft als betretbarer Ort (Overlay) statt Inline-Box im Übersicht-Tab.
// Öffnet sich per Klick auf "Werft betreten" — nur sichtbar/aktiv wenn
// die aktuelle Kolonie eine Werft hat (location === 'moon' && has_shipyard).
//
// Zeigt die Schiffstypen aus der ship_types-Tabelle als Karten:
//   freighter_mk1 (Startschiff), fast_courier, heavy_hauler
// Kauf läuft über das bestehende /api/game/ships?action=buy&shipTypeId=...
// (im Parent als onBuyShip-Callback durchgereicht, wie in ShipyardCard).
//
// Reine Anzeige + Kauf-Callback. Kein eigener Loop.
// Die Schiffsdaten sind hier statisch gespiegelt (config.ts / ship_types);
// für Live-Daten könnt ihr sie alternativ aus /api/game/ships laden.

import React from 'react'

interface ShipType {
  id: string
  name: string
  cost: number
  cargoMax: number
  speedMult: number
  desc: string
}

// Gespiegelt aus ship_types / GDD-Schiffstypen-Tabelle
const SHIP_TYPES: ShipType[] = [
  { id: 'freighter_mk1', name: 'Frachter Mk.I', cost: 0,     cargoMax: 100, speedMult: 1.0,  desc: 'Robustes Startschiff. Ausgewogen, kein Schnickschnack.' },
  { id: 'fast_courier',  name: 'Schnellfrachter', cost: 8000,  cargoMax: 60,  speedMult: 1.7,  desc: '40% schneller, aber weniger Laderaum. Für Arbitrage über kurze Routen.' },
  { id: 'heavy_hauler',  name: 'Schwerfrachter', cost: 15000, cargoMax: 200, speedMult: 0.77, desc: 'Doppelter Laderaum, dafür träge. Für Großlieferungen an hungrige Kolonien.' },
]

export default function ShipyardOverlay({
  open,
  onClose,
  currentShipTypeId,
  credits,
  onBuyShip,        // (shipTypeId) => Promise<void> — nutzt /api/game/ships?action=buy
}: {
  open: boolean
  onClose: () => void
  currentShipTypeId: string
  credits: number
  onBuyShip: (shipTypeId: string) => Promise<void>
}) {
  if (!open) return null

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '720px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(201,169,97,0.3)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: '#c9a961' }}>🌙 Werft Shackleton</div>
            <div style={{ fontSize: '0.72rem', color: '#7d93b0' }}>Verfügbares Guthaben: {credits.toLocaleString('de')} Cr</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid #2a4e7a', color: '#cfe0f5', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>Verlassen ✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {SHIP_TYPES.map(ship => {
            const owned = ship.id === currentShipTypeId
            const affordable = credits >= ship.cost
            const isStarter = ship.cost === 0
            return (
              <div key={ship.id} style={{
                background: '#0a1420',
                border: `${owned ? '2px' : '0.5px'} solid ${owned ? '#c9a961' : '#1f3650'}`,
                borderRadius: '10px', padding: '14px',
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cfe0f5', marginBottom: '2px' }}>{ship.name}</div>
                {owned && <div style={{ fontSize: '0.62rem', color: '#c9a961', marginBottom: '8px' }}>● Aktuelles Schiff</div>}
                {!owned && <div style={{ height: '8px' }} />}

                <div style={{ fontSize: '0.7rem', color: '#9fb4cf', lineHeight: 1.5, marginBottom: '10px', minHeight: '52px' }}>{ship.desc}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.68rem', color: '#7d93b0', marginBottom: '12px', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Laderaum</span><span style={{ color: '#cfe0f5' }}>{ship.cargoMax}t</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tempo</span><span style={{ color: '#cfe0f5' }}>{ship.speedMult}×</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Preis</span><span style={{ color: '#c9a961' }}>{isStarter ? '—' : ship.cost.toLocaleString('de') + ' Cr'}</span></div>
                </div>

                <button
                  disabled={owned || isStarter || !affordable}
                  onClick={() => onBuyShip(ship.id)}
                  style={{
                    width: '100%', padding: '8px 0', borderRadius: '7px', cursor: owned || isStarter || !affordable ? 'default' : 'pointer',
                    border: `0.5px solid ${owned || isStarter || !affordable ? '#1f3650' : '#c9a961'}`,
                    background: owned || isStarter || !affordable ? 'transparent' : '#15233a',
                    color: owned ? '#5dcaa5' : isStarter ? '#7d93b0' : !affordable ? '#7d93b0' : '#c9a961',
                    fontSize: '0.72rem', fontWeight: 600,
                  }}
                >
                  {owned ? 'Im Einsatz' : isStarter ? 'Startschiff' : !affordable ? 'Zu teuer' : 'Kaufen'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '14px', fontSize: '0.68rem', color: '#7d93b0', textAlign: 'center' }}>
          Schiffe können nur auf dem Mond / Shackleton gekauft werden. Ein Wechsel ersetzt dein aktuelles Schiff.
        </div>
      </div>
    </div>
  )
}
