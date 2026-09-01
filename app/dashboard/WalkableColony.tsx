'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectedStreetNeighbours, getStreetTiles, nearestStreetTile, type StreetTile } from '@/lib/game/streetTiles'
import { virtualDayProgress } from '@/lib/game/npcDailyRoutine'
import { simulateNpcSpatialState } from '@/lib/game/npcSpatialSimulation'
import { nearestInteraction, type Interactable } from '@/lib/game/interactions'
import { BUILDINGS } from '@/lib/game/buildings/index'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { useColonyInteractionStore } from '@/lib/store/colonyInteractionStore'
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

interface Props {
  locationSlug: string
  locationName: string
  population: number
  entities: TileEntity[]
  pending: unknown[]
  residents?: ColonyResident[]
  ships: Ship[]
  locationId: string
  userId: string
  onClose: () => void
  onEnterBuilding?: (entity: TileEntity) => void
}

type RoverPosition = { id: string; col: number; row: number }

const COLS = 32
const ROWS = 24
const IW = 56
const IH = 28
const CW = (COLS + ROWS) * IW + 240
const CH = (COLS + ROWS) * IH + 320
const MIN_ZOOM = 0.72
const MAX_ZOOM = 2.8
const START_ZOOM = 1.36

const panel: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(14,25,36,.96),rgba(8,15,23,.96))',
  border: '1px solid #3b5367',
  color: '#d8d4c8',
  boxShadow: '0 14px 34px rgba(0,0,0,.35)',
  backdropFilter: 'blur(8px)',
}

const action: React.CSSProperties = {
  padding: '7px 10px',
  background: '#20384d',
  color: '#f4dc88',
  border: '1px solid #516b80',
  borderRadius: 5,
  font: 'bold 10px monospace',
  cursor: 'pointer',
}

const section: React.CSSProperties = { borderTop: '1px solid #344657', paddingTop: 10, marginTop: 10 }

function iso(c: number, r: number) {
  return { x: (c - r) * IW + CW / 2, y: (c + r) * IH + 100 }
}

function label(id: string) {
  return BUILDINGS[id]?.name ?? id.replace(/_/g, ' ')
}

function assignment(resident: ColonyResident, type: string) {
  return resident.assignments.find(item => item.type === type)
}

