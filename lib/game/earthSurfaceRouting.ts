import type { ImportedEarthFeature } from '../world/spatial/earthFeatureSource'
import { geoToLocalMeters, localMetersToGeo, type GeoPoint } from '../world/spatial/earthSpatial'
import {
  assessEarthLastMileAccess,
  classifyEarthRoad,
  EARTH_ROUTE_CLASS_POLICY,
  type EarthSurfaceRouteAssessment,
  type EarthSurfaceRouteClass,
  type EarthSurfaceVehicleRole,
} from './earthSurfaceLogistics'

type RoutableRoadClass = Exclude<EarthSurfaceRouteClass, 'offroad' | 'unresolved'>

export interface EarthSurfaceRoutePlanInput {
  features: readonly ImportedEarthFeature[]
  source: GeoPoint
  destination: GeoPoint
  vehicleRole: EarthSurfaceVehicleRole
  /** Offroad assessment for the short source → observed-road connector, if required. */
  sourceAccess?: EarthSurfaceRouteAssessment | null
  /** Offroad assessment for the short observed-road → destination connector, if required. */
  destinationAccess?: EarthSurfaceRouteAssessment | null
}

export interface EarthSurfaceRouteSegment {
  kind: 'road' | 'access'
  featureId: string | null
  routeClass: RoutableRoadClass | 'offroad'
  from: GeoPoint
  to: GeoPoint
  distanceM: number
  speedMultiplier: number
  energyMultiplier: number
  wearMultiplier: number
}

export interface EarthSurfaceRoutePlan {
  ok: true
  segments: EarthSurfaceRouteSegment[]
  polyline: GeoPoint[]
  distanceM: number
  roadDistanceM: number
  offroadDistanceM: number
  /** Paved-road-equivalent metres used as the relative time/pathfinding cost. */
  relativeTimeCostM: number
  /** Distance-weighted relative energy burden. */
  energyMultiplier: number
  /** Distance-weighted relative wear burden. */
  wearMultiplier: number
  sourceSnap: GeoPoint
  destinationSnap: GeoPoint
}

export interface EarthSurfaceRouteFailure {
  ok: false
  reason:
    | 'no-routable-roads'
    | 'source-access-unresolved'
    | 'destination-access-unresolved'
    | 'disconnected-road-network'
  sourceSnap?: GeoPoint
  destinationSnap?: GeoPoint
}

export type EarthSurfaceRoutePlanResult = EarthSurfaceRoutePlan | EarthSurfaceRouteFailure

type GraphNode = {
  key: string
  point: GeoPoint
  edges: GraphEdge[]
}

type RoadSegment = {
  index: number
  featureId: string
  routeClass: RoutableRoadClass
  fromKey: string
  toKey: string
  from: GeoPoint
  to: GeoPoint
  distanceM: number
  forward: boolean
  reverse: boolean
}

type GraphEdge = {
  toKey: string
  featureId: string | null
  routeClass: RoutableRoadClass
  from: GeoPoint
  to: GeoPoint
  distanceM: number
}

type Snap = {
  segment: RoadSegment
  point: GeoPoint
  distanceM: number
  fraction: number
}

const SOURCE_KEY = '__earth_route_source__'
const DESTINATION_KEY = '__earth_route_destination__'

