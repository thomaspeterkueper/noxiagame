'use client'

import { useEffect, useMemo, useState } from 'react'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { residentRoutine, virtualDayProgress } from '@/lib/game/npcDailyRoutine'
import { getStreetTiles, nearestStreetTile } from '@/lib/game/streetTiles'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'

type TileEntity = {
  id: string
  entity_id: string
  entity_type: string
  tile_row: number
  tile_col: number
  profile_id: string | null
}

type Resident = {
  id: string
  displayName: string
  activityState: string
  assignments?: { type: string; roleCode: string | null; tileEntityId: string | null }[]
}

type ResidentPosition = {
  resident: Resident
  col: number
  row: number
  moving: boolean
  activity: string
  socialGroup: number
}

type Props = {
  locationSlug: string
  population: number
  entities: TileEntity[]
  pending: unknown[]
  userId: string
}

const COLS = 32
const ROWS = 24

function residentRole(resident: Resident) {
  return resident.assignments?.find(a => a.type === 'work')?.roleCode ?? resident.activityState ?? 'general'
}

function assignment(resident: Resident, type: string) {
  return resident.assignments?.find(a => a.type === type)
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function distance(a: ResidentPosition, b: ResidentPosition) {
  return Math.hypot(a.col - b.col, a.row - b.row)
}

export default function ColonyConversationLayer({ locationSlug, population, entities, pending, userId }: Props) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [items, setItems] = useState<WorldAwarenessItem[]>([])
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([
      fetch(`/api/game/population?locationSlug=${encodeURIComponent(locationSlug)}`).then(r => r.ok ? r.json() : { residents: [] }),
      fetch('/api/game/world-awareness').then(r => r.ok ? r.json() : { items: [] }),
    ]).then(([populationData, awareness]) => {
      if (!live) return
      setResidents(Array.isArray(populationData.residents) ? populationData.residents : [])
      setItems(Array.isArray(awareness.items) ? awareness.items : [])
    }).catch(() => {})
    return () => { live = false }
  }, [locationSlug])

  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 450)
    return () => clearInterval(timer)
  }, [])

  const buildings = useMemo(() => entities.filter(entity => entity.entity_type === 'building'), [entities])
  const streets = useMemo(
    () => getStreetTiles(locationSlug, population, entities, pending, userId, COLS, ROWS),
    [locationSlug, population, entities, pending, userId],
  )
  const communityBuildings = useMemo(() => {
    const preferred = ['bar', 'school', 'habitat', 'residential_block', 'admin']
    return buildings.filter(building => preferred.includes(building.entity_id))
  }, [buildings])

  const positions = useMemo<ResidentPosition[]>(() => {
    const dayProgress = virtualDayProgress(tick)
    return residents.map(resident => {
      const routine = residentRoutine(resident.id, dayProgress)
      const workBuilding = buildings.find(building => building.id === assignment(resident, 'work')?.tileEntityId)
      const homeBuilding = buildings.find(building => building.id === assignment(resident, 'home')?.tileEntityId)
      const communityBuilding = communityBuildings.length
        ? communityBuildings[routine.socialGroup % communityBuildings.length]
        : homeBuilding
      const targetBuilding = routine.target === 'work' ? workBuilding : routine.target === 'community' ? communityBuilding : homeBuilding
      const anchor = targetBuilding ? nearestStreetTile(targetBuilding.tile_row, targetBuilding.tile_col, streets) : null
      if (!anchor) return null

      let col = anchor.col
      let row = anchor.row
      if (!routine.moving) {
        const angle = hash(`${resident.id}:group-angle`) * Math.PI * 2
        const radius = routine.target === 'community' ? 0.08 + hash(`${resident.id}:group-radius`) * 0.18 : 0.08 + hash(`${resident.id}:local-radius`) * 0.22
        col += Math.cos(angle) * radius
        row += Math.sin(angle) * radius
      }

      return {
        resident,
        col,
        row,
        moving: routine.moving,
        activity: routine.activity,
        socialGroup: routine.socialGroup,
      }
    }).filter((value): value is ResidentPosition => value !== null)
  }, [residents, buildings, communityBuildings, streets, tick])

  const scene = useMemo(() => {
    if (items.length < 1) return null
    const candidates = positions.filter(position => !position.moving && (position.activity === 'meal' || position.activity === 'community'))
    let best: { first: ResidentPosition; second: ResidentPosition; distance: number } | null = null

    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const first = candidates[i]
        const second = candidates[j]
        const d = distance(first, second)
        if (d > 0.65) continue
        const groupBonus = first.socialGroup === second.socialGroup ? -0.25 : 0
        if (!best || d + groupBonus < best.distance) best = { first, second, distance: d + groupBonus }
      }
    }

    if (!best) return null
    const dayKey = new Date().toISOString().slice(0, 10)
    const conversation = awarenessConversationForResident(best.first.resident.id, residentRole(best.first.resident), items, dayKey)
    if (!conversation) return null
    return {
      first: best.first.resident,
      second: best.second.resident,
      conversation,
      source: sourceForAwarenessItem(conversation.item),
      sameGroup: best.first.socialGroup === best.second.socialGroup,
    }
  }, [positions, items])

  useEffect(() => {
    if (!scene) setOpen(false)
  }, [scene])

  if (!scene) return null

  return (
    <div style={{ position: 'absolute', zIndex: 118, left: 16, bottom: 70, width: open ? 350 : 285, fontFamily: 'system-ui', color: '#e8f0f5' }}>
      <button onClick={() => setOpen(value => !value)} style={{ width: '100%', textAlign: 'left', border: '1px solid #45657c', borderRadius: open ? '9px 9px 0 0' : 9, background: '#091925ee', color: '#e8f0f5', padding: '9px 11px', cursor: 'pointer' }}>
        <small style={{ color: '#79a6c7', letterSpacing: '.1em' }}>GESPRÄCH IN DER NÄHE · ERDE</small><br />
        <b>{scene.first.displayName} + {scene.second.displayName}</b>
        <div style={{ marginTop: 2, color: '#8fa3b1', fontSize: 9 }}>{scene.sameGroup ? 'gleicher Sozialkreis · ' : ''}räumliche Begegnung</div>
      </button>
      {open && <div style={{ border: '1px solid #45657c', borderTop: 0, borderRadius: '0 0 9px 9px', background: '#071421f2', padding: 11, fontSize: 12, lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 8px' }}><b>{scene.first.displayName}:</b> „{scene.conversation.opener}“</p>
        <p style={{ margin: '0 0 9px', color: '#c8d5dd' }}><b>{scene.second.displayName}:</b> „{scene.conversation.followUp}“</p>
        <div style={{ color: '#8fa3b1', fontSize: 10 }}>Reale Meldung: {scene.source?.name ?? scene.conversation.item.sourceId}. Die Reaktionen der Bewohner sind fiktional.</div>
        <a href={scene.conversation.item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 7, color: '#f1d57a', fontSize: 10 }}>Originalquelle öffnen ↗</a>
      </div>}
    </div>
  )
}
