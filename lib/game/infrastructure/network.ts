// lib/game/infrastructure/network.ts
// Geospatial infrastructure primitives for roads, rail, pipelines, utilities and conveyors.
//
// Important: this is intentionally separate from the legacy colony grid. Grid roads remain
// tile/adjacency based; planetary surfaces use metric nodes, ports and polyline edges.

export type InfrastructureNetworkType =
  | 'road'
  | 'rail'
  | 'pipeline'
  | 'power'
  | 'water'
  | 'data'
  | 'conveyor'

export type InfrastructureNodeKind =
  | 'junction'
  | 'facility-port'
  | 'network-tie-in'
  | 'terminal'
  | 'waypoint'

export type InfrastructureEdgeSource = 'observed' | 'player-built' | 'seeded'
export type InfrastructureEdgeStatus = 'planned' | 'building' | 'active' | 'damaged' | 'closed'

export type SurfaceMetricPoint = {
  xM: number
  yM: number
}

export type InfrastructurePort = {
  id: string
  networkType: InfrastructureNetworkType
  ownerEntityId: string
  point: SurfaceMetricPoint
  headingDeg?: number | null
  capacity?: number | null
  metadata?: Record<string, unknown>
}

export type InfrastructureNode = {
  id: string
  locationId: string
  networkType: InfrastructureNetworkType
  kind: InfrastructureNodeKind
  point: SurfaceMetricPoint
  source: InfrastructureEdgeSource
  portId?: string | null
  metadata?: Record<string, unknown>
}

export type InfrastructureEdge = {
  id: string
  locationId: string
  networkType: InfrastructureNetworkType
  source: InfrastructureEdgeSource
  status: InfrastructureEdgeStatus
  startNodeId: string
  endNodeId: string
  geometry: SurfaceMetricPoint[]
  lengthM: number
  classId?: string | null
  capacity?: number | null
  speedLimit?: number | null
  condition?: number | null
  ownerProfileId?: string | null
  metadata?: Record<string, unknown>
}

export type InfrastructureRouteSegment = {
  edgeId: string
  fromNodeId: string
  toNodeId: string
  distanceM: number
}

export const LEGACY_GRID_LINEAR_BUILDABLE_IDS = new Set(['road'])

/**
 * True for buildables that are still valid in the legacy discrete colony grid but must
 * not be offered as footprint buildings on geospatial planetary maps.
 */
export function isLegacyGridLinearBuildable(buildableId: string) {
  return LEGACY_GRID_LINEAR_BUILDABLE_IDS.has(buildableId)
}

export function isFiniteMetricPoint(point: SurfaceMetricPoint) {
  return Number.isFinite(point.xM) && Number.isFinite(point.yM)
}

export function metricDistance(a: SurfaceMetricPoint, b: SurfaceMetricPoint) {
  return Math.hypot(b.xM - a.xM, b.yM - a.yM)
}

export function polylineLengthM(points: readonly SurfaceMetricPoint[]) {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += metricDistance(points[index - 1], points[index])
  }
  return length
}

export function normalizeInfrastructureGeometry(points: readonly SurfaceMetricPoint[]) {
  if (points.length < 2) throw new Error('Infrastructure geometry requires at least two points')
  const result: SurfaceMetricPoint[] = []
  for (const point of points) {
    if (!isFiniteMetricPoint(point)) throw new Error('Infrastructure geometry contains a non-finite point')
    const previous = result[result.length - 1]
    if (!previous || metricDistance(previous, point) > 0.01) result.push({ xM: point.xM, yM: point.yM })
  }
  if (result.length < 2) throw new Error('Infrastructure geometry must span a measurable distance')
  return result
}

export function createInfrastructureEdge(input: Omit<InfrastructureEdge, 'geometry' | 'lengthM'> & {
  geometry: readonly SurfaceMetricPoint[]
}): InfrastructureEdge {
  const geometry = normalizeInfrastructureGeometry(input.geometry)
  return {
    ...input,
    geometry,
    lengthM: polylineLengthM(geometry),
  }
}

export function canConnectNetworkTypes(a: InfrastructureNetworkType, b: InfrastructureNetworkType) {
  return a === b
}

export function assertCompatibleConnection(
  edgeType: InfrastructureNetworkType,
  start: Pick<InfrastructureNode, 'networkType'>,
  end: Pick<InfrastructureNode, 'networkType'>,
) {
  if (!canConnectNetworkTypes(edgeType, start.networkType) || !canConnectNetworkTypes(edgeType, end.networkType)) {
    throw new Error(`Infrastructure network mismatch: ${start.networkType} -> ${edgeType} -> ${end.networkType}`)
  }
}
