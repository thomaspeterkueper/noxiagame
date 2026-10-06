import type {
  LocalSurfaceBuilding,
  LocalSurfaceMobileObject,
  LocalSurfacePath,
  LocalSurfacePoint,
  LocalSurfaceScene,
} from './localSurfaceScene'

export type LocalSceneInteractionKind = 'building' | 'person' | 'vehicle' | 'object'

export type LocalSceneInteraction = {
  id: string
  kind: LocalSceneInteractionKind
  label: string
  point: LocalSurfacePoint
  rangeM: number
  building?: LocalSurfaceBuilding
  mobileObject?: LocalSurfaceMobileObject
}

export type LocalSceneRoute = {
  points: LocalSurfacePoint[]
  distanceM: number
  usesNetwork: boolean
}

const WALKABLE_PATH_KINDS = new Set<LocalSurfacePath['kind']>([
  'road',
  'service-path',
  'pressurized-corridor',
  'surface-tube',
  'tether-corridor',
  'anchor-line',
  'cargo-transfer-link',
  'eva-route',
])

type Segment = {
  pathId: string
  a: LocalSurfacePoint
  b: LocalSurfacePoint
  length: number
  aKey: string
  bKey: string
}

type Projection = {
  point: LocalSurfacePoint
  segment: Segment
  t: number
  offDistance: number
}

type Edge = { to: string; weight: number }

function distance(a: LocalSurfacePoint, b: LocalSurfacePoint) {
  return Math.hypot(a.xM - b.xM, a.yM - b.yM)
}

function pointKey(point: LocalSurfacePoint) {
  // Quarter-metre quantisation joins path vertices produced by independent
  // surface adapters without making the runtime body-specific.
  return `${Math.round(point.xM * 4) / 4}:${Math.round(point.yM * 4) / 4}`
}

function addEdge(graph: Map<string, Edge[]>, from: string, to: string, weight: number) {
  if (!Number.isFinite(weight) || weight < 0) return
  const edges = graph.get(from) ?? []
  const existing = edges.find(edge => edge.to === to)
  if (!existing || weight < existing.weight) {
    graph.set(from, existing
      ? edges.map(edge => edge.to === to ? { to, weight } : edge)
      : [...edges, { to, weight }])
  }
}

function walkableSegments(scene: LocalSurfaceScene) {
  const segments: Segment[] = []
  for (const path of scene.paths) {
    if (!WALKABLE_PATH_KINDS.has(path.kind)) continue
    for (let index = 1; index < path.points.length; index += 1) {
      const a = path.points[index - 1]
      const b = path.points[index]
      const length = distance(a, b)
      if (length < 0.05) continue
      segments.push({
        pathId: path.id,
        a,
        b,
        length,
        aKey: pointKey(a),
        bKey: pointKey(b),
      })
    }
  }
  return segments
}

function projectToSegment(point: LocalSurfacePoint, segment: Segment): Projection {
  const dx = segment.b.xM - segment.a.xM
  const dy = segment.b.yM - segment.a.yM
  const denom = dx * dx + dy * dy
  const rawT = denom > 0
    ? ((point.xM - segment.a.xM) * dx + (point.yM - segment.a.yM) * dy) / denom
    : 0
  const t = Math.max(0, Math.min(1, rawT))
  const projected = {
    xM: segment.a.xM + dx * t,
    yM: segment.a.yM + dy * t,
  }
  return { point: projected, segment, t, offDistance: distance(point, projected) }
}

function nearestProjection(point: LocalSurfacePoint, segments: Segment[]) {
  let best: Projection | null = null
  for (const segment of segments) {
    const projection = projectToSegment(point, segment)
    if (!best || projection.offDistance < best.offDistance) best = projection
  }
  return best
}

function pushUnique(points: LocalSurfacePoint[], point: LocalSurfacePoint) {
  if (!points.length || distance(points[points.length - 1], point) > 0.05) points.push(point)
}

