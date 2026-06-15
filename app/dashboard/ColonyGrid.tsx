// app/dashboard/ColonyGrid.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 15.06.2026 – Gebäude über animiertes BuildingSVG (statt TileSVG);
//                            Terrain/Baustelle weiter via TileDisplay
//   07.06.2026 – tile_entities als Bestandsquelle, Eigentums-Markierung,
//                Gebäude-Verkauf (SellPanel), Steuer-/Wirtschafts-Sidebar
//
// Kachelgrid pro Kolonie (12×8):
// - Terrain seed-basiert deterministisch
// - Bestand aus tile_entities (mit id + profile_id → Eigentum + Verkauf)
// - Laufende Vorgänge aus player_builds (Baustelle / „wird verkauft")
// - Klick auf bebaubare Kachel → Build-Popup
// - Klick auf eigenes Gebäude → SellPanel mit Marktbewertung

'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { BUILDABLE_ITEMS } from '@/lib/game/config'
import { TileSVG } from '@/lib/grid/TileSVG'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { generateGrid, gridTypes, isBuildable, NPC_ENTITY, COLS, ROWS } from '@/lib/grid/generateGrid'
import SellPanel from './SellPanel'

function TileDisplay({ tileType, slug }: { tileType: string; slug: string }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)

  if (useSVG) return <TileSVG type={tileType} planet={slug as 'moon' | 'mars' | 'phobos'} />

  return (
    <img
      src={src}
      width={44} height={44}
      style={{ display: 'block' }}
      onError={() => {
        if (src.endsWith('.webp')) setSrc(`/images/grid/${slug}/${tileType}.png`)
        else setUseSVG(true)
      }}
    />
  )
}

const TILE_SIZE = 44

// ── Typen für Bestand + Vorgänge ──────────────────────────────

// Eine Zeile aus tile_entities (eigene UND fremde Gebäude)
export interface TileEntity {
  id:          string
  profile_id:  string
  entity_type: string   // 'building' | 'vehicle' | 'specialist' | 'ship'
  entity_id:   string   // 'mine' | 'solar' | 'habitat' | ...
  tile_level:  number
  tile_row:    number
  tile_col:    number
  username?:   string   // optional, falls profiles gejoint wird
}

// Laufender Vorgang aus player_builds
export interface PendingBuild {
  buildable_id: string
  tile_row:     number
  tile_col:     number
  status:       string  // 'building' | 'selling'
}

// ── Build-Popup ───────────────────────────────────────────────

