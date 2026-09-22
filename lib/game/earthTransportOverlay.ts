// lib/game/earthTransportOverlay.ts
// Earth-owned projection of the active surface-transport context into drawable
// map geometry.
//
// The Earth map keeps rendering the existing OSM/terrain layers; this module only
// turns routes that Earth or the Core already validated into polylines, node
// markers and warnings. No road, terrain, vehicle or job state is invented,
// persisted or duplicated here.

import { localMetersToGeo, validateGeoPoint, type GeoPoint } from '../world/spatial/earthSpatial'
import type { EarthSurfaceRouteClass } from './earthSurfaceLogistics'
import { classifyEarthSurfaceNode, type EarthSurfaceInventoryNodeInput } from './earthSurfaceHandover'
import type { EarthSurfaceRoutePlan, EarthSurfaceRoutePlanResult } from './earthSurfaceRouting'
import { pointAlongSurfaceRoute, parseSurfaceRouteGeometry, type SurfaceRouteGeometry } from './vehicles/surfaceRouteGeometry'

export type EarthTransportOverlayNodeKind =
  | 'facility'
  | 'depot'
  | 'spaceport-storage'
  | 'surface-port'
  | 'vehicle'
  | 'unresolved'

export interface EarthTransportOverlayNode {
  id: string
  kind: EarthTransportOverlayNodeKind
  label: string
  point: GeoPoint
}

export interface EarthTransportOverlayPath {
  /**
   * Earth route class for a route Earth planned itself. `null` means the path is
   * persisted Core geometry whose shared snapshot deliberately stores no
   * per-segment class; Earth must not invent one for the map.
   */
  routeClass: EarthSurfaceRouteClass | null
  points: GeoPoint[]
}

export type EarthTransportOverlayRouteKind = 'planned' | 'job'

export interface EarthTransportOverlayRoute {
  id: string
  kind: EarthTransportOverlayRouteKind
  label: string
  statusLabel: string
  paths: EarthTransportOverlayPath[]
  distanceM: number | null
  offroadDistanceM: number | null
  progress01: number | null
  vehiclePoint: GeoPoint | null
  warnings: string[]
}

/** Map the Core inventory role onto the marker kind used by the Earth map. */
export function earthOverlayNodeKindForInventory(node: EarthSurfaceInventoryNodeInput): EarthTransportOverlayNodeKind {
  switch (classifyEarthSurfaceNode(node)) {
    case 'facility': return 'facility'
    case 'depot': return 'depot'
    case 'spaceport-storage': return 'spaceport-storage'
    case 'surface-port': return 'surface-port'
    case 'vehicle': return 'vehicle'
    default: return 'unresolved'
  }
}

/**
 * Overlay node for a Core inventory. A position Core cannot resolve into a valid
 * WGS84 point stays unpublished: the map must not draw a guessed location.
 */
export function earthOverlayNodeFromInventory(
  node: EarthSurfaceInventoryNodeInput,
  point: GeoPoint,
): EarthTransportOverlayNode | null {
  let valid: GeoPoint
  try {
    valid = validateGeoPoint(point)
  } catch {
    return null
  }
  return {
    id: `inventory:${node.id}`,
    kind: earthOverlayNodeKindForInventory(node),
    label: node.label,
    point: valid,
  }
}

function samePoint(a: GeoPoint, b: GeoPoint) {
  return a.lat === b.lat && a.lon === b.lon
}

function appendPoint(points: GeoPoint[], point: GeoPoint) {
  const last = points.at(-1)
  if (last && samePoint(last, point)) return
  points.push(point)
}

/**
 * Group consecutive plan segments of the same Earth route class into drawable
 * polylines. Source and destination of the plan are kept as path endpoints so the
 * short facility connectors stay visible even without an offroad access segment.
 */
export function earthOverlayPathsFromPlan(plan: EarthSurfaceRoutePlan): EarthTransportOverlayPath[] {
  const paths: EarthTransportOverlayPath[] = []
  for (const segment of plan.segments) {
    const previous = paths.at(-1)
    if (previous && previous.routeClass === segment.routeClass) {
      appendPoint(previous.points, segment.from)
      appendPoint(previous.points, segment.to)
      continue
    }
    const points: GeoPoint[] = []
    appendPoint(points, segment.from)
    appendPoint(points, segment.to)
    if (points.length < 2) continue
    paths.push({ routeClass: segment.routeClass, points })
  }

  const start = plan.polyline[0]
  const end = plan.polyline.at(-1)
  const first = paths[0]
  const last = paths.at(-1)
  if (start && first && !samePoint(first.points[0], start)) first.points = [start, ...first.points]
  if (end && last && !samePoint(last.points.at(-1) as GeoPoint, end)) last.points = [...last.points, end]

  return paths.filter(path => path.points.length >= 2)
}

/** Warning text for a route Earth deliberately refused to validate. */
export function earthRouteFailureWarning(result: EarthSurfaceRoutePlanResult): string | null {
  if (!('reason' in result)) return null
  switch (result.reason) {
    case 'no-routable-roads': return 'Im geladenen OSM-Ausschnitt gibt es kein geeignetes Fahrzeugnetz.'
    case 'source-access-unresolved': return 'Die Zufahrt vom Quellknoten zur beobachteten Straße ist noch nicht aufgelöst.'
    case 'destination-access-unresolved': return 'Die Zufahrt vom Straßennetz zum Zielknoten ist noch nicht aufgelöst.'
    case 'disconnected-road-network': return 'Quelle und Ziel liegen in getrennten oder richtungsbedingt nicht verbundenen Straßennetzen.'
  }
}

