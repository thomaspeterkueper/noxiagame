'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStreetTiles, nearestStreetTile, type StreetTile } from '@/lib/game/streetTiles'
import { positionOnStreetPath, shortestStreetPath } from '@/lib/game/npcStreetMovement'
import { residentRoutine, virtualDayProgress, type RoutineStop } from '@/lib/game/npcDailyRoutine'
import { BUILDINGS } from '@/lib/game/buildings/index'
import { BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { IsometricBuilding, IsometricBuildingStyles } from '@/lib/grid/IsometricBuilding'
import { ColonyActivityStyles, MachineActivity, Rover, ServiceCrate } from '@/lib/grid/ColonyActivity'
import { NpcFigure, NpcPortrait, NpcVisualStyles } from '@/lib/grid/NpcVisual'

interface TileEntity {
  id: string
  entity_id: string
  entity_type: string
  tile_row: number
  tile_col: number
  profile_id: string | null
  owner_class: string
}

interface Ship {
  id: string
  ship_type: string
  is_active: boolean
  location_id: string
}

interface Assignment {
  type: string
  roleCode: string | null
  tileEntityId: string | null
}

interface Need { code: string; satisfaction: number }
interface Skill { code: string; level: number; experience: number }

interface Resident {
  id: string
  displayName: string
  birthYear: number | null
  activityState: string
  lastAction: string | null
  assignments: Assignment[]
  needs: Need[]
  skills: Skill[]
}

interface Props {
  locationSlug: string
  locationName: string
  population: number
  entities: TileEntity[]
  pending: unknown[]
  ships: Ship[]
  locationId: string
  userId: string
  onClose: () => void
  onEnterBuilding?: (entity: TileEntity) => void
}

type Selection = { kind: 'building'; id: string } | { kind: 'person'; id: string } | null

type ResidentPosition = {
  resident: Resident
  col: number
  row: number
  routine: RoutineStop
}

const COLS = 32
const ROWS = 24
const IW = 56
const IH = 28
const CW = (COLS + ROWS) * IW + 240
const CH = (COLS + ROWS) * IH + 320
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.6

const panel: React.CSSProperties = {
  background: 'linear-gradient(180deg,#111b27,#0b121b)',
  border: '1px solid #45586a',
  color: '#d8d4c8',
}
const action: React.CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  background: '#263d51',
  color: '#f4dc88',
  border: '1px solid #65788a',
  font: 'bold 11px monospace',
  cursor: 'pointer',
}
const section: React.CSSProperties = { borderTop: '1px solid #344657', paddingTop: 10, marginTop: 10 }

function iso(c: number, r: number) {
  return { x: (c - r) * IW + CW / 2, y: (c + r) * IH + 100 }
}
function label(id: string) {
  return BUILDINGS[id]?.name ?? id.replace(/_/g, ' ')
}
function assignment(resident: Resident, type: string) {
  return resident.assignments.find(a => a.type === type)
}
function role(resident: Resident) {
  return assignment(resident, 'work')?.roleCode ?? resident.activityState
}
function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
function pct(value: number) {
  return `${Math.round(value * 100)}%`
}
function diamond(ctx: CanvasRenderingContext2D, c: number, r: number, fill: string) {
  const p = iso(c, r)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(p.x, p.y - IH)
  ctx.lineTo(p.x + IW, p.y)
  ctx.lineTo(p.x, p.y + IH)
  ctx.lineTo(p.x - IW, p.y)
  ctx.closePath()
  ctx.fill()
}
function road(ctx: CanvasRenderingContext2D, street: StreetTile) {
  const p = iso(street.col, street.row)
  const width = street.subtype === 'main' ? 18 : 14
  const dirs: [number, number, number][] = [[-1, 0, 1], [0, 1, 2], [1, 0, 4], [0, -1, 8]]
  ctx.lineCap = 'round'
  for (const currentWidth of [width + 6, width]) {
    ctx.strokeStyle = currentWidth === width ? '#606562' : '#171919'
    ctx.lineWidth = currentWidth
    for (const [dr, dc, bit] of dirs) {
      if (street.mask && (street.mask & bit) === 0) continue
      const q = iso(street.col + dc * 0.52, street.row + dr * 0.52)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(q.x, q.y)
      ctx.stroke()
    }
  }
}

