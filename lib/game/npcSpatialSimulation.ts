import { residentRoutine, type RoutinePlace, type RoutineStop } from './npcDailyRoutine'
import { nearestStreetTile, type StreetTile } from './streetTiles'
import { positionOnStreetPath, shortestStreetPath } from './npcStreetMovement'

/**
 * Client-side spatial projection only.
 *
 * This module does not decide what a person knows or does and never persists
 * population state. Those responsibilities remain with personBrain / the
 * population decision engine. It projects an already loaded resident set onto
 * colony streets for the interactive colony view.
 */

export interface NpcAssignment {
  type: string
  roleCode: string | null
  tileEntityId: string | null
}

export interface NpcNeed {
  code: string
  satisfaction: number
}

export interface NpcSkill {
  code: string
  level: number
  experience: number
}

export interface SpatialResident {
  id: string
  displayName: string
  birthYear: number | null
  activityState: string
  lastAction: string | null
  assignments: NpcAssignment[]
  needs: NpcNeed[]
  skills: NpcSkill[]
}

export interface SpatialBuilding {
  id: string
  entity_id: string
  tile_row: number
  tile_col: number
}

export interface SpatialPoint {
  col: number
  row: number
}

export interface NpcSpatialState extends SpatialPoint {
  resident: SpatialResident
  routine: RoutineStop
  homeBuildingId: string | null
  workBuildingId: string | null
  communityBuildingId: string | null
  homeAnchor: SpatialPoint | null
  workAnchor: SpatialPoint | null
  communityAnchor: SpatialPoint | null
}

interface SimulationInput {
  residents: SpatialResident[]
  buildings: SpatialBuilding[]
  streets: StreetTile[]
  dayProgress: number
}

const COMMUNITY_BUILDING_IDS = new Set(['bar', 'school', 'habitat', 'residential_block', 'admin'])

function assignment(resident: SpatialResident, type: string) {
  return resident.assignments.find(item => item.type === type)
}

function hash01(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function point(tile: StreetTile | null | undefined): SpatialPoint | null {
  return tile ? { col: tile.col, row: tile.row } : null
}

function tileFor(
  buildingId: string | null | undefined,
  anchorByBuildingId: Map<string, StreetTile | null>,
) {
  return buildingId ? anchorByBuildingId.get(buildingId) ?? null : null
}

function tileForPlace(
  place: RoutinePlace,
  anchors: Record<RoutinePlace, StreetTile | null>,
) {
  return anchors[place]
}

export function simulateNpcSpatialState({
  residents,
  buildings,
  streets,
  dayProgress,
}: SimulationInput): NpcSpatialState[] {
  if (!residents.length || !streets.length) return []

  const buildingById = new Map(buildings.map(building => [building.id, building]))
  const communityBuildings = buildings.filter(building => COMMUNITY_BUILDING_IDS.has(building.entity_id))
  const anchorByBuildingId = new Map<string, StreetTile | null>()

  for (const building of buildings) {
    anchorByBuildingId.set(
      building.id,
      nearestStreetTile(building.tile_row, building.tile_col, streets),
    )
  }

  const states: NpcSpatialState[] = []

  for (const resident of residents) {
    const routine = residentRoutine(resident.id, dayProgress)
    const workBuildingId = assignment(resident, 'work')?.tileEntityId ?? null
    const homeBuildingId = assignment(resident, 'home')?.tileEntityId ?? null
    const homeBuilding = homeBuildingId ? buildingById.get(homeBuildingId) ?? null : null
    const communityBuilding = communityBuildings.length
      ? communityBuildings[routine.socialGroup % communityBuildings.length]
      : homeBuilding
    const communityBuildingId = communityBuilding?.id ?? null

    const homeTile = tileFor(homeBuildingId, anchorByBuildingId)
    const workTile = tileFor(workBuildingId, anchorByBuildingId)
    const communityTile = tileFor(communityBuildingId, anchorByBuildingId)
    const anchors: Record<RoutinePlace, StreetTile | null> = {
      home: homeTile,
      work: workTile,
      community: communityTile,
    }

    const target = tileForPlace(routine.target, anchors)
    const fallback = target ?? workTile ?? homeTile ?? communityTile
    if (!fallback) continue

    let col = fallback.col
    let row = fallback.row

    if (routine.moving) {
      const from = tileForPlace(routine.from, anchors) ?? fallback
      const to = target ?? fallback
      const path = shortestStreetPath(from, to, streets)
      const projected = positionOnStreetPath(path, routine.progress)
      if (projected) {
        col = projected.col
        row = projected.row
      }
    } else {
      const angle = hash01(`${resident.id}:spatial-angle`) * Math.PI * 2
      const radius = routine.target === 'community'
        ? 0.08 + hash01(`${resident.id}:community-radius`) * 0.18
        : 0.08 + hash01(`${resident.id}:local-radius`) * 0.22
      col += Math.cos(angle) * radius
      row += Math.sin(angle) * radius
    }

    states.push({
      resident,
      col,
      row,
      routine,
      homeBuildingId,
      workBuildingId,
      communityBuildingId,
      homeAnchor: point(homeTile),
      workAnchor: point(workTile),
      communityAnchor: point(communityTile),
    })
  }

  return states
}