export interface EarthPlannedOverlayInput {
  id: string
  label: string
  statusLabel: string
  plan: EarthSurfaceRoutePlan
}

export function earthOverlayRouteFromPlan(input: EarthPlannedOverlayInput): EarthTransportOverlayRoute {
  return {
    id: input.id,
    kind: 'planned',
    label: input.label,
    statusLabel: input.statusLabel,
    paths: earthOverlayPathsFromPlan(input.plan),
    distanceM: input.plan.distanceM,
    offroadDistanceM: input.plan.offroadDistanceM,
    progress01: null,
    vehiclePoint: null,
    warnings: [],
  }
}

/**
 * What one Earth panel contributes to the shared map overlay. Panels publish their
 * own slice, so the map never has to know which component computed what.
 */
export interface EarthTransportOverlaySlice {
  nodes?: EarthTransportOverlayNode[]
  planned?: EarthTransportOverlayRoute | null
  live?: EarthTransportOverlayRoute[]
  warnings?: string[]
}

export interface EarthTransportOverlayView {
  nodes: EarthTransportOverlayNode[]
  routes: EarthTransportOverlayRoute[]
  warnings: string[]
}

/**
 * Combine every publishing panel into one drawable overlay. Nodes and warnings are
 * deduplicated by id/text; a planned route is always drawn before running jobs.
 */
export function mergeEarthTransportOverlay(
  sources: Readonly<Record<string, EarthTransportOverlaySlice | undefined>>,
): EarthTransportOverlayView {
  const nodes = new Map<string, EarthTransportOverlayNode>()
  const warnings = new Set<string>()
  const planned: EarthTransportOverlayRoute[] = []
  const live: EarthTransportOverlayRoute[] = []

  for (const key of Object.keys(sources).sort()) {
    const slice = sources[key]
    if (!slice) continue
    for (const node of slice.nodes ?? []) if (!nodes.has(node.id)) nodes.set(node.id, node)
    for (const warning of slice.warnings ?? []) if (warning) warnings.add(warning)
    if (slice.planned) planned.push(slice.planned)
    for (const route of slice.live ?? []) live.push(route)
  }

  return {
    nodes: [...nodes.values()],
    routes: [...planned, ...live],
    warnings: [...warnings],
  }
}

export type EarthJobOverlayResult =
  | { ok: true; route: EarthTransportOverlayRoute }
  | { ok: false; warning: string }

export interface EarthJobOverlayInput {
  id: string
  label: string
  statusLabel: string
  snapshot: Record<string, unknown> | null | undefined
  progress01: number | null
}

function snapshotOrigin(snapshot: Record<string, unknown>): GeoPoint | null {
  const raw = snapshot.earthSpatialOrigin
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  const lat = Number(candidate.lat)
  const lon = Number(candidate.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    return validateGeoPoint({ lat, lon })
  } catch {
    return null
  }
}

function geometryToGeo(geometry: SurfaceRouteGeometry, origin: GeoPoint): GeoPoint[] {
  return geometry.points.map(point => localMetersToGeo({ eastM: point.xM, northM: point.yM }, origin))
}

/**
 * Project a persisted Core transport job onto the Earth map. The shared route
 * snapshot already carries both the local-world geometry and the Earth origin it
 * was built against, so no region guess or second route is needed.
 */
export function earthOverlayRouteFromJob(input: EarthJobOverlayInput): EarthJobOverlayResult {
  const geometry = parseSurfaceRouteGeometry(input.snapshot)
  if (!geometry) {
    return { ok: false, warning: 'Für diese Fahrt existiert keine persistierte Route-Geometrie im gemeinsamen Snapshot.' }
  }
  const origin = input.snapshot ? snapshotOrigin(input.snapshot) : null
  if (!origin) {
    return { ok: false, warning: 'Der persistierte Route-Snapshot nennt keinen Earth-Bezugsursprung; ohne ihn wird keine Ersatzroute gezeichnet.' }
  }

  const points = geometryToGeo(geometry, origin)
  if (points.length < 2) {
    return { ok: false, warning: 'Der persistierte Route-Snapshot enthält keine zeichenbare Polyline.' }
  }

  const distanceKm = Number(input.snapshot?.distanceKm)
  const progress = input.progress01 == null ? null : Math.max(0, Math.min(1, input.progress01))
  const vehiclePoint = progress == null
    ? null
    : (() => {
      const along = pointAlongSurfaceRoute(geometry, progress)
      return localMetersToGeo({ eastM: along.xM, northM: along.yM }, origin)
    })()

  return {
    ok: true,
    route: {
      id: input.id,
      kind: 'job',
      label: input.label,
      statusLabel: input.statusLabel,
      paths: [{ routeClass: null, points }],
      distanceM: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm * 1000 : null,
      offroadDistanceM: null,
      progress01: progress,
      vehiclePoint,
      warnings: [],
    },
  }
}