export default function WalkableColony({
  locationSlug,
  locationName,
  population,
  entities,
  pending,
  userId,
  onClose,
  onEnterBuilding,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [viewport, setViewport] = useState({ x: Math.max(0, CW / 2 - 500), y: 0 })
  const [zoom, setZoom] = useState(0.78)
  const [residents, setResidents] = useState<Resident[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  const [showPeople, setShowPeople] = useState(false)
  const [tick, setTick] = useState(0)
  const [fig, setFig] = useState({ col: 0, row: 0 })

  const buildings = useMemo(() => entities.filter(e => e.entity_type === 'building'), [entities])
  const streets = useMemo(
    () => getStreetTiles(locationSlug, population, entities, pending, userId, COLS, ROWS),
    [locationSlug, population, entities, pending, userId],
  )
  const selectedBuilding = selection?.kind === 'building' ? buildings.find(b => b.id === selection.id) ?? null : null
  const selectedPerson = selection?.kind === 'person' ? residents.find(r => r.id === selection.id) ?? null : null

  const clamp = useCallback((x: number, y: number, z = zoom) => {
    const rect = mapRef.current?.getBoundingClientRect()
    const width = (rect?.width ?? 900) / z
    const height = (rect?.height ?? 560) / z
    return {
      x: Math.max(0, Math.min(Math.max(0, CW - width), x)),
      y: Math.max(0, Math.min(Math.max(0, CH - height), y)),
    }
  }, [zoom])

  const center = useCallback((c: number, r: number, z = zoom) => {
    const p = iso(c, r)
    const rect = mapRef.current?.getBoundingClientRect()
    setViewport(clamp(p.x - (rect?.width ?? 900) / (2 * z), p.y - (rect?.height ?? 560) / (2 * z), z))
  }, [zoom, clamp])

  const anchor = useCallback(
    (building?: TileEntity) => building ? nearestStreetTile(building.tile_row, building.tile_col, streets) : null,
    [streets],
  )

  useEffect(() => {
    let live = true
    fetch(`/api/game/population?locationSlug=${encodeURIComponent(locationSlug)}`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => live && setResidents(Array.isArray(data.residents) ? data.residents : []))
      .catch(() => live && setResidents([]))
    return () => { live = false }
  }, [locationSlug])

  useEffect(() => {
    const id = setInterval(() => setTick(value => value + 1), 450)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const habitat = buildings.find(b => b.entity_id === 'habitat' && b.profile_id === userId)
    const street = nearestStreetTile(habitat?.tile_row ?? 12, habitat?.tile_col ?? 16, streets)
    if (street) {
      setFig({ col: street.col, row: street.row })
      center(street.col, street.row)
    }
  }, [locationSlug, streets, buildings, userId, center])

  const communityBuildings = useMemo(() => {
    const preferred = ['bar', 'school', 'habitat', 'residential_block', 'admin']
    return buildings.filter(b => preferred.includes(b.entity_id))
  }, [buildings])

  const dayProgress = virtualDayProgress(tick)
  const positions = useMemo<ResidentPosition[]>(() => residents.map(resident => {
    const workBuilding = buildings.find(b => b.id === assignment(resident, 'work')?.tileEntityId)
    const homeBuilding = buildings.find(b => b.id === assignment(resident, 'home')?.tileEntityId)
    const communityBuilding = communityBuildings.length
      ? communityBuildings[Math.floor(hash(`${resident.id}:community`) * communityBuildings.length)]
      : homeBuilding

    const workAnchor = anchor(workBuilding)
    const homeAnchor = anchor(homeBuilding)
    const communityAnchor = anchor(communityBuilding)
    const routine = residentRoutine(resident.id, dayProgress)

    const target = routine.target === 'work' ? workAnchor : routine.target === 'community' ? communityAnchor : homeAnchor
    const fallback = target ?? workAnchor ?? homeAnchor ?? communityAnchor
    if (!fallback) return null

    let col = fallback.col
    let row = fallback.row
    if (routine.moving) {
      let from = homeAnchor
      const to = target
      if (routine.label === 'Weg zum Treffpunkt') from = workAnchor ?? homeAnchor
      if (routine.label === 'Heimweg') from = communityAnchor ?? workAnchor ?? homeAnchor
      if (from && to) {
        const path = shortestStreetPath(from, to, streets)
        const position = positionOnStreetPath(path, routine.progress)
        if (position) {
          col = position.col
          row = position.row
        }
      }
    } else {
      col += 0.15 + (hash(`${resident.id}:c`) - 0.5) * 0.25
      row += 0.15 + (hash(`${resident.id}:r`) - 0.5) * 0.25
    }

    return { resident, col, row, routine }
  }).filter((value): value is ResidentPosition => value !== null), [residents, buildings, communityBuildings, streets, dayProgress, anchor])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CW, CH)
    ctx.fillStyle = locationSlug === 'mars' ? '#120905' : '#080d14'
    ctx.fillRect(0, 0, CW, CH)
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const n = (c * 19 + r * 31 + c * r * 3) % 11
        const base = locationSlug === 'mars'
          ? [76 + n * 2, 38 + n, 23 + Math.floor(n * 0.6)]
          : [40 + n, 42 + n, 43 + n]
        diamond(ctx, c, r, `rgb(${base[0]},${base[1]},${base[2]})`)
      }
    }
    streets.forEach(street => road(ctx, street))
    for (const building of buildings) {
      const p = iso(building.tile_col + 0.5, building.tile_row + 0.5)
      const street = anchor(building)
      ctx.fillStyle = 'rgba(19,23,24,.72)'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, 48, 23, 0, 0, Math.PI * 2)
      ctx.fill()
      if (street) {
        const q = iso(street.col, street.row)
        ctx.strokeStyle = '#5a5d59'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(q.x, q.y)
        ctx.stroke()
      }
    }
  }, [locationSlug, streets, buildings, anchor])

  const wheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const rect = mapRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.88 : 1.14)))
    const worldX = viewport.x + localX / zoom
    const worldY = viewport.y + localY / zoom
    setZoom(next)
    setViewport(clamp(worldX - localX / next, worldY - localY / next, next))
  }

  const district = zoom >= 1.45
  const transform = `translate(${-viewport.x * zoom}px,${-viewport.y * zoom}px) scale(${zoom})`
  const depth = useMemo(() => [
    ...buildings.map(building => ({ kind: 'b' as const, d: building.tile_col + building.tile_row, building })),
    ...positions.map(position => ({ kind: 'p' as const, d: position.col + position.row, position })),
    { kind: 'me' as const, d: fig.col + fig.row },
  ].sort((a, b) => a.d - b.d), [buildings, positions, fig])

  const workers = selectedBuilding ? residents.filter(r => r.assignments.some(a => a.type === 'work' && a.tileEntityId === selectedBuilding.id)) : []
  const homes = selectedBuilding ? residents.filter(r => r.assignments.some(a => a.type === 'home' && a.tileEntityId === selectedBuilding.id)) : []
  const work = selectedPerson ? assignment(selectedPerson, 'work') : null
  const home = selectedPerson ? assignment(selectedPerson, 'home') : null
  const workBuilding = buildings.find(b => b.id === work?.tileEntityId)
  const homeBuilding = buildings.find(b => b.id === home?.tileEntityId)
  const lowNeed = selectedPerson ? [...selectedPerson.needs].sort((a, b) => a.satisfaction - b.satisfaction)[0] : null
  const selectedPosition = selectedPerson ? positions.find(p => p.resident.id === selectedPerson.id) : null
  const virtualHour = Math.floor(dayProgress * 24)
  const virtualMinute = Math.floor((dayProgress * 24 - virtualHour) * 60)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#081019', display: 'grid', gridTemplateRows: '42px minmax(0,1fr) 48px', fontFamily: 'monospace' }}>
      <BuildingSpriteStyles />
      <IsometricBuildingStyles />
      <ColonyActivityStyles />
      <NpcVisualStyles />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', background: '#142230', color: '#f1d57a' }}>
        <b>NOXIA · {locationName.toUpperCase()} <span style={{ color: '#9eabb8' }}>POP {population.toLocaleString()} · SIM {residents.length} · {district ? 'DISTRIKT' : 'STRATEGIE'} · {String(virtualHour).padStart(2, '0')}:{String(virtualMinute).padStart(2, '0')}</span></b>
        <div>
          <button onClick={() => { setShowPeople(value => !value); setSelection(null) }} style={{ ...action, width: 'auto' }}>PERSONEN [{residents.length}]</button>{' '}
          <button onClick={onClose} style={{ ...action, width: 'auto' }}>SCHLIESSEN</button>
        </div>
      </header>

      <main style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          ref={mapRef}
          onWheel={wheel}
          onPointerDown={event => {
            if ((event.target as HTMLElement).closest('button')) return
            drag.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y }
          }}
          onPointerMove={event => {
            const current = drag.current
            if (!current) return
            setViewport(clamp(current.vx - (event.clientX - current.x) / zoom, current.vy - (event.clientY - current.y) / zoom))
          }}
          onPointerUp={() => { drag.current = null }}
          onPointerLeave={() => { drag.current = null }}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'grab' }}
        >
          <canvas ref={canvasRef} width={CW} height={CH} style={{ position: 'absolute', transformOrigin: '0 0', transform, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: CW, height: CH, transformOrigin: '0 0', transform, pointerEvents: 'none' }}>
            {depth.map(item => {
              if (item.kind === 'b') {
                const building = item.building
                const p = iso(building.tile_col + 0.5, building.tile_row + 0.5)
                const selected = selection?.kind === 'building' && selection.id === building.id
                return (
                  <button
                    key={building.id}
                    onClick={event => {
                      event.stopPropagation()
                      setSelection({ kind: 'building', id: building.id })
                      setShowPeople(false)
                    }}
                    onDoubleClick={() => onEnterBuilding?.(building)}
                    style={{ position: 'absolute', left: p.x - 50, top: p.y - 88, width: 100, height: 96, border: selected ? '1px solid #f1d57a' : '1px solid transparent', borderRadius: 14, background: selected ? '#f1d57a18' : 'transparent', padding: 0, pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <IsometricBuilding entityId={building.entity_id} planet={locationSlug} owned={building.profile_id === userId} size={district ? 78 : 70} />
                    {building.entity_id === 'water_recycler' && <MachineActivity left={28} top={18} />}
                    <ServiceCrate left={72} top={68} />
                  </button>
                )
              }
              if (item.kind === 'p') {
                const p = iso(item.position.col, item.position.row)
                const resident = item.position.resident
                return (
                  <div key={resident.id} style={{ position: 'absolute', left: p.x - 12, top: p.y - 35, pointerEvents: 'auto' }}>
                    <NpcFigure
                      id={resident.id}
                      name={resident.displayName}
                      role={role(resident)}
                      moving={item.position.routine.moving}
                      selected={selection?.kind === 'person' && selection.id === resident.id}
                      showLabel={district || selection?.id === resident.id}
                      onClick={() => setSelection({ kind: 'person', id: resident.id })}
                    />
                  </div>
                )
              }
              const p = iso(fig.col + 0.15, fig.row + 0.15)
              return <div key="player" style={{ position: 'absolute', left: p.x - 12, top: p.y - 35, pointerEvents: 'none' }}><NpcFigure id={userId} name="Du" role="operations" showLabel /></div>
            })}

            {streets.slice(0, Math.min(3, streets.length)).map((street, index) => {
              const p = iso(street.col + 0.25, street.row + 0.15)
              return <Rover key={`rover-${index}`} left={p.x - 17} top={p.y - 18} />
            })}
          </div>
        </div>

        {(showPeople || selection) && (
          <aside style={{ ...panel, position: 'absolute', zIndex: 80, top: 10, right: 10, bottom: 10, width: 300, padding: 10, overflowY: 'auto' }}>
            <button onClick={() => { setSelection(null); setShowPeople(false) }} style={{ float: 'right' }}>×</button>
            {showPeople ? residents.map(resident => {
              const current = positions.find(p => p.resident.id === resident.id)
              return (
                <button key={resident.id} onClick={() => { setSelection({ kind: 'person', id: resident.id }); setShowPeople(false) }} style={{ display: 'block', width: '100%', padding: 0, marginBottom: 6, border: 0, cursor: 'pointer' }}>
                  <NpcPortrait id={resident.id} name={resident.displayName} role={`${role(resident)} · ${current?.routine.label ?? '—'}`} />
                </button>
              )
            }) : selectedBuilding ? (
              <>
                <small>GEBÄUDE</small>
                <h3>{label(selectedBuilding.entity_id)}</h3>
                <div>Koordinate {selectedBuilding.tile_col},{selectedBuilding.tile_row}</div>
                <div style={section}>{workers.length} Arbeitende · {homes.length} Wohnende</div>
                <button style={action} onClick={() => onEnterBuilding?.(selectedBuilding)}>BETRETEN</button>
              </>
            ) : selectedPerson ? (
              <>
                <small>PERSON</small>
                <NpcPortrait id={selectedPerson.id} name={selectedPerson.displayName} role={role(selectedPerson)} />
                <div style={section}><b>Tagesablauf</b><br />{selectedPosition?.routine.label ?? '—'}</div>
                <div style={section}>Arbeit: {workBuilding ? label(workBuilding.entity_id) : '—'}<br />Wohnen: {homeBuilding ? label(homeBuilding.entity_id) : '—'}</div>
                <div style={section}>Simulationsstatus: {selectedPerson.activityState}<br />{selectedPerson.lastAction ?? 'Keine aktuelle Aktion'}</div>
                <div style={section}>{lowNeed && lowNeed.satisfaction < 0.6 ? `${lowNeed.code}: ${pct(lowNeed.satisfaction)}` : 'Bedürfnisse stabil'}</div>
              </>
            ) : null}
          </aside>
        )}
      </main>

      <footer style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#172230', color: '#9eabb8', fontSize: 9 }}>
        <span>{buildings.length} GEBÄUDE · {streets.length} STRASSEN · {residents.length} PERSONEN</span>
        <span>NPC-TAGESZYKLUS · ZOOM {Math.round(zoom * 100)}%</span>
      </footer>
    </div>
  )
}
