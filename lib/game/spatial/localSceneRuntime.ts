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

/** Samples the complete traversed segment, not just its endpoint. */
function traversableSegment(scene: LocalSurfaceScene, a: LocalSurfacePoint, b: LocalSurfacePoint) {
  const length = distance(a, b)
  const steps = Math.max(1, Math.ceil(length / 0.75))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!isLocalScenePointWalkable(scene, { xM: a.xM + (b.xM - a.xM) * t, yM: a.yM + (b.yM - a.yM) * t })) return false
  }
  return true
}

/** Bounded local A* detour; never returns a path through an observed obstacle. */
function obstacleDetour(scene: LocalSurfaceScene, start: LocalSurfacePoint, end: LocalSurfacePoint): LocalSceneRoute {
  const blocked = (): LocalSceneRoute => ({ points: [start], distanceM: 0, usesNetwork: false })
  if (traversableSegment(scene, start, end)) return { points: [start, end], distanceM: distance(start, end), usesNetwork: false }
  if (!isLocalScenePointWalkable(scene, start) || !isLocalScenePointWalkable(scene, end)) return blocked()
  const step = 2
  const margin = 24
  const minX = Math.max(-scene.radiusM, Math.floor((Math.min(start.xM, end.xM) - margin) / step) * step)
  const minY = Math.max(-scene.radiusM, Math.floor((Math.min(start.yM, end.yM) - margin) / step) * step)
  const maxX = Math.min(scene.radiusM, Math.ceil((Math.max(start.xM, end.xM) + margin) / step) * step)
  const maxY = Math.min(scene.radiusM, Math.ceil((Math.max(start.yM, end.yM) + margin) / step) * step)
  const cols = Math.floor((maxX - minX) / step) + 1
  const rows = Math.floor((maxY - minY) / step) + 1
  if (cols * rows > 20000) return blocked()
  const point = (x: number, y: number) => ({ xM: minX + x * step, yM: minY + y * step })
  const key = (x: number, y: number) => y * cols + x
  const coords = (id: number) => ({ x: id % cols, y: Math.floor(id / cols) })
  const startId = cols * rows
  const goalId = startId + 1
  const open = new Set<number>([startId])
  const g = new Map<number, number>([[startId, 0]])
  const parent = new Map<number, number>()
  const locations = (id: number) => id === startId ? start : id === goalId ? end : point(coords(id).x, coords(id).y)
  const goalCells: number[] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const p = point(x, y)
    if (distance(p, end) <= step * 1.5 && traversableSegment(scene, p, end)) goalCells.push(key(x, y))
    if (distance(p, start) <= step * 1.5 && traversableSegment(scene, start, p)) {
      const id = key(x, y)
      g.set(id, distance(start, p))
      parent.set(id, startId)
      open.add(id)
    }
  }
  const goalSet = new Set(goalCells)
  let iterations = 0
  while (open.size && iterations++ < 20000) {
    let best = -1
    let score = Infinity
    for (const id of open) {
      const p = locations(id)
      const f = (g.get(id) ?? Infinity) + distance(p, end)
      if (f < score) { best = id; score = f }
    }
    if (best < 0) break
    open.delete(best)
    if (goalSet.has(best)) {
      const total = (g.get(best) ?? 0) + distance(locations(best), end)
      const route: LocalSurfacePoint[] = [end]
      let cursor: number | undefined = best
      while (cursor !== undefined) {
        route.push(locations(cursor))
        cursor = parent.get(cursor)
      }
      route.reverse()
      return { points: route, distanceM: total, usesNetwork: false }
    }
    const { x, y } = coords(best)
    if (best === startId) continue
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const id = key(nx, ny)
      if (!traversableSegment(scene, locations(best), point(nx, ny))) continue
      const tentative = (g.get(best) ?? Infinity) + distance(locations(best), point(nx, ny))
      if (tentative >= (g.get(id) ?? Infinity)) continue
      g.set(id, tentative)
      parent.set(id, best)
      open.add(id)
    }
  }
  return blocked()
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
  const segments = walkableSegments(scene).filter(segment => traversableSegment(scene, segment.a, segment.b))
  if (!segments.length) return obstacleDetour(scene, start, end)

  const safeSegments = segments.filter(segment => traversableSegment(scene, start, projectToSegment(start, segment).point) || traversableSegment(scene, end, projectToSegment(end, segment).point))
  const startProjection = nearestProjection(start, safeSegments.filter(segment => traversableSegment(scene, start, projectToSegment(start, segment).point)))
  const endProjection = nearestProjection(end, safeSegments.filter(segment => traversableSegment(scene, end, projectToSegment(end, segment).point)))
  if (!startProjection || !endProjection || startProjection.offDistance > maxConnectorM || endProjection.offDistance > maxConnectorM) {
    return obstacleDetour(scene, start, end)
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

  if (traversableSegment(scene, startProjection.point, startProjection.segment.a)) addEdge(graph, startKey, startProjection.segment.aKey, startProjection.offDistance + startAlongA)
  if (traversableSegment(scene, startProjection.point, startProjection.segment.b)) addEdge(graph, startKey, startProjection.segment.bKey, startProjection.offDistance + startAlongB)
  if (traversableSegment(scene, endProjection.segment.a, endProjection.point)) addEdge(graph, endProjection.segment.aKey, endKey, endProjection.offDistance + endAlongA)
  if (traversableSegment(scene, endProjection.segment.b, endProjection.point)) addEdge(graph, endProjection.segment.bKey, endKey, endProjection.offDistance + endAlongB)

  if (startProjection.segment === endProjection.segment) {
    const sameSegmentDistance = startProjection.offDistance
      + Math.abs(startProjection.t - endProjection.t) * startProjection.segment.length
      + endProjection.offDistance
    if (traversableSegment(scene, startProjection.point, endProjection.point)) addEdge(graph, startKey, endKey, sameSegmentDistance)
  }

  const result = dijkstra(graph, startKey, endKey)
  if (!result) return obstacleDetour(scene, start, end)

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
  const inBox = Math.abs(local.xM) < building.widthM / 2 + clearanceM
    && Math.abs(local.yM) < building.depthM / 2 + clearanceM
  if (!inBox) return false
  // A real outline blocks only where the building actually stands. Its bounding
  // box alone would also block the yard of an L-shaped hall and the road beside
  // a building that runs diagonally across the scene.
  const outline = building.footprint
  if (!outline || outline.length < 3) return true
  return pointInPolygon(point, outline) || distanceToPolygonEdge(point, outline) < clearanceM
}

