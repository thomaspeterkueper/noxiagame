import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OpenMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'

export const maxDuration = 120

const elevationSource = new OpenMeteoElevationSource()
const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'

type Bounds = { south: number; west: number; north: number; east: number }

function matchesImportSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function boundsFor(lat: number, lon: number, radiusKm: number): Bounds {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesImportSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug erforderlich' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .select('id,slug,center_lat,center_lon,radius_km,bounds')
    .eq('slug', slug)
    .single()
  if (regionError || !region) {
    return NextResponse.json({ error: regionError?.message ?? 'Region nicht gefunden' }, { status: 404 })
  }

  const bounds = (region.bounds ?? boundsFor(region.center_lat, region.center_lon, region.radius_km)) as Bounds

  try {
    const grid = await elevationSource.load(bounds, 200)
    const flat = grid.samples.map(sample => sample.elevationM)

    const { error: deleteError } = await supabase.from('region_elevation').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError

    const { error: insertError } = await supabase.from('region_elevation').insert({
      region_id: region.id,
      resolution_m: grid.source.resolutionM,
      rows: grid.rows,
      cols: grid.cols,
      origin_lat: bounds.north,
      origin_lon: bounds.west,
      grid: flat,
    })
    if (insertError) throw insertError

    return NextResponse.json({
      ok: true,
      slug: region.slug,
      elevation: {
        rows: grid.rows,
        cols: grid.cols,
        resolutionM: grid.source.resolutionM,
        samples: flat.length,
        minM: Math.min(...flat),
        maxM: Math.max(...flat),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Elevation-Import fehlgeschlagen' }, { status: 500 })
  }
}
