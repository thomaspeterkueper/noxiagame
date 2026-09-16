import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'
const MRDS_QUERY_ENDPOINT = 'https://energy.usgs.gov/arcgis/rest/services/MRData/Mineral_Resource_Data_System/FeatureServer/3/query'
const MRDS_OUT_FIELDS = 'gid,dep_id,site_name,dev_stat,code_list,grade,url'

function matchesSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

type RegionBounds = { south: number; west: number; north: number; east: number }
type MrdsFeature = {
  geometry?: { type?: string; coordinates?: number[] }
  properties?: Record<string, unknown>
}

function commodityList(properties: Record<string, unknown>) {
  const codeList = typeof properties.code_list === 'string' ? properties.code_list : ''
  return [...new Set(codeList.split(/[;,|]/).map(v => v.trim()).filter(Boolean))]
}

async function requestMrds(bounds: RegionBounds, returnIdsOnly = false) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: returnIdsOnly ? 'false' : 'true',
    outSR: '4326',
    f: returnIdsOnly ? 'json' : 'geojson',
  })
  if (returnIdsOnly) params.set('returnIdsOnly', 'true')
  else params.set('outFields', MRDS_OUT_FIELDS)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    const res = await fetch(`${MRDS_QUERY_ENDPOINT}?${params}`, {
      headers: { accept: 'application/json,application/geo+json', 'user-agent': 'NOXIA/0.1 mrds-import' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`USGS MRDS ArcGIS: HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchMrds(bounds: RegionBounds) {
  const ids = await requestMrds(bounds, true) as { objectIds?: number[]; error?: { message?: string } }
  if (ids.error) throw new Error(`USGS MRDS ArcGIS: ${ids.error.message ?? 'ID query error'}`)
  if (!Array.isArray(ids.objectIds) || ids.objectIds.length === 0) return [] as MrdsFeature[]

  const params = new URLSearchParams({
    objectIds: ids.objectIds.join(','),
    outFields: MRDS_OUT_FIELDS,
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    const res = await fetch(`${MRDS_QUERY_ENDPOINT}?${params}`, {
      headers: { accept: 'application/geo+json,application/json', 'user-agent': 'NOXIA/0.1 mrds-import' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`USGS MRDS ArcGIS details: HTTP ${res.status}`)
    const data = await res.json() as { features?: MrdsFeature[]; error?: { message?: string } }
    if (data.error) throw new Error(`USGS MRDS ArcGIS details: ${data.error.message ?? 'query error'}`)
    return data.features ?? []
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug erforderlich' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .select('id,slug,bounds')
    .eq('slug', slug)
    .single()
  if (regionError || !region) return NextResponse.json({ error: regionError?.message ?? 'Region nicht gefunden' }, { status: 404 })

  const bounds = region.bounds as RegionBounds
  if (![bounds?.south, bounds?.west, bounds?.north, bounds?.east].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Region hat keine gueltigen Bounds' }, { status: 500 })
  }

  try {
    const features = await fetchMrds(bounds)
    const rows = features.flatMap(feature => {
      const coords = feature.geometry?.coordinates
      if (feature.geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2) return []
      const [lon, lat] = coords.map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
      const properties = feature.properties ?? {}
      return [{
        region_id: region.id,
        source: 'usgs-mrds-arcgis',
        external_id: properties.dep_id != null ? String(properties.dep_id) : null,
        name: properties.site_name != null ? String(properties.site_name) : null,
        lat,
        lon,
        commodities: commodityList(properties),
        development_status: properties.dev_stat != null ? String(properties.dev_stat) : null,
        properties,
      }]
    })

    const { error: deleteError } = await supabase.from('region_mineral_occurrences').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('region_mineral_occurrences').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    return NextResponse.json({ ok: true, slug, source: 'usgs-mrds-arcgis', count: rows.length, sample: rows.slice(0, 5).map(r => ({ externalId: r.external_id, name: r.name, commodities: r.commodities, developmentStatus: r.development_status })) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'MRDS-Import fehlgeschlagen' }, { status: 502 })
  }
}