function dijkstra(graph: Map<string, Edge[]>, start: string, end: string) {
  const dist = new Map<string, number>([[start, 0]])
  const prev = new Map<string, string>()
  const open = new Set<string>([start])

  while (open.size) {
    let current: string | null = null
    let best = Number.POSITIVE_INFINITY
    for (const key of open) {
      const value = dist.get(key) ?? Number.POSITIVE_INFINITY
      if (value < best) {
        best = value
        current = key
      }
    }
    if (!current) break
    open.delete(current)
    if (current === end) break

    for (const edge of graph.get(current) ?? []) {
      const next = best + edge.weight
      if (next >= (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue
      dist.set(edge.to, next)
      prev.set(edge.to, current)
      open.add(edge.to)
    }
  }

  if (!dist.has(end)) return null
  const keys: string[] = []
  let cursor: string | undefined = end
  while (cursor) {
    keys.push(cursor)
    if (cursor === start) break
    cursor = prev.get(cursor)
  }
  if (keys[keys.length - 1] !== start) return null
  return { keys: keys.reverse(), distanceM: dist.get(end) ?? 0 }
}

/**
 * Finds a shortest route over the local walkable path network.
 *
 * Start and target are connected to their nearest path segment. If either point
 * is too far from the network, the runtime falls back to a direct local route
 * rather than fabricating a path.
 */
export function routeAcrossLocalScene(
  scene: LocalSurfaceScene,
  start: LocalSurfacePoint,
  end: LocalSurfacePoint,
  options?: { maxConnectorM?: number },
): LocalSceneRoute {
  const directDistance = distance(start, end)
  if (directDistance < 0.05) return { points: [start], distanceM: 0, usesNetwork: false }

  const maxConnectorM = Math.max(2, options?.maxConnectorM ?? 45)
  const segments = walkableSegments(scene)
  if (!segments.length) return { points: [start, end], distanceM: directDistance, usesNetwork: false }

  const startProjection = nearestProjection(start, segments)
  const endProjection = nearestProjection(end, segments)
  if (!startProjection || !endProjection || startProjection.offDistance > maxConnectorM || endProjection.offDistance > maxConnectorM) {
    return { points: [start, end], distanceM: directDistance, usesNetwork: false }
  }

  const graph = new Map<string, Edge[]>()
  const pointByKey = new Map<string, LocalSurfacePoint>()
  for (const segment of segments) {
    pointByKey.set(segment.aKey, segment.a)
    pointByKey.set(segment.bKey, segment.b)
    addEdge(graph, segment.aKey, segment.bKey, segment.length)
    addEdge(graph, segment.bKey, segment.aKey, segment.length)
  }

  const startKey = '@start'
  const endKey = '@end'
  const startAlongA = startProjection.t * startProjection.segment.length
  const startAlongB = (1 - startProjection.t) * startProjection.segment.length
  const endAlongA = endProjection.t * endProjection.segment.length
  const endAlongB = (1 - endProjection.t) * endProjection.segment.length

  addEdge(graph, startKey, startProjection.segment.aKey, startProjection.offDistance + startAlongA)
  addEdge(graph, startKey, startProjection.segment.bKey, startProjection.offDistance + startAlongB)
  addEdge(graph, endProjection.segment.aKey, endKey, endProjection.offDistance + endAlongA)
  addEdge(graph, endProjection.segment.bKey, endKey, endProjection.offDistance + endAlongB)

  if (startProjection.segment === endProjection.segment) {
    const sameSegmentDistance = startProjection.offDistance
      + Math.abs(startProjection.t - endProjection.t) * startProjection.segment.length
      + endProjection.offDistance
    addEdge(graph, startKey, endKey, sameSegmentDistance)
  }

  const result = dijkstra(graph, startKey, endKey)
  if (!result) return { points: [start, end], distanceM: directDistance, usesNetwork: false }

  const points: LocalSurfacePoint[] = []
  pushUnique(points, start)
  pushUnique(points, startProjection.point)
  for (const key of result.keys) {
    const point = pointByKey.get(key)
    if (point) pushUnique(points, point)
  }
  pushUnique(points, endProjection.point)
  pushUnique(points, end)

  return { points, distanceM: result.distanceM, usesNetwork: true }
}

function rotateIntoBuilding(point: LocalSurfacePoint, building: LocalSurfaceBuilding) {
  const angle = -(building.rotationDeg || 0) * Math.PI / 180
  const dx = point.xM - building.center.xM
  const dy = point.yM - building.center.yM
  return {
    xM: dx * Math.cos(angle) - dy * Math.sin(angle),
    yM: dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

export function distanceToBuildingFootprint(point: LocalSurfacePoint, building: LocalSurfaceBuilding) {
  const local = rotateIntoBuilding(point, building)
  const halfW = building.widthM / 2
  const halfD = building.depthM / 2
  const dx = Math.max(Math.abs(local.xM) - halfW, 0)
  const dy = Math.max(Math.abs(local.yM) - halfD, 0)
  return Math.hypot(dx, dy)
}

export function pointBlockedByBuilding(
  point: LocalSurfacePoint,
  building: LocalSurfaceBuilding,
  clearanceM = 0.8,
) {
  const local = rotateIntoBuilding(point, building)
  return Math.abs(local.xM) < building.widthM / 2 + clearanceM
    && Math.abs(local.yM) < building.depthM / 2 + clearanceM
}

export function isLocalScenePointWalkable(scene: LocalSurfaceScene, point: LocalSurfacePoint, clearanceM = 0.8) {
  if (Math.abs(point.xM) > scene.radiusM || Math.abs(point.yM) > scene.radiusM) return false
  return !scene.buildings.some(building => pointBlockedByBuilding(point, building, clearanceM))
}

/**
 * Resolves one player/NPC step against the same scene geometry on every body.
 * If a diagonal move clips a footprint, axis sliding is attempted before the
 * actor is stopped.
 */
export function resolveLocalSceneStep(
  scene: LocalSurfaceScene,
  current: LocalSurfacePoint,
  desired: LocalSurfacePoint,
  clearanceM = 0.8,
) {
  const clamped = {
    xM: Math.max(-scene.radiusM, Math.min(scene.radiusM, desired.xM)),
    yM: Math.max(-scene.radiusM, Math.min(scene.radiusM, desired.yM)),
  }
  if (isLocalScenePointWalkable(scene, clamped, clearanceM)) return clamped

  const xOnly = { xM: clamped.xM, yM: current.yM }
  if (isLocalScenePointWalkable(scene, xOnly, clearanceM)) return xOnly

  const yOnly = { xM: current.xM, yM: clamped.yM }
  if (isLocalScenePointWalkable(scene, yOnly, clearanceM)) return yOnly

  return current
}

export function advanceAlongLocalSceneRoute(
  scene: LocalSurfaceScene,
  current: LocalSurfacePoint,
  route: LocalSceneRoute,
  stepM = 2,
) {
  let cursor = current
  let remaining = Math.max(0.1, stepM)

  for (const waypoint of route.points) {
    const segmentDistance = distance(cursor, waypoint)
    if (segmentDistance < 0.05) continue

    if (segmentDistance <= remaining) {
      const next = resolveLocalSceneStep(scene, cursor, waypoint)
      if (distance(next, cursor) < 0.01) return cursor
      cursor = next
      remaining -= segmentDistance
      if (remaining <= 0.05) return cursor
      continue
    }

    const ratio = remaining / segmentDistance
    return resolveLocalSceneStep(scene, cursor, {
      xM: cursor.xM + (waypoint.xM - cursor.xM) * ratio,
      yM: cursor.yM + (waypoint.yM - cursor.yM) * ratio,
    })
  }

  return cursor
}

function mobileKind(object: LocalSurfaceMobileObject): LocalSceneInteractionKind {
  const role = String(object.role ?? '').toLowerCase()
  if (/person|npc|crew|resident|human/.test(role)) return 'person'
  if (/vehicle|rover|truck|hauler|robot|shuttle|drone/.test(role)) return 'vehicle'
  return 'object'
}

export function localSceneInteractions(scene: LocalSurfaceScene): LocalSceneInteraction[] {
  const buildings: LocalSceneInteraction[] = scene.buildings.map(building => ({
    id: `building:${building.id}`,
    kind: 'building',
    label: building.label ?? building.entityId ?? 'Gebäude',
    point: building.center,
    rangeM: 5,
    building,
  }))

  const mobileObjects: LocalSceneInteraction[] = scene.mobileObjects.map(object => ({
    id: `mobile:${object.id}`,
    kind: mobileKind(object),
    label: object.label,
    point: object.point,
    rangeM: 5,
    mobileObject: object,
  }))

  return [...buildings, ...mobileObjects]
}

export function localSceneInteractionDistance(origin: LocalSurfacePoint, interaction: LocalSceneInteraction) {
  if (interaction.building) return distanceToBuildingFootprint(origin, interaction.building)
  return distance(origin, interaction.point)
}