function BuildPopup({
  tileRow, tileCol, locationSlug, onClose, onBuildStarted
}: {
  tileRow:        number
  tileCol:        number
  locationSlug:   string
  onClose:        () => void
  onBuildStarted: (newCredits: number) => void
}) {
  const { credits } = useGameStore()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)

  async function getToken() {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleBuild(buildableId: string) {
    setLoading(true)
    const token = await getToken()
    const res = await fetch(
      `/api/game/build?action=start&buildableId=${buildableId}&location=${locationSlug}&tileRow=${tileRow}&tileCol=${tileCol}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setMsg(`✓ Baubeginn: ${data.buildable}`)
      onBuildStarted(data.newCredits)
      setTimeout(onClose, 1500)
    } else {
      setMsg(`✗ ${data.error}`)
    }
  }

  const buildItems = Object.entries(BUILDABLE_ITEMS).filter(([, b]) => b.type === 'building')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1a2a3a', border: '1px solid #2a4e7a', borderRadius: '12px', padding: '1.5rem', minWidth: '320px', fontFamily: 'system-ui, sans-serif' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '0.65rem', color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '1rem' }}>
          🏗️ Gebäude bauen – Kachel ({tileRow},{tileCol})
        </div>

        {msg && (
          <div style={{ padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem',
            background: msg.startsWith('✓') ? '#1a3a2a' : '#3a1a1a',
            color: msg.startsWith('✓') ? '#6fcf97' : '#e74c3c' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildItems.map(([id, item]) => {
            const canAfford = credits >= item.cost
            return (
              <div key={id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem', borderRadius: '6px',
                background: canAfford ? '#2a3a4a' : '#1a2530',
                border: '1px solid #2a4e7a', opacity: canAfford ? 1 : 0.6,
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#8a9ab0', marginTop: '0.2rem' }}>
                    {item.description} · {item.buildTimeTicks} Tick{item.buildTimeTicks > 1 ? 's' : ''} Bauzeit
                  </div>
                </div>
                <button
                  disabled={!canAfford || loading}
                  onClick={() => handleBuild(id)}
                  style={{
                    background: canAfford ? '#2a4e7a' : '#2a3a4a',
                    color: '#fff', border: 'none',
                    padding: '0.4rem 0.8rem', borderRadius: '4px',
                    fontSize: '0.7rem', fontWeight: 700,
                    cursor: canAfford ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                  }}
                >
                  {item.cost.toLocaleString('de')} Cr
                </button>
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: '1rem', width: '100%', background: 'transparent', color: '#64748b', border: '1px solid #2a3a4a', borderRadius: '4px', padding: '0.4rem', fontSize: '0.7rem', cursor: 'pointer' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────

const BUILDING_NAMES: Record<string, string> = {
  mine: 'Mine', solar: 'Solarfeld', habitat: 'Habitat',
}

const RES_DE: Record<string, string> = {
  metal: 'Metall', energy: 'Energie', water: 'Wasser',
}

// Wirtschaft je Gebäude (aus /api/game/build → entityInfo)
export interface EntityEconomy {
  ertragswert:       number
  produktion:        number | null
  ressource:         string | null
  resourceSellPrice: number | null
}

// Steuersätze der Kolonie (aus /api/game/build → colonyTax[location_id])
export interface ColonyTax {
  tax_property:    number
  tax_transaction: number
  tax_landing:     number
}

interface ColonyGridProps {
  slug:          string
  name:          string
  population:    number
  populationMax: number
  isSupplied:    boolean
  userId:        string              // eigene profile_id für Eigentums-Check
  entities?:     TileEntity[]        // Bestand aus tile_entities
  pending?:      PendingBuild[]      // Laufende Vorgänge (building/selling)
  tax?:          ColonyTax           // Steuersätze dieser Kolonie
  entityInfo?:   Record<string, EntityEconomy>  // Wirtschaft je Gebäude-id
}

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied,
  userId, entities = [], pending = [], tax, entityInfo,
}: ColonyGridProps) {
  const { loadFromServer, invalidate } = useGameStore()
  const [grid, setGrid] = useState<string[][]>([])
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const popPercent = Math.round((population / populationMax) * 100)

  useEffect(() => {
    setGrid(gridTypes(generateGrid(slug, population, entities, pending, userId)))
  }, [slug, population, populationMax, entities, pending])

  // Entität auf einer Kachel finden (Oberfläche, Gebäude)
  function entityAt(r: number, c: number): TileEntity | undefined {
    return entities.find(e =>
      e.tile_row === r && e.tile_col === c && e.entity_type === 'building'
    )
  }

  function sellingAt(r: number, c: number): boolean {
    return pending.some(p => p.tile_row === r && p.tile_col === c && p.status === 'selling')
  }

  function handleTileClick(r: number, c: number, tileType: string) {
    setSelectedTile({ r, c, type: tileType })
    if (isBuildable(tileType)) setShowBuildPopup(true)
  }

  if (grid.length === 0) return null

  const selectedEntity = selectedTile ? entityAt(selectedTile.r, selectedTile.c) : undefined
  const ownSelected = selectedEntity && selectedEntity.profile_id === userId

  return (
    <div style={{ background: '#1a2a3a', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <BuildingSpriteStyles />

      {/* Build-Popup */}
      {showBuildPopup && selectedTile && (
        <BuildPopup
          tileRow={selectedTile.r}
          tileCol={selectedTile.c}
          locationSlug={slug}
          onClose={() => { setShowBuildPopup(false); setSelectedTile(null) }}
          onBuildStarted={async () => { await loadFromServer(); invalidate('builds') }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px' }}>{name}</div>
          <div style={{ fontSize: '0.55rem', color: '#8a9ab0', marginTop: '2px' }}>{slug.toUpperCase()} SECTOR</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.65rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>POP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{population.toLocaleString('de')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>CAP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{popPercent}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>STATUS</div>
            <div style={{ color: isSupplied ? '#6fcf97' : '#e74c3c', fontWeight: 700 }}>{isSupplied ? '🟢' : '🔴'}</div>
          </div>
        </div>
      </div>

      {/* Grid links · Info-Sidebar rechts */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Kachelgrid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
          gap: 0,
          border: '2px solid #2a4e7a',
          borderRadius: '6px',
          overflow: 'hidden',
          width: `${COLS * TILE_SIZE}px`,
          flexShrink: 0,
        }}>
        {grid.flatMap((row, r) =>
          row.map((tileType, c) => {
            const isSelected = selectedTile?.r === r && selectedTile?.c === c
            const canBuild   = isBuildable(tileType)
            const entity     = entityAt(r, c)
            const isOwn      = entity?.profile_id === userId
            const isSelling  = sellingAt(r, c)

            // Eigentums-Rand: eigene Gebäude Gold, fremde grau
            let ownerOutline = 'none'
            if (entity) ownerOutline = isOwn ? '1px solid #c9a961' : '1px solid #5a6878'
            if (isSelected) ownerOutline = '2px solid #c9a961'

            return (
              <div
                key={`${r}-${c}`}
                title={
                  entity
                    ? `${BUILDING_NAMES[entity.entity_id] ?? entity.entity_id}${isOwn ? ' (deins)' : entity.username ? ` (${entity.username})` : ''}`
                    : tileType.replace(/_/g, ' ')
                }
                onClick={() => handleTileClick(r, c, tileType)}
                style={{
                  width:   TILE_SIZE,
                  height:  TILE_SIZE,
                  cursor:  canBuild || entity ? 'pointer' : 'default',
                  outline: ownerOutline,
                  outlineOffset: '-2px',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  opacity: isSelling ? 0.45 : 1,        // „wird verkauft": gedimmt
                  filter:  isSelling ? 'grayscale(0.7)' : 'none',
                }}
              >
                {(() => {
                  // Gebäude (echt, NPC oder building_habitat) → animiertes BuildingSVG.
                  // Baustelle + Terrain/Straße → TileDisplay wie bisher.
                  const npcEid = NPC_ENTITY[tileType]   // npc_mine → 'mine' etc.
                  const isBuildingTile =
                    npcEid !== undefined ||
                    (tileType.startsWith('building_') && tileType !== 'building_construction')
                  if (isBuildingTile) {
                    const eid = entity?.entity_id ?? npcEid ?? tileType.replace('building_', '')
                    return (
                      <BuildingSVG
                        entityId={eid}
                        planet={slug as 'moon' | 'mars' | 'phobos'}
                        occupancy={populationMax > 0 ? population / populationMax : 0}
                        owned={false}
                        size={TILE_SIZE}
                      />
                    )
                  }
                  return <TileDisplay tileType={tileType} slug={slug} />
                })()}
              </div>
            )
          })
        )}
        </div>

        {/* Info-Sidebar rechts neben dem Grid */}
        <div style={{
          flex: 1, minWidth: '240px', alignSelf: 'stretch',
          padding: '0.85rem 1rem',
          background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
          fontSize: '0.75rem',
        }}>
          {!selectedTile || showBuildPopup ? (
            <div style={{ color: '#5a6878', fontSize: '0.7rem', lineHeight: 1.6 }}>
              Kachel anklicken für Details.<br />
              Eigene Gebäude (Goldrand) lassen sich hier bewerten und verkaufen.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#b99b6b', fontWeight: 700, fontSize: '0.85rem' }}>
                    {selectedEntity
                      ? (BUILDING_NAMES[selectedEntity.entity_id] ?? selectedEntity.entity_id)
                      : selectedTile.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div style={{ color: '#8a9ab0', marginTop: '0.25rem' }}>
                    {selectedEntity
                      ? (ownSelected ? 'Eigentum: Du' : `Eigentum: ${selectedEntity.username ?? 'Anderer Pilot'}`)
                      : sellingAt(selectedTile.r, selectedTile.c)
                        ? 'Wird verkauft …'
                        : isBuildable(selectedTile.type) ? 'Bebaubar' : 'Nicht bebaubar'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTile(null)}
                  style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ✕
                </button>
              </div>

              {isBuildable(selectedTile.type) && (
                <button
                  onClick={() => setShowBuildPopup(true)}
                  style={{ marginTop: '0.75rem', width: '100%', background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.45rem 0.75rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🏗️ Bauen
                </button>
              )}

              {/* Wirtschaft des gewählten eigenen Gebäudes: Produktion +
                  reale Haltekosten (Grundsteuer aus colony_settings). Der
                  Ertragswert/Verkaufswert steht direkt darunter im SellPanel. */}
              {ownSelected && selectedEntity && (() => {
                const eco     = entityInfo?.[selectedEntity.id]
                const taxProp = tax?.tax_property ?? 0
                const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }
                return (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.7rem', lineHeight: 1.7 }}>
                    {eco?.produktion != null && eco.ressource && (
                      <div style={row}>
                        <span style={{ color: '#8a9ab0' }}>Produktion</span>
                        <span style={{ color: '#cdd6e0' }}>+{eco.produktion} {RES_DE[eco.ressource] ?? eco.ressource}/Tick</span>
                      </div>
                    )}
                    <div style={row}>
                      <span style={{ color: '#8a9ab0' }}>Haltekosten</span>
                      <span style={{ color: taxProp > 0 ? '#cdd6e0' : '#5a6878' }}>
                        {taxProp > 0 ? `−${taxProp.toLocaleString('de-DE')} Cr/Tick` : 'keine'}
                      </span>
                    </div>
                    {taxProp > 0 && (
                      <div style={{ color: '#5a6878', fontSize: '0.62rem', marginTop: '3px', lineHeight: 1.4 }}>
                        Grundsteuer dieser Kolonie · fällt an, solange du das Gebäude hältst
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Verkaufs-UI für eigene Gebäude */}
              {ownSelected && (
                <SellPanel
                  key={selectedEntity!.id}
                  entityId={selectedEntity!.id}
                  entityName={BUILDING_NAMES[selectedEntity!.entity_id] ?? selectedEntity!.entity_id}
                  onSold={async () => { await loadFromServer(); invalidate('builds') }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Bevölkerungsbalken */}
      <div style={{ marginTop: '0.6rem', background: '#0a1a2a', height: '4px', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${popPercent}%`, height: '100%',
          background: isSupplied ? 'linear-gradient(90deg, #6fcf97, #27ae60)' : 'linear-gradient(90deg, #e74c3c, #c0392b)',
          transition: 'width 0.5s',
        }} />
      </div>
    </div>
  )
}