function role(resident: ColonyResident) {
  return assignment(resident, 'work')?.roleCode ?? resident.activityState
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
  residents = [],
  userId,
  onClose,
  onEnterBuilding,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [viewport, setViewport] = useState({ x: Math.max(0, CW / 2 - 500), y: 0 })
  const [zoom, setZoom] = useState(START_ZOOM)
  const [tick, setTick] = useState(0)

  const playerPosition = useColonyInteractionStore(state => state.playerPosition)
  const selection = useColonyInteractionStore(state => state.selection)
  const showPeople = useColonyInteractionStore(state => state.showPeople)
  const nearbyInteraction = useColonyInteractionStore(state => state.nearbyInteraction)
  const setPlayerPosition = useColonyInteractionStore(state => state.setPlayerPosition)
  const setSelection = useColonyInteractionStore(state => state.setSelection)
  const setShowPeople = useColonyInteractionStore(state => state.setShowPeople)
  const setNearbyInteraction = useColonyInteractionStore(state => state.setNearbyInteraction)
  const selectInteraction = useColonyInteractionStore(state => state.selectInteraction)
  const resetInteractionForLocation = useColonyInteractionStore(state => state.resetForLocation)
  const clearSelection = useColonyInteractionStore(state => state.clearSelection)
  const fig = playerPosition ?? { col: 0, row: 0 }

  const buildings = useMemo(() => entities.filter(entity => entity.entity_type === 'building'), [entities])
  const streets = useMemo(
    () => getStreetTiles(locationSlug, population, entities, pending, userId, COLS, ROWS),
    [locationSlug, population, entities, pending, userId],
  )
  const streetMap = useMemo(() => new Map(streets.map(street => [`${street.col}:${street.row}`, street])), [streets])

  const colonyFocus = useMemo(() => {
    if (!buildings.length) return { col: 16, row: 12 }
    const cols = buildings.map(building => building.tile_col + 0.5)
    const rows = buildings.map(building => building.tile_row + 0.5)
    return {
      col: (Math.min(...cols) + Math.max(...cols)) / 2,
      row: (Math.min(...rows) + Math.max(...rows)) / 2,
    }
  }, [buildings])

  const selectedBuilding = selection?.kind === 'building' ? buildings.find(building => building.id === selection.id) ?? null : null
  const selectedPerson = selection?.kind === 'person' ? residents.find(resident => resident.id === selection.id) ?? null : null

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
    setViewport(clamp(
      p.x - (rect?.width ?? 900) / (2 * z),
      p.y - (rect?.height ?? 560) / (2 * z),
      z,
    ))
  }, [zoom, clamp])

  const anchor = useCallback(
    (building?: TileEntity) => building ? nearestStreetTile(building.tile_row, building.tile_col, streets) : null,
    [streets],
  )

  useEffect(() => {
    resetInteractionForLocation(locationSlug)
  }, [locationSlug, resetInteractionForLocation])

  useEffect(() => {
    const id = setInterval(() => setTick(value => value + 1), 450)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const habitat = buildings.find(building => building.entity_id === 'habitat' && building.profile_id === userId)
    const street = nearestStreetTile(habitat?.tile_row ?? colonyFocus.row, habitat?.tile_col ?? colonyFocus.col, streets)
    if (street) setPlayerPosition({ col: street.col, row: street.row })
    setZoom(START_ZOOM)
    center(colonyFocus.col, colonyFocus.row, START_ZOOM)
  }, [locationSlug, streets, buildings, userId, colonyFocus, center, setPlayerPosition])

  const dayProgress = virtualDayProgress(tick)
  const positions = useMemo(() => simulateNpcSpatialState({
    residents,
    buildings,
    streets,
    dayProgress,
  }), [residents, buildings, streets, dayProgress])

  const rovers = useMemo<RoverPosition[]>(() => streets.slice(0, Math.min(3, streets.length)).map((street, index) => ({
    id: `rover-${index}`,
    col: street.col + 0.25,
    row: street.row + 0.15,
  })), [streets])

  const interactables = useMemo<Interactable[]>(() => {
    const buildingItems = buildings.flatMap<Interactable>(building => {
      const street = anchor(building)
      if (!street) return []
      return [{
        kind: 'building',
        id: building.id,
        label: label(building.entity_id),
        action: 'BETRETEN',
        col: street.col,
        row: street.row,
        range: 1.25,
      }]
    })

    const peopleItems: Interactable[] = positions.map(position => ({
      kind: 'person',
      id: position.resident.id,
      label: position.resident.displayName,
      action: 'ANSPRECHEN',
      col: position.col,
      row: position.row,
      range: 0.9,
    }))

    const vehicleItems: Interactable[] = rovers.map(rover => ({
      kind: 'vehicle',
      id: rover.id,
      label: 'Rover',
      action: 'PRÜFEN',
      col: rover.col,
      row: rover.row,
      range: 1,
    }))

    return [...buildingItems, ...peopleItems, ...vehicleItems]
  }, [buildings, positions, rovers, anchor])

  const calculatedNearbyInteraction = useMemo(
    () => playerPosition ? nearestInteraction(playerPosition, interactables) : null,
    [playerPosition, interactables],
  )

  useEffect(() => {
    setNearbyInteraction(calculatedNearbyInteraction)
  }, [calculatedNearbyInteraction, setNearbyInteraction])

  const openInteraction = useCallback((interaction: Interactable) => {
    selectInteraction(interaction)
    if (interaction.kind !== 'building') return
    const building = buildings.find(item => item.id === interaction.id)
    if (building) onEnterBuilding?.(building)
  }, [buildings, onEnterBuilding, selectInteraction])

  const movePlayer = useCallback((key: string) => {
    if (!playerPosition) return false
    const current = streetMap.get(`${Math.round(playerPosition.col)}:${Math.round(playerPosition.row)}`)
    if (!current) return false
    const directions: Record<string, [number, number]> = {
      w: [-1, 0],
      s: [1, 0],
      a: [0, -1],
      d: [0, 1],
    }
    const delta = directions[key]
    if (!delta) return false
    const next = connectedStreetNeighbours(current, streets)
      .find(neighbour => neighbour.row === current.row + delta[0] && neighbour.col === current.col + delta[1])
    if (!next) return true
    setPlayerPosition({ col: next.col, row: next.row })
    center(next.col, next.row, zoom)
    return true
  }, [playerPosition, streetMap, streets, setPlayerPosition, center, zoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return

      if (event.key === 'Escape') {
        if (selection || showPeople) clearSelection()
        else onClose()
        return
      }

      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault()
        movePlayer(key)
        return
      }

      if ((key === 'f' || event.key === 'Enter') && nearbyInteraction) {
        event.preventDefault()
        openInteraction(nearbyInteraction)
        return
      }

      if (key === 'c' && playerPosition) {
        event.preventDefault()
        center(playerPosition.col, playerPosition.row)
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        const step = 55 / zoom
        setViewport(value => clamp(
          value.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
          value.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
        ))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, showPeople, clearSelection, onClose, movePlayer, nearbyInteraction, openInteraction, playerPosition, center, zoom, clamp])

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
      ctx.ellipse(p.x, p.y, 54, 26, 0, 0, Math.PI * 2)
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
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.9 : 1.11)))
    const worldX = viewport.x + localX / zoom
    const worldY = viewport.y + localY / zoom
    setZoom(next)
    setViewport(clamp(worldX - localX / next, worldY - localY / next, next))
  }

  const district = zoom >= 1.18
  const transform = `translate(${-viewport.x * zoom}px,${-viewport.y * zoom}px) scale(${zoom})`
  const depth = useMemo(() => [
    ...buildings.map(building => ({ kind: 'b' as const, d: building.tile_col + building.tile_row, building })),
    ...positions.map(position => ({ kind: 'p' as const, d: position.col + position.row, position })),
    ...(playerPosition ? [{ kind: 'me' as const, d: playerPosition.col + playerPosition.row }] : []),
  ].sort((a, b) => a.d - b.d), [buildings, positions, playerPosition])

  const workers = selectedBuilding ? residents.filter(resident => resident.assignments.some(item => item.type === 'work' && item.tileEntityId === selectedBuilding.id)) : []
  const homes = selectedBuilding ? residents.filter(resident => resident.assignments.some(item => item.type === 'home' && item.tileEntityId === selectedBuilding.id)) : []
  const work = selectedPerson ? assignment(selectedPerson, 'work') : null
  const home = selectedPerson ? assignment(selectedPerson, 'home') : null
  const workBuilding = buildings.find(building => building.id === work?.tileEntityId)
  const homeBuilding = buildings.find(building => building.id === home?.tileEntityId)
  const lowNeed = selectedPerson ? [...selectedPerson.needs].sort((a, b) => a.satisfaction - b.satisfaction)[0] : null
  const selectedPosition = selectedPerson ? positions.find(position => position.resident.id === selectedPerson.id) : null
  const selectedVehicle = selection?.kind === 'vehicle' ? rovers.find(rover => rover.id === selection.id) ?? null : null
  const virtualHour = Math.floor(dayProgress * 24)
  const virtualMinute = Math.floor((dayProgress * 24 - virtualHour) * 60)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#081019', display: 'grid', gridTemplateRows: '36px minmax(0,1fr) 30px', fontFamily: 'monospace' }}>
      <BuildingSpriteStyles />
      <IsometricBuildingStyles />
      <ColonyActivityStyles />
      <NpcVisualStyles />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 12px', background: 'linear-gradient(90deg,#122334,#0c1824)', color: '#f1d57a', borderBottom: '1px solid #294259' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <b style={{ letterSpacing: '.08em' }}>{locationName.toUpperCase()}</b>
          <span style={{ color: '#92a7b8', fontSize: 9 }}>POP {population.toLocaleString()} · {residents.length} AKTIV · {String(virtualHour).padStart(2, '0')}:{String(virtualMinute).padStart(2, '0')}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowPeople(!showPeople)} style={action}>PERSONEN {residents.length}</button>
          <button onClick={onClose} style={{ ...action, background: '#3a3020' }}>PLANEN & BAUEN</button>
        </div>
      </header>

      <main style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 50% 43%,rgba(109,61,35,.12),transparent 52%),#090b0e' }}>
        <div
          ref={mapRef}
          onWheel={wheel}
          onPointerDown={event => {
            if ((event.target as HTMLElement).closest('button')) return
            drag.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={event => {
            const current = drag.current
            if (!current) return
            setViewport(clamp(current.vx - (event.clientX - current.x) / zoom, current.vy - (event.clientY - current.y) / zoom))
          }}
          onPointerUp={event => {
            drag.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => { drag.current = null }}
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
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => {
                      event.stopPropagation()
                      setSelection({ kind: 'building', id: building.id })
                    }}
                    onDoubleClick={() => onEnterBuilding?.(building)}
                    style={{ position: 'absolute', left: p.x - 58, top: p.y - 104, width: 116, height: 112, border: selected ? '1px solid #f1d57a' : '1px solid transparent', borderRadius: 16, background: selected ? '#f1d57a16' : 'transparent', padding: 0, pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <IsometricBuilding entityId={building.entity_id} planet={locationSlug} owned={building.profile_id === userId} size={district ? 102 : 92} />
                    {building.entity_id === 'water_recycler' && <MachineActivity left={34} top={22} />}
                    <ServiceCrate left={84} top={80} />
                  </button>
                )
              }

              if (item.kind === 'p') {
                const p = iso(item.position.col, item.position.row)
                const resident = item.position.resident
                return (
                  <div key={resident.id} style={{ position: 'absolute', left: p.x - 12, top: p.y - 37, pointerEvents: 'auto', transform: 'scale(1.14)', transformOrigin: '50% 100%' }}>
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
              return <div key="player" style={{ position: 'absolute', left: p.x - 12, top: p.y - 37, pointerEvents: 'none', transform: 'scale(1.18)', transformOrigin: '50% 100%' }}><NpcFigure id={userId} name="Du" role="operations" showLabel /></div>
            })}

            {rovers.map(rover => {
              const p = iso(rover.col, rover.row)
              return <Rover key={rover.id} left={p.x - 17} top={p.y - 18} />
            })}
          </div>

          <div style={{ position: 'absolute', left: 10, top: 10, padding: '6px 8px', background: '#07101cdd', border: '1px solid #43586a', color: '#aebbc7', fontSize: 9 }}>
            WASD LAUFEN · PFEILE/ZIEHEN KAMERA · C FIGUR · F/ENTER INTERAKTION
          </div>

          {nearbyInteraction && (
            <button
              onPointerDown={event => event.stopPropagation()}
              onClick={() => openInteraction(nearbyInteraction)}
              style={{ position: 'absolute', left: 10, bottom: 10, padding: '8px 10px', background: '#182a25ee', border: '1px solid #6f9a79', color: '#d9e8d9', font: '10px monospace', cursor: 'pointer', boxShadow: '0 8px 22px #0008' }}
            >
              F · {nearbyInteraction.action} · {nearbyInteraction.label}
            </button>
          )}
        </div>

        {(showPeople || selection) && (
          <aside style={{ ...panel, position: 'absolute', zIndex: 80, top: 12, right: 12, bottom: 12, width: 280, padding: 12, overflowY: 'auto', borderRadius: 8 }}>
            <button onClick={clearSelection} style={{ float: 'right', border: 0, background: 'transparent', color: '#9db0be', cursor: 'pointer', fontSize: 18 }}>×</button>
            {showPeople ? residents.map(resident => {
              const current = positions.find(position => position.resident.id === resident.id)
              return (
                <button key={resident.id} onClick={() => setSelection({ kind: 'person', id: resident.id })} style={{ display: 'block', width: '100%', padding: 0, marginBottom: 6, border: 0, cursor: 'pointer', background: 'transparent' }}>
                  <NpcPortrait id={resident.id} name={resident.displayName} role={`${role(resident)} · ${current?.routine.label ?? '—'}`} />
                </button>
              )
            }) : selectedBuilding ? (
              <>
                <small style={{ color: '#7fa3bb', letterSpacing: '.12em' }}>GEBÄUDE</small>
                <h3 style={{ margin: '6px 0 10px' }}>{label(selectedBuilding.entity_id)}</h3>
                <div>Koordinate {selectedBuilding.tile_col},{selectedBuilding.tile_row}</div>
                <div style={section}>{workers.length} Arbeitende · {homes.length} Wohnende</div>
                <button style={{ ...action, width: '100%', marginTop: 10 }} onClick={() => onEnterBuilding?.(selectedBuilding)}>BETRETEN</button>
              </>
            ) : selectedPerson ? (
              <>
                <small style={{ color: '#7fa3bb', letterSpacing: '.12em' }}>PERSON</small>
                <NpcPortrait id={selectedPerson.id} name={selectedPerson.displayName} role={role(selectedPerson)} />
                <div style={section}><b>Tagesablauf</b><br />{selectedPosition?.routine.label ?? '—'}</div>
                <div style={section}>Arbeit: {workBuilding ? label(workBuilding.entity_id) : '—'}<br />Wohnen: {homeBuilding ? label(homeBuilding.entity_id) : '—'}</div>
                <div style={section}>Status: {selectedPerson.activityState}<br />{selectedPerson.lastAction ?? 'Keine aktuelle Aktion'}</div>
                <div style={section}>{lowNeed && lowNeed.satisfaction < 0.6 ? `${lowNeed.code}: ${pct(lowNeed.satisfaction)}` : 'Bedürfnisse stabil'}</div>
              </>
            ) : selectedVehicle ? (
              <>
                <small style={{ color: '#7fa3bb', letterSpacing: '.12em' }}>FAHRZEUG</small>
                <h3 style={{ margin: '6px 0 10px' }}>Rover</h3>
                <div>Position {selectedVehicle.col.toFixed(1)},{selectedVehicle.row.toFixed(1)}</div>
                <div style={section}>Interaktionsschnittstelle aktiv.</div>
              </>
            ) : null}
          </aside>
        )}
      </main>

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 11px', background: '#101b27', borderTop: '1px solid #273b4d', color: '#7f94a4', fontSize: 8 }}>
        <span>{buildings.length} GEBÄUDE · {residents.length} PERSONEN · {interactables.length} INTERAKTIV</span>
        <span>{playerPosition ? `POSITION ${Math.round(playerPosition.col)},${Math.round(playerPosition.row)} · ` : ''}ZOOM {Math.round(zoom * 100)}%</span>
      </footer>
    </div>
  )
}