function pointInPolygon(point: LocalSurfacePoint, polygon: readonly LocalSurfacePoint[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.yM > point.yM) !== (b.yM > point.yM)
      && point.xM < (b.xM - a.xM) * (point.yM - a.yM) / (b.yM - a.yM) + a.xM) inside = !inside
  }
  return inside
}

function distanceToPolygonEdge(point: LocalSurfacePoint, polygon: readonly LocalSurfacePoint[]) {
  let best = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i]
    const dx = b.xM - a.xM, dy = b.yM - a.yM
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((point.xM - a.xM) * dx + (point.yM - a.yM) * dy) / lengthSq)) : 0
    best = Math.min(best, Math.hypot(point.xM - (a.xM + dx * t), point.yM - (a.yM + dy * t)))
  }
  return best
}

export function isLocalScenePointWalkable(scene: LocalSurfaceScene, point: LocalSurfacePoint, clearanceM = 0.8) {
  if (Math.abs(point.xM) > scene.radiusM || Math.abs(point.yM) > scene.radiusM) return false
  // Inferred massing is a rendering hint, not surveyed collision geometry.
  // Treat only observed/canonical buildings as physical obstacles.
  return !scene.buildings.some(building => building.provenance !== 'derived' && pointBlockedByBuilding(point, building, clearanceM))
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

  // Whoever already stands inside a blocked area – after a scene change, a
  // reload or new building data – must be able to walk out again. Blocking
  // only applies when entering from walkable ground.
  if (!isLocalScenePointWalkable(scene, current, clearanceM)) {
    const blockers = scene.buildings.filter(building => building.provenance !== 'derived' && pointBlockedByBuilding(current, building, clearanceM))
    const penetration = (point: LocalSurfacePoint, building: LocalSurfaceBuilding) => {
      const outline = building.footprint
      if (outline && outline.length >= 3) return distanceToPolygonEdge(point, outline)
      const local = rotateIntoBuilding(point, building)
      return Math.max(0, Math.min(building.widthM / 2 + clearanceM - Math.abs(local.xM), building.depthM / 2 + clearanceM - Math.abs(local.yM)))
    }
    // A character spawned inside observed geometry can escape, but must not
    // push farther inside any blocking footprint or enter a different one.
    if (scene.buildings.some(building => building.provenance !== 'derived' && !blockers.includes(building) && pointBlockedByBuilding(clamped, building, clearanceM))) return current
    if (blockers.every(building => !pointBlockedByBuilding(clamped, building, clearanceM) || penetration(clamped, building) < penetration(current, building) - 0.001)) return clamped
    return current
  }

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
