'use client'

// ─────────────────────────────────────────────
//  ShipyardCard.tsx
//  Einbindung: in ShipyardPanel.tsx oder als
//  eigene Sektion im Dashboard (Flottenübersicht)
//
//  <ShipyardCard
//    shipType="freighter_mk1"
//    location="moon"
//    cargoUsed={1}
//    cargoMax={100}
//    credits={2470}
//    hasShipyard={true}
//  />
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react'

type LocationSlug = 'moon' | 'mars' | 'phobos'
type ShipType = 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'

interface ShipyardCardProps {
  shipType: ShipType
  location: LocationSlug
  cargoUsed: number
  cargoMax: number
  credits: number
  hasShipyard?: boolean
  onBuyShip?: (type: ShipType) => void
}

const SHIP_DATA: Record<ShipType, {
  label: string
  cost: number
  cargo: number
  speed: string
  travelTimes: { moonMars: string; moonPhobos: string; marsPhobos: string }
  desc: string
}> = {
  freighter_mk1: {
    label: 'Frachter Mk.I',
    cost: 0,
    cargo: 100,
    speed: '1.0×',
    travelTimes: { moonMars: '30 s', moonPhobos: '25 s', marsPhobos: '10 s' },
    desc: 'Zuverlässiger Allrounder. Startschiff jedes Kolonisten.',
  },
  fast_courier: {
    label: 'Schnellfrachter',
    cost: 8000,
    cargo: 60,
    speed: '1.7×',
    travelTimes: { moonMars: '18 s', moonPhobos: '15 s', marsPhobos: '6 s' },
    desc: 'Kleinerer Laderaum, dafür deutlich schneller. Ideal für Aufträge.',
  },
  heavy_hauler: {
    label: 'Schwerfrachter',
    cost: 15000,
    cargo: 200,
    speed: '0.77×',
    travelTimes: { moonMars: '39 s', moonPhobos: '32 s', marsPhobos: '13 s' },
    desc: 'Maximale Ladekapazität für Großlieferungen. Langsam aber massiv.',
  },
}

const UPGRADES: Exclude<ShipType, 'freighter_mk1'>[] = ['fast_courier', 'heavy_hauler']