function finitePoint(point: GeoPoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

function pointKey(point: GeoPoint) {
  // OSM shared nodes arrive with identical coordinates. Seven decimals keep the
  // ephemeral graph stable without turning nearby parallel roads into one node.
  return `${point.lat.toFixed(7)}:${point.lon.toFixed(7)}`
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const local = geoToLocalMeters(b, a)
  return Math.hypot(local.eastM, local.northM)
}

function stringProperties(properties: Record<string, unknown>) {
  const result: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

function directionPolicy(properties: Record<string, string | undefined>) {
  const oneway = properties.oneway?.toLowerCase()
  if (oneway === '-1') return { forward: false, reverse: true }
  if (oneway === 'yes' || oneway === '1' || oneway === 'true' || properties.junction?.toLowerCase() === 'roundabout') {
    return { forward: true, reverse: false }
  }
  return { forward: true, reverse: true }
}

function addNode(nodes: Map<string, GraphNode>, point: GeoPoint) {
  const key = pointKey(point)
  if (!nodes.has(key)) nodes.set(key, { key, point, edges: [] })
  return key
}

function edgeFactors(routeClass: RoutableRoadClass) {
  return EARTH_ROUTE_CLASS_POLICY[routeClass]
}

function addEdge(nodes: Map<string, GraphNode>, fromKey: string, edge: GraphEdge) {
  const node = nodes.get(fromKey)
  if (!node) throw new Error(`Earth road graph node missing: ${fromKey}`)
  node.edges.push(edge)
}

function buildRoadGraph(features: readonly ImportedEarthFeature[], vehicleRole: EarthSurfaceVehicleRole) {
  const nodes = new Map<string, GraphNode>()
  const segments: RoadSegment[] = []

  for (const feature of features) {
    if (feature.featureType !== 'road' || feature.geometry.kind !== 'line') continue
    const properties = stringProperties(feature.properties)
    const classification = classifyEarthRoad(properties, vehicleRole)
    if (!classification.routeClass || classification.routeClass === 'unresolved') continue
    if (classification.suitability !== 'preferred' && classification.suitability !== 'allowed') continue

    const routeClass = classification.routeClass as RoutableRoadClass
    const direction = directionPolicy(properties)
    const coordinates = feature.geometry.coordinates

    for (let index = 1; index < coordinates.length; index += 1) {
      const from = coordinates[index - 1]
      const to = coordinates[index]
      if (!finitePoint(from) || !finitePoint(to)) continue
      const distanceM = distanceMeters(from, to)
      if (!(distanceM > 0)) continue

      const fromKey = addNode(nodes, from)
      const toKey = addNode(nodes, to)
      const segment: RoadSegment = {
        index: segments.length,
        featureId: feature.id,
        routeClass,
        fromKey,
        toKey,
        from,
        to,
        distanceM,
        ...direction,
      }
      segments.push(segment)

      if (direction.forward) addEdge(nodes, fromKey, { toKey, featureId: feature.id, routeClass, from, to, distanceM })
      if (direction.reverse) addEdge(nodes, toKey, { toKey: fromKey, featureId: feature.id, routeClass, from: to, to: from, distanceM })
    }
  }

  return { nodes, segments }
}

function nearestPointOnSegment(query: GeoPoint, segment: RoadSegment): Snap {
  const toLocal = geoToLocalMeters(segment.to, segment.from)
  const queryLocal = geoToLocalMeters(query, segment.from)
  const denominator = toLocal.eastM * toLocal.eastM + toLocal.northM * toLocal.northM
  const rawFraction = denominator > 0
    ? (queryLocal.eastM * toLocal.eastM + queryLocal.northM * toLocal.northM) / denominator
    : 0
  const fraction = Math.max(0, Math.min(1, rawFraction))
  const point = localMetersToGeo({
    eastM: toLocal.eastM * fraction,
    northM: toLocal.northM * fraction,
  }, segment.from)
  return { segment, point, distanceM: distanceMeters(query, point), fraction }
}

function nearestRoadSnap(query: GeoPoint, segments: readonly RoadSegment[]): Snap | null {
  let best: Snap | null = null
  for (const segment of segments) {
    const candidate = nearestPointOnSegment(query, segment)
    if (!best || candidate.distanceM < best.distanceM) best = candidate
  }
  return best
}

function partialRoadEdge(segment: RoadSegment, from: GeoPoint, to: GeoPoint, distanceM: number, toKey: string): GraphEdge {
  return { toKey, featureId: segment.featureId, routeClass: segment.routeClass, from, to, distanceM }
}

function cloneGraph(nodes: Map<string, GraphNode>) {
  return new Map([...nodes].map(([key, node]) => [key, { ...node, edges: [...node.edges] }]))
}

function addVirtualEndpoints(nodes: Map<string, GraphNode>, sourceSnap: Snap, destinationSnap: Snap) {
  nodes.set(SOURCE_KEY, { key: SOURCE_KEY, point: sourceSnap.point, edges: [] })
  nodes.set(DESTINATION_KEY, { key: DESTINATION_KEY, point: destinationSnap.point, edges: [] })

  const sourceSegment = sourceSnap.segment
  const sourceToStartM = sourceSegment.distanceM * sourceSnap.fraction
  const sourceToEndM = sourceSegment.distanceM * (1 - sourceSnap.fraction)
  if (sourceSegment.forward) {
    addEdge(nodes, SOURCE_KEY, partialRoadEdge(sourceSegment, sourceSnap.point, sourceSegment.to, sourceToEndM, sourceSegment.toKey))
  }
  if (sourceSegment.reverse) {
    addEdge(nodes, SOURCE_KEY, partialRoadEdge(sourceSegment, sourceSnap.point, sourceSegment.from, sourceToStartM, sourceSegment.fromKey))
  }

  const destinationSegment = destinationSnap.segment
  const startToDestinationM = destinationSegment.distanceM * destinationSnap.fraction
  const endToDestinationM = destinationSegment.distanceM * (1 - destinationSnap.fraction)
  if (destinationSegment.forward) {
    addEdge(nodes, destinationSegment.fromKey, partialRoadEdge(destinationSegment, destinationSegment.from, destinationSnap.point, startToDestinationM, DESTINATION_KEY))
  }
  if (destinationSegment.reverse) {
    addEdge(nodes, destinationSegment.toKey, partialRoadEdge(destinationSegment, destinationSegment.to, destinationSnap.point, endToDestinationM, DESTINATION_KEY))
  }

  if (sourceSegment.index === destinationSegment.index) {
    if (sourceSegment.forward && sourceSnap.fraction <= destinationSnap.fraction) {
      addEdge(nodes, SOURCE_KEY, partialRoadEdge(
        sourceSegment,
        sourceSnap.point,
        destinationSnap.point,
        sourceSegment.distanceM * (destinationSnap.fraction - sourceSnap.fraction),
        DESTINATION_KEY,
      ))
    }
    if (sourceSegment.reverse && sourceSnap.fraction >= destinationSnap.fraction) {
      addEdge(nodes, SOURCE_KEY, partialRoadEdge(
        sourceSegment,
        sourceSnap.point,
        destinationSnap.point,
        sourceSegment.distanceM * (sourceSnap.fraction - destinationSnap.fraction),
        DESTINATION_KEY,
      ))
    }
  }
}

function roadTimeCost(edge: GraphEdge) {
  const policy = edgeFactors(edge.routeClass)
  return edge.distanceM / policy.speedFactor
}

function shortestRoadPath(nodes: Map<string, GraphNode>) {
  const costs = new Map<string, number>([[SOURCE_KEY, 0]])
  const previous = new Map<string, { key: string; edge: GraphEdge }>()
  const unvisited = new Set(nodes.keys())

  while (unvisited.size) {
    let currentKey: string | null = null
    let currentCost = Infinity
    for (const key of unvisited) {
      const cost = costs.get(key) ?? Infinity
      if (cost < currentCost) {
        currentCost = cost
        currentKey = key
      }
    }
    if (currentKey == null || !Number.isFinite(currentCost)) break
    if (currentKey === DESTINATION_KEY) break
    unvisited.delete(currentKey)

    const node = nodes.get(currentKey)
    if (!node) continue
    for (const edge of node.edges) {
      if (!unvisited.has(edge.toKey) && edge.toKey !== DESTINATION_KEY) continue
      const nextCost = currentCost + roadTimeCost(edge)
      if (nextCost < (costs.get(edge.toKey) ?? Infinity)) {
        costs.set(edge.toKey, nextCost)
        previous.set(edge.toKey, { key: currentKey, edge })
      }
    }
  }

  if (!costs.has(DESTINATION_KEY)) return null
  const reversed: GraphEdge[] = []
  let key = DESTINATION_KEY
  while (key !== SOURCE_KEY) {
    const step = previous.get(key)
    if (!step) return null
    reversed.push(step.edge)
    key = step.key
  }
  return reversed.reverse()
}

function roadSegmentFromEdge(edge: GraphEdge): EarthSurfaceRouteSegment {
  const policy = edgeFactors(edge.routeClass)
  return {
    kind: 'road',
    featureId: edge.featureId,
    routeClass: edge.routeClass,
    from: edge.from,
    to: edge.to,
    distanceM: edge.distanceM,
    speedMultiplier: policy.speedFactor,
    energyMultiplier: policy.energyFactor,
    wearMultiplier: policy.wearFactor,
  }
}

function accessSegment(
  from: GeoPoint,
  to: GeoPoint,
  assessment: EarthSurfaceRouteAssessment,
): EarthSurfaceRouteSegment {
  return {
    kind: 'access',
    featureId: null,
    routeClass: 'offroad',
    from,
    to,
    distanceM: distanceMeters(from, to),
    speedMultiplier: assessment.speedMultiplier,
    energyMultiplier: assessment.energyMultiplier,
    wearMultiplier: assessment.wearMultiplier,
  }
}

function accessAllowed(distanceM: number, role: EarthSurfaceVehicleRole, assessment?: EarthSurfaceRouteAssessment | null) {
  const effectivelyOnRoad = distanceM <= 0.5
  if (effectivelyOnRoad) return true
  return assessEarthLastMileAccess(distanceM, role, Boolean(assessment?.passable)).allowed
}

function routePolyline(source: GeoPoint, segments: readonly EarthSurfaceRouteSegment[], destination: GeoPoint) {
  const points: GeoPoint[] = [source]
  for (const segment of segments) {
    const last = points[points.length - 1]
    if (distanceMeters(last, segment.from) > 0.05) points.push(segment.from)
    if (distanceMeters(points[points.length - 1], segment.to) > 0.05) points.push(segment.to)
  }
  if (distanceMeters(points[points.length - 1], destination) > 0.05) points.push(destination)
  return points
}

/**
 * Build an ephemeral routing graph directly from the OSM road features already loaded
 * by Earth. The graph is a derived view, never a second persisted road source.
 *
 * Arbitrary cross-country pathfinding is deliberately not invented here. Offroad is
 * currently used only for validated short facility-to-road connectors. A future terrain
 * graph can add longer offroad candidates through the same segment/result contract.
 */
export function planEarthSurfaceRoute(input: EarthSurfaceRoutePlanInput): EarthSurfaceRoutePlanResult {
  const { nodes: baseNodes, segments: roadSegments } = buildRoadGraph(input.features, input.vehicleRole)
  if (!roadSegments.length) return { ok: false, reason: 'no-routable-roads' }

  const sourceSnap = nearestRoadSnap(input.source, roadSegments)
  const destinationSnap = nearestRoadSnap(input.destination, roadSegments)
  if (!sourceSnap || !destinationSnap) return { ok: false, reason: 'no-routable-roads' }

  if (!accessAllowed(sourceSnap.distanceM, input.vehicleRole, input.sourceAccess)) {
    return { ok: false, reason: 'source-access-unresolved', sourceSnap: sourceSnap.point, destinationSnap: destinationSnap.point }
  }
  if (!accessAllowed(destinationSnap.distanceM, input.vehicleRole, input.destinationAccess)) {
    return { ok: false, reason: 'destination-access-unresolved', sourceSnap: sourceSnap.point, destinationSnap: destinationSnap.point }
  }

  const nodes = cloneGraph(baseNodes)
  addVirtualEndpoints(nodes, sourceSnap, destinationSnap)
  const roadPath = shortestRoadPath(nodes)
  if (!roadPath) {
    return { ok: false, reason: 'disconnected-road-network', sourceSnap: sourceSnap.point, destinationSnap: destinationSnap.point }
  }

  const segments: EarthSurfaceRouteSegment[] = []
  if (sourceSnap.distanceM > 0.5 && input.sourceAccess) {
    segments.push(accessSegment(input.source, sourceSnap.point, input.sourceAccess))
  }
  segments.push(...roadPath.filter(edge => edge.distanceM > 0.05).map(roadSegmentFromEdge))
  if (destinationSnap.distanceM > 0.5 && input.destinationAccess) {
    segments.push(accessSegment(destinationSnap.point, input.destination, input.destinationAccess))
  }

  const distanceM = segments.reduce((sum, segment) => sum + segment.distanceM, 0)
  const roadDistanceM = segments.filter(segment => segment.kind === 'road').reduce((sum, segment) => sum + segment.distanceM, 0)
  const offroadDistanceM = distanceM - roadDistanceM
  const relativeTimeCostM = segments.reduce((sum, segment) => sum + segment.distanceM / Math.max(0.01, segment.speedMultiplier), 0)
  const energyCostM = segments.reduce((sum, segment) => sum + segment.distanceM * segment.energyMultiplier, 0)
  const wearCostM = segments.reduce((sum, segment) => sum + segment.distanceM * segment.wearMultiplier, 0)

  return {
    ok: true,
    segments,
    polyline: routePolyline(input.source, segments, input.destination),
    distanceM,
    roadDistanceM,
    offroadDistanceM,
    relativeTimeCostM,
    energyMultiplier: distanceM > 0 ? energyCostM / distanceM : 1,
    wearMultiplier: distanceM > 0 ? wearCostM / distanceM : 1,
    sourceSnap: sourceSnap.point,
    destinationSnap: destinationSnap.point,
  }
}
