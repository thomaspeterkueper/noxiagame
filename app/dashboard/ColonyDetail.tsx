// app/dashboard/ColonyDetail.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 01.06.2026
// Version:      0.1.0
//
// Kolonie-Detailansicht als Overlay. Öffnet sich per Klick auf eine Kolonie
// in der Kolonien-Statusliste (Übersicht-Tab).
//
// Zeigt:
//   - Bevölkerung + Auslastung (population / population_max)
//   - Pro Ressource: Bestand, Bilanz (production - consumption) und eine
//     VERBRAUCHSPROGNOSE: "Reicht noch X Ticks" (stock / |negative Bilanz|)
//   - Direkte Aktion: "Hierhin fliegen" (wenn nicht am Ort) oder
//     "Ressource liefern" (wenn am Ort + Ware an Bord)
//
// Reine Anzeige + zwei Callbacks (onTravel, onClose). Kein eigener Loop.
// Liefern nutzt den bestehenden Trade-Flow im Parent.

'use client'

import { ResourceType, LocationSlug, useGameStore, effectiveRange } from '@/lib/store/gameStore'
import { baseTravelSeconds, flightEnergyCost } from '@/lib/game/ships'

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON:       Record<string, string> = { earth: '🌍', moon: '🌙', mars: '🔴', phobos: '🪨' }

interface ResRow { resource: string; stock: number; production: number; consumption: number }
interface Colony {
  slug: string
  name: string
  population: number
  population_max: number
  is_supplied: boolean
  location_resources?: ResRow[]
}

// Verbrauchsprognose: bei negativer Bilanz, wie viele Ticks bis stock = 0
function ticksLeft(r: ResRow): number | null {
  const bal = r.production - r.consumption
  if (bal >= 0) return null
  return Math.floor(r.stock / Math.abs(bal))
}

export default function ColonyDetail({
  colony,
  isHere,
  cargo,
  onClose,
  onTravel,
}: {
  colony: Colony | null
  isHere: boolean
  cargo: Record<ResourceType, number>
  onClose: () => void
  onTravel: (dest: LocationSlug) => void
}) {
  const { location, shipRange } = useGameStore()
  if (!colony) return null

  // Erreichbarkeit wie in der TravelList: außer Reichweite → kein Flug, kein
  // Umgehen mehr über die Detailansicht. Reisezeit ist aktuell statisch; sobald
  // Step B wieder steht, fließt hier derselbe Tick ein wie in der TravelList.
  const used      = Object.values(cargo).reduce((a, b) => a + b, 0)
  const reach     = effectiveRange(shipRange, used)
  const travelSec  = baseTravelSeconds(location, colony.slug as LocationSlug)
  const reachable  = travelSec != null && travelSec <= reach
  const energyCost = flightEnergyCost(location, colony.slug)
  const energyOnBoard = cargo['energy'] ?? 0
  const hasEnergy  = energyOnBoard >= energyCost

  const popPct = Math.round((colony.population / colony.population_max) * 100)

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '560px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '0.5px solid rgba(201,169,97,0.3)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: '#c9a961' }}>{LOC_ICON[colony.slug]} {colony.name}</div>
            <div style={{ fontSize: '0.72rem', color: colony.is_supplied ? '#5dcaa5' : '#e0846a', marginTop: '2px' }}>
              {colony.is_supplied ? '✓ versorgt' : '⚠ Versorgungsengpass'}{isHere && ' · Du bist hier'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid #2a4e7a', color: '#cfe0f5', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
        </div>

        {/* Bevölkerung */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#7d93b0', marginBottom: '4px' }}>
            <span>Bevölkerung</span>
            <span style={{ color: '#cfe0f5' }}>{colony.population.toLocaleString('de')} / {colony.population_max.toLocaleString('de')} ({popPct}%)</span>
          </div>
          <div style={{ height: '6px', background: '#06101c', border: '0.5px solid #1f3650', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${popPct}%`, height: '100%', background: '#c9a961' }} />
          </div>
        </div>

        {/* Ressourcen mit Prognose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {(colony.location_resources ?? []).map((r) => {
            const bal = r.production - r.consumption
            const left = ticksLeft(r)
            return (
              <div key={r.resource} style={{ background: '#0a1420', border: '0.5px solid #1f3650', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#cfe0f5' }}>{RESOURCE_ICON[r.resource]} {RESOURCE_LABEL[r.resource]}</span>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#cfe0f5' }}>
                    {r.stock}t
                    <span style={{ color: bal >= 0 ? '#5dcaa5' : '#e0846a', marginLeft: '6px', fontSize: '0.72rem' }}>
                      ({bal >= 0 ? '+' : ''}{bal}/Tick)
                    </span>
                  </span>
                </div>
                {left != null && (
                  <div style={{ fontSize: '0.68rem', color: left <= 5 ? '#e0846a' : '#7d93b0', marginTop: '4px' }}>
                    ⚠ Reicht noch ~{left} {left === 1 ? 'Tick' : 'Ticks'}
                  </div>
                )}
                {bal >= 0 && (
                  <div style={{ fontSize: '0.68rem', color: '#5dcaa5', marginTop: '4px' }}>Stabil oder wachsend</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Aktion */}
        {isHere ? (
          <div style={{ fontSize: '0.75rem', color: '#7d93b0', textAlign: 'center', padding: '8px' }}>
            Du bist hier — liefere über die Handelszentrale.
            {Object.values(cargo).some(v => v > 0) && ' Ladung an Bord bereit.'}
          </div>
        ) : reachable ? (
          <div>
            <button
              onClick={() => { onTravel(colony.slug as LocationSlug); onClose() }}
              disabled={!hasEnergy}
              style={{ width: '100%', padding: '12px 0', fontSize: '0.95rem', borderRadius: '9px', border: `1px solid ${hasEnergy ? '#c9a961' : '#3a4759'}`, background: hasEnergy ? '#15233a' : '#0f1722', color: hasEnergy ? '#c9a961' : '#7d93b0', cursor: hasEnergy ? 'pointer' : 'not-allowed', fontWeight: 600 }}
            >
              {LOC_ICON[colony.slug]} Nach {colony.name} fliegen{travelSec != null ? ` · ${travelSec}s` : ''}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginTop: '6px', padding: '0 4px' }}>
              <span style={{ color: hasEnergy ? '#5dcaa5' : '#e0846a' }}>
                ⚡ Treibstoff: {energyCost}t
              </span>
              <span style={{ color: energyOnBoard >= energyCost ? '#5dcaa5' : '#e0846a' }}>
                An Bord: {energyOnBoard}t
                {!hasEnergy && ` · fehlt ${energyCost - energyOnBoard}t`}
              </span>
            </div>
          </div>
        ) : (
          <div
            title="Ziel außerhalb der Reichweite deines Schiffs"
            style={{ width: '100%', padding: '12px 0', fontSize: '0.9rem', borderRadius: '9px', border: '1px solid #3a4759', background: '#0f1722', color: '#7d93b0', textAlign: 'center', fontWeight: 600 }}
          >
            {LOC_ICON[colony.slug]} {colony.name} außer Reichweite{travelSec != null ? ` · ${travelSec}s` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
