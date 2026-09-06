import { NextResponse } from 'next/server'
import type { BuildabilityState } from '@/lib/game/spatial/mapLayers'
import type { PhysicalBuildabilityPolicy } from '@/lib/game/spatial/buildability'
import type { EarthFeatureClass } from '@/lib/world/spatial/earthFeatureSource'
import type { EarthFeatureRestrictionPolicy, EarthFeatureRestrictionRule } from '@/lib/world/spatial/earthUsageRestrictions'
import { buildEarthBuildabilitySurface } from '@/lib/world/spatial/earthBuildabilitySurface'
import { localMetersToGeo } from '@/lib/world/spatial/earthSpatial'
import { EARTH_SAUERLAND_REGION } from '@/lib/world/spatial/regions'
import { OpenMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'

const elevationSource = new OpenMeteoElevationSource()
const featureSource = new OverpassEarthFeatureSource()
const FEATURE_CLASSES: EarthFeatureClass[] = ['water', 'waterway', 'forest', 'farmland', 'building', 'industrial', 'public', 'road', 'rail']
const RULE_CLASSES = new Set<EarthFeatureClass>(FEATURE_CLASSES)

function finiteParam(params: URLSearchParams, key: string) {
  const raw = params.get(key)
  if (raw == null || raw.trim() === '') throw new Error(`Missing ${key}`)
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`)
  return value
}

function parseRule(raw: string): [EarthFeatureClass, EarthFeatureRestrictionRule] | null {
  const [featureClassRaw, stateRaw, reasonRaw, bufferRaw] = raw.split(':')
  const featureClass = featureClassRaw as EarthFeatureClass
  const state = stateRaw as BuildabilityState
  if (!RULE_CLASSES.has(featureClass) || (state !== 'restricted' && state !== 'invalid') || !reasonRaw) return null
  const bufferM = bufferRaw == null || bufferRaw === '' ? undefined : Number(bufferRaw)
  if (bufferM != null && (!Number.isFinite(bufferM) || bufferM < 0)) return null
  return [featureClass, { state, reason: decodeURIComponent(reasonRaw), bufferM }]
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const minXM = finiteParam(params, 'minXM')
    const minYM = finiteParam(params, 'minYM')
    const maxXM = finiteParam(params, 'maxXM')
    const maxYM = finiteParam(params, 'maxYM')
    if (maxXM <= minXM || maxYM <= minYM) throw new Error('Viewport bounds are invalid')
    if (maxXM - minXM > 20_000 || maxYM - minYM > 20_000) throw new Error('Viewport exceeds 20 km limit')

    const policy: PhysicalBuildabilityPolicy = {
      maxBuildableSlopeDeg: finiteParam(params, 'maxBuildableSlopeDeg'),
      maxRestrictedSlopeDeg: finiteParam(params, 'maxRestrictedSlopeDeg'),
    }
    if (params.get('waterIsBuildable') === 'true') policy.waterIsBuildable = true

    const requestedResolutionM = params.get('resolutionM') == null ? 180 : finiteParam(params, 'resolutionM')
    const resolutionM = Math.max(90, Math.min(1_000, requestedResolutionM))

    const northWest = localMetersToGeo({ eastM: minXM, northM: maxYM }, EARTH_SAUERLAND_REGION.origin)
    const southEast = localMetersToGeo({ eastM: maxXM, northM: minYM }, EARTH_SAUERLAND_REGION.origin)
    const bounds = {
      south: southEast.lat,
      west: northWest.lon,
      north: northWest.lat,
      east: southEast.lon,
    }

    const restrictionPolicy: EarthFeatureRestrictionPolicy = {}
    for (const raw of params.getAll('rule')) {
      const parsed = parseRule(raw)
      if (!parsed) throw new Error(`Invalid rule: ${raw}`)
      restrictionPolicy[parsed[0]] = parsed[1]
    }

    const [grid, features] = await Promise.all([
      elevationSource.load(bounds, resolutionM),
      featureSource.load({ bounds, classes: FEATURE_CLASSES }),
    ])
    const surface = buildEarthBuildabilitySurface(grid, EARTH_SAUERLAND_REGION, policy, features, restrictionPolicy)

    return NextResponse.json({
      ok: true,
      regionId: EARTH_SAUERLAND_REGION.id,
      viewport: { minXM, minYM, maxXM, maxYM },
      planningCellSizeM: EARTH_SAUERLAND_REGION.cellSizeM,
      requestedResolutionM,
      sourceResolutionM: grid.source.resolutionM,
      sampledRows: surface.rows,
      sampledCols: surface.cols,
      source: surface.source,
      cells: surface.cells.map(cell => ({
        row: cell.row,
        col: cell.col,
        xM: cell.xM,
        yM: cell.yM,
        lat: cell.lat,
        lon: cell.lon,
        elevationM: cell.elevationM,
        slopeDeg: cell.slopeDeg,
        state: cell.state,
        reason: cell.buildabilityReason ?? null,
        matchedFeatureIds: cell.matchedFeatureIds,
      })),
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