export default function ShipyardCard({
  shipType,
  location,
  cargoUsed,
  cargoMax,
  credits,
  hasShipyard = false,
  onBuyShip,
}: ShipyardCardProps) {
  const ship = SHIP_DATA[shipType]
  const cargoPercent = cargoMax > 0 ? (cargoUsed / cargoMax) * 100 : 0

  const [rotation, setRotation] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setRotation(r => (r + 0.3) % 360), 30)
    return () => clearInterval(i)
  }, [])

  return (
    <div style={{
      fontFamily: "'Courier Prime', monospace",
      background: '#0a0e14',
      border: '1px solid rgba(42,78,122,0.25)',
      borderTop: '3px solid #2a4e7a',
      color: '#c8d4e0',
    }}>

      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(42,78,122,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#2a4e7a',
        }}>
          Flottenübersicht
        </span>
        {location === 'moon' && hasShipyard && (
          <span style={{
            fontSize: 8,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'rgba(201,169,97,0.12)',
            border: '1px solid rgba(201,169,97,0.25)',
            color: '#c9a961',
            padding: '2px 7px',
          }}>
            ⬡ Werft · Shackleton
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ padding: 14, display: 'flex', gap: 14 }}>

        {/* Top-down ship preview */}
        <div style={{
          position: 'relative',
          width: 110,
          height: 110,
          flexShrink: 0,
          background: 'rgba(42,78,122,0.06)',
          border: '1px solid rgba(42,78,122,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Rotating dock ring */}
          <div style={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            border: '1px dashed rgba(201,169,97,0.2)',
            transform: `rotate(${rotation}deg)`,
          }} />
          {/* Static outer ring */}
          <div style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: '1px solid rgba(42,78,122,0.15)',
          }} />
          {/* Crosshair lines */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: '50%', height: 1,
            background: 'rgba(42,78,122,0.1)',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: '50%', width: 1,
            background: 'rgba(42,78,122,0.1)',
          }} />

          <img
            src="/images/ships/freighter_topdown.png"
            alt="Draufsicht"
            style={{
              width: 80, height: 80,
              objectFit: 'contain',
              animation: 'shipBob 3s ease-in-out infinite',
              filter: 'drop-shadow(0 0 8px rgba(42,78,122,0.4))',
              zIndex: 2,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <style>{`
            @keyframes shipBob {
              0%,100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-3px) rotate(1deg); }
            }
          `}</style>

          {/* Ship type label */}
          <div style={{
            position: 'absolute',
            bottom: 4,
            left: 0, right: 0,
            textAlign: 'center',
            fontSize: 7,
            color: 'rgba(201,169,97,0.5)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {ship.label}
          </div>
        </div>

        {/* Ship specs */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13,
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            color: '#e8eff6',
            marginBottom: 2,
          }}>
            {ship.label}
          </div>
          <div style={{
            fontSize: 9,
            color: 'rgba(200,212,224,0.4)',
            fontStyle: 'italic',
            fontFamily: "'Playfair Display', serif",
            marginBottom: 10,
          }}>
            {ship.desc}
          </div>

          {/* Cargo bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8.5, color: 'rgba(107,126,147,0.8)',
              marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span>Laderaum</span>
              <span style={{ color: '#c8d4e0', fontWeight: 700 }}>
                {cargoUsed}t / {cargoMax}t
              </span>
            </div>
            <div style={{
              height: 3,
              background: 'rgba(42,78,122,0.25)',
              borderRadius: 2,
            }}>
              <div style={{
                height: '100%',
                width: `${cargoPercent}%`,
                background: cargoPercent > 80
                  ? 'linear-gradient(to right, #2a4e7a, #c9a961)'
                  : 'linear-gradient(to right, #2a4e7a, #4a8aaa)',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Stats grid */}
          {[
            ['Geschwindigkeit', ship.speed],
            ['Mond ↔ Mars', ship.travelTimes.moonMars],
            ['Mond ↔ Phobos', ship.travelTimes.moonPhobos],
            ['Mars ↔ Phobos', ship.travelTimes.marsPhobos],
          ].map(([label, value]) => (
            <div key={label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              padding: '3px 0',
              borderBottom: '1px solid rgba(42,78,122,0.1)',
              color: 'rgba(107,126,147,0.8)',
            }}>
              <span>{label}</span>
              <span style={{ color: '#c8d4e0', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade section – contextual */}
      <div style={{
        borderTop: '1px solid rgba(42,78,122,0.2)',
        padding: '10px 14px',
      }}>
        {hasShipyard && location === 'moon' ? (
          // ── AT SHIPYARD: show buy options ──
          <>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,97,0.6)',
              marginBottom: 8,
            }}>
              Werft · Shackleton Station
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {UPGRADES.map(type => {
                const s = SHIP_DATA[type]
                const canAfford = credits >= s.cost
                const isOwned = shipType === type
                return (
                  <button
                    key={type}
                    disabled={!canAfford || isOwned}
                    onClick={() => onBuyShip?.(type)}
                    style={{
                      flex: 1,
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      padding: '7px 8px',
                      border: isOwned
                        ? '1px solid rgba(74,170,106,0.4)'
                        : canAfford
                          ? '1px solid rgba(42,78,122,0.5)'
                          : '1px solid rgba(42,78,122,0.15)',
                      background: isOwned
                        ? 'rgba(74,170,106,0.08)'
                        : canAfford
                          ? 'rgba(42,78,122,0.06)'
                          : 'transparent',
                      color: isOwned
                        ? '#4aaa6a'
                        : canAfford
                          ? '#6b9aba'
                          : 'rgba(107,126,147,0.3)',
                      cursor: canAfford && !isOwned ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 8, opacity: 0.75 }}>
                      {isOwned
                        ? '✓ Im Besitz'
                        : canAfford
                          ? `${s.cost.toLocaleString('de')} Cr`
                          : `${s.cost.toLocaleString('de')} Cr · zu wenig`}
                    </div>
                    <div style={{ fontSize: 7.5, opacity: 0.5, marginTop: 2 }}>
                      {s.cargo}t · {s.speed}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          // ── NOT AT SHIPYARD: hint only ──
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, flexShrink: 0,
              borderRadius: '50%',
              border: '1px solid rgba(42,78,122,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'rgba(42,78,122,0.4)',
            }}>
              ⬡
            </div>
            <div>
              <div style={{
                fontSize: 9,
                color: 'rgba(107,126,147,0.6)',
                letterSpacing: '0.06em',
                marginBottom: 2,
              }}>
                Werft nicht verfügbar
              </div>
              <div style={{
                fontSize: 8.5,
                color: 'rgba(107,126,147,0.4)',
                fontStyle: 'italic',
                fontFamily: "'Playfair Display', serif",
              }}>
                Fliege nach Mond / Shackleton Station um ein neues Schiff zu kaufen.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
