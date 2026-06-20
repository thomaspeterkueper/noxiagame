// app/dashboard/ColonyGrid.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 15.06.2026 – Anomalie-Marker (Klick → „Anomalie entdeckt." in
//                            Sidebar); geplante Gebäude ausgegraut im Bau-Dialog
//   15.06.2026 – Gebäude über animiertes BuildingSVG; Straßen via TileSVG
//   07.06.2026 – tile_entities, Eigentum, Gebäude-Verkauf, Steuer-Sidebar
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
import { BUILDABLE_ITEMS, PLANNED_BUILDINGS } from '@/lib/game/config'
import { TileSVG } from '@/lib/grid/TileSVG'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { generateGrid, gridTypes, anomalyAt, isBuildable, NPC_ENTITY, COLS, ROWS } from '@/lib/grid/generateGrid'
import SellPanel from './SellPanel'
import AdminOverlay from './AdminOverlay'
import SchoolOverlay from './SchoolOverlay'

function TileDisplay({ tileType, slug }: { tileType: string; slug: string }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)

  if (useSVG) return <TileSVG type={tileType} planet={slug} />

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
  id:             string
  profile_id:     string | null
  is_state_owned?: boolean
  entity_type:    string   // 'building' | 'vehicle' | 'specialist' | 'ship'
  entity_id:      string   // 'mine' | 'solar' | 'habitat' | 'admin' | ...
  tile_level:     number
  tile_row:       number
  tile_col:       number
  username?:      string   // optional, falls profiles gejoint wird
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
  // Standortfremde Gebäude: sichtbar aber disabled mit Hinweis
  const isAllowedHere = (id: string) => {
    const b = BUILDABLE_ITEMS[id]
    return !b?.allowedLocations || b.allowedLocations.includes(locationSlug)
  }

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
            const canAfford  = credits >= item.cost
            const locAllowed = isAllowedHere(id)
            const canBuild   = canAfford && locAllowed
            return (
              <div key={id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem', borderRadius: '6px',
                background: canBuild ? '#2a3a4a' : '#1a2530',
                border: `1px solid ${locAllowed ? '#2a4e7a' : '#3a3a2a'}`,
                opacity: locAllowed ? (canAfford ? 1 : 0.6) : 0.45,
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: locAllowed ? '#fff' : '#8a8a6a' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#8a9ab0', marginTop: '0.2rem' }}>
                    {item.description} · {item.buildTimeTicks} Tick{item.buildTimeTicks > 1 ? 's' : ''} Bauzeit
                  </div>
                  {!locAllowed && (
                    <div style={{ fontSize: '0.6rem', color: '#8a7a4a', marginTop: '0.2rem' }}>
                      ⚠ Nur auf {item.allowedLocations?.join(', ')}
                    </div>
                  )}
                </div>
                <button
                  disabled={!canBuild || loading}
                  onClick={() => handleBuild(id)}
                  style={{
                    background: canBuild ? '#2a4e7a' : '#2a3a4a',
                    color: '#fff', border: 'none',
                    padding: '0.4rem 0.8rem', borderRadius: '4px',
                    fontSize: '0.7rem', fontWeight: 700,
                    cursor: canBuild ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                  }}
                >
                  {item.cost.toLocaleString('de')} Cr
                </button>
              </div>
            )
          })}
        </div>

        {/* Geplante Gebäude — ausgegraut, noch nicht baubar (Roadmap-Sicht) */}
        {PLANNED_BUILDINGS.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #2a3a4a' }}>
            <div style={{ fontSize: '0.6rem', color: '#5a6878', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>
              In Planung
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {PLANNED_BUILDINGS.map(p => (
                <div key={p.id}
                  title={p.hint}
                  style={{
                    fontSize: '0.62rem', color: '#5a6878',
                    background: '#16202c', border: '1px solid #243240',
                    borderRadius: '4px', padding: '0.25rem 0.5rem',
                    cursor: 'default', opacity: 0.7,
                  }}>
                  {p.name}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.58rem', color: '#465668', marginTop: '0.5rem', lineHeight: 1.4 }}>
              Diese Gebäude sind in Vorbereitung und bald verfügbar.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────

const BUILDING_NAMES: Record<string, string> = {
  mine: 'Mine', solar: 'Solarfeld', habitat: 'Habitat',
  scanner: 'Scanner', admin: 'Verwaltung',
  school: 'Akademie', ice_drill: 'Eisbohrung', water_recycler: 'Wasserrecycler',
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
  slug:              string
  name:              string
  population:        number
  populationMax:     number
  isSupplied:        boolean
  userId:            string
  entities?:         TileEntity[]
  pending?:          PendingBuild[]
  tax?:              ColonyTax
  entityInfo?:       Record<string, EntityEconomy>
  locationResources?: { resource: string; stock: number; consumption: number }[]
  credits?:          number
}

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied,
  userId, entities = [], pending = [], tax, entityInfo,
  locationResources = [], credits = 0,
}: ColonyGridProps) {
  const { loadFromServer, invalidate } = useGameStore()
  const [grid, setGrid] = useState<string[][]>([])
  const [anomaly, setAnomaly] = useState<{ r: number; c: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const [showAdmin, setShowAdmin]         = useState(false)
  const [showSchool, setShowSchool]       = useState(false)
  const popPercent = Math.round((population / populationMax) * 100)

  useEffect(() => {
    const cellGrid = generateGrid(slug, population, entities, pending, userId)
    setGrid(gridTypes(cellGrid))
    setAnomaly(anomalyAt(cellGrid))
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
    const ent = entityAt(r, c)
    if (ent?.entity_id === 'admin') {
      setShowAdmin(true)
      return
    }
    if (ent?.entity_id === 'school') {
      setShowSchool(true)
      return
    }
    if (isBuildable(tileType)) setShowBuildPopup(true)
  }

  if (grid.length === 0) return null

  const selectedEntity = selectedTile ? entityAt(selectedTile.r, selectedTile.c) : undefined
  const ownSelected = selectedEntity && selectedEntity.profile_id === userId

  return (
    <div style={{ background: '#1a2a3a', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <BuildingSpriteStyles />
      <style>{`@keyframes noxia-anomaly{0%,100%{opacity:.45;transform:scale(0.85)}50%{opacity:1;transform:scale(1.1)}}`}</style>

      {/* Schul-Overlay */}
      {showSchool && (
        <SchoolOverlay
          locationSlug={slug}
          colonyContext={{
            locationName: name,
            population,
            waterStock:   (locationResources.find(r => r.resource === 'water')?.stock ?? 0),
            waterCons:    (locationResources.find(r => r.resource === 'water')?.consumption ?? Math.ceil(population / 100)),
            credits,
          }}
          onClose={() => { setShowSchool(false); setSelectedTile(null) }}
          onKnowledgeEarned={(pts, total) => {
            console.log(`+${pts} Wissenspunkte → ${total} gesamt`)
          }}
        />
      )}

      {/* Admin-Overlay */}
      {showAdmin && (
        <AdminOverlay
          locationSlug={slug}
          onClose={() => { setShowAdmin(false); setSelectedTile(null) }}
        />
      )}

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
            const isOwn      = entity?.profile_id !== null && entity?.profile_id === userId
            const isSelling  = sellingAt(r, c)
            const isAnomaly  = anomaly?.r === r && anomaly?.c === c

            // Eigentums-Rand:
            //   Blau (#2a6ab5)  = staatliches Gebäude (profile_id null / is_state_owned)
            //   Gold (#c9a961)  = eigenes Gebäude
            //   Rot  (#c94040)  = fremder Spieler
            const isState = entity?.is_state_owned || entity?.profile_id === null
            // inset box-shadow: kein Platzverlust, überlagert SVG nicht
            // Staatlich: helles Cyan-Blau (#5aaeff) — deutlich vom dunklen Kachel-BG
            let ownerShadow = 'none'
            if (entity) {
              if (isState) {
                ownerShadow = 'inset 0 0 0 3px #5aaeff, 0 0 7px #5aaeff'
              } else if (isOwn) {
                ownerShadow = 'inset 0 0 0 3px #c9a961, 0 0 7px rgba(201,169,97,0.7)'
              } else {
                ownerShadow = 'inset 0 0 0 2px #e05050, 0 0 5px rgba(224,80,80,0.5)'
              }
            }
            if (isSelected && !isState) {
              ownerShadow = 'inset 0 0 0 3px #c9a961, 0 0 12px #c9a961'
            }

            return (
              <div
                key={`${r}-${c}`}
                title={
                  isAnomaly
                    ? 'Anomalie entdeckt.'
                    : entity
                    ? `${BUILDING_NAMES[entity.entity_id] ?? entity.entity_id}${isOwn ? ' (deins)' : entity.username ? ` (${entity.username})` : ''}`
                    : tileType.replace(/_/g, ' ')
                }
                onClick={() => handleTileClick(r, c, tileType)}
                style={{
                  position: 'relative',
                  width:   TILE_SIZE,
                  height:  TILE_SIZE,
                  cursor:  canBuild || entity || isAnomaly ? 'pointer' : 'default',
                  boxShadow: ownerShadow,
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  opacity: isSelling ? 0.45 : 1,        // „wird verkauft": gedimmt
                  filter:  isSelling ? 'grayscale(0.7)' : 'none',
                }}
              >
                {(() => {
                  // Gebäude (echt, NPC oder building_habitat) → animiertes BuildingSVG.
                  // Straßen → direkt TileSVG (maskenbasiert, kein Bild-404).
                  // Baustelle + Terrain → TileDisplay wie bisher.
                  const npcEid = NPC_ENTITY[tileType]   // npc_mine → 'mine' etc.
                  const isBuildingTile =
                    npcEid !== undefined ||
                    (tileType.startsWith('building_') && tileType !== 'building_construction')
                  if (isBuildingTile) {
                    const eid = entity?.entity_id ?? npcEid ?? tileType.replace('building_', '')
                    return (
                      <BuildingSVG
                        entityId={eid}
                        planet={slug}
                        occupancy={populationMax > 0 ? population / populationMax : 0}
                        owned={false}
                        size={TILE_SIZE}
                      />
                    )
                  }
                  if (tileType.startsWith('road')) {
                    return <TileSVG type={tileType} planet={slug} />
                  }
                  return <TileDisplay tileType={tileType} slug={slug} />
                })()}
                {isAnomaly && (
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                  }}>
                    <span style={{
                      width: '46%', height: '46%', borderRadius: '50%',
                      background: 'radial-gradient(circle, #c9a0f0 0%, #8a5bc0 55%, transparent 72%)',
                      boxShadow: '0 0 8px #b48ce8',
                      animation: 'noxia-anomaly 2.6s ease-in-out infinite',
                    }} />
                  </span>
                )}
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
                    {anomaly && selectedTile.r === anomaly.r && selectedTile.c === anomaly.c
                      ? 'Anomalie'
                      : selectedEntity
                      ? (BUILDING_NAMES[selectedEntity.entity_id] ?? selectedEntity.entity_id)
                      : selectedTile.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div style={{ color: '#8a9ab0', marginTop: '0.25rem' }}>
                    {anomaly && selectedTile.r === anomaly.r && selectedTile.c === anomaly.c
                      ? 'Anomalie entdeckt.'
                      : selectedEntity
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
