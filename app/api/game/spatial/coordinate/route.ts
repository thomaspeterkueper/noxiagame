import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { localWorldToPlanetary, planetaryToLocalWorld } from '@/lib/game/spatial/planetary'
import type { WorldFrame } from '@/lib/game/spatial/types'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await serviceClient.auth.getUser(auth.slice(7))
  return user
}

function worldFrame(row: any): WorldFrame {
  return {
    locationId: row.location_id,
    body: row.body,
    coordinateSystem: row.coordinate_system,
    originLatDeg: row.origin_lat_deg,
    originLonDeg: row.origin_lon_deg,
    originAltM: row.origin_alt_m,
    originStatus: row.origin_status,
    referenceFrame: row.reference_frame,
    latitudeType: row.latitude_type,
    longitudeDirection: row.longitude_direction,
    equatorialRadiusM: row.equatorial_radius_m,
    polarRadiusM: row.polar_radius_m,
    verticalDatum: row.vertical_datum,
    terrainDatasetId: row.terrain_dataset_id,
    worldSeed: row.world_seed,
    observedSource: row.observed_source,
    derivedConfig: row.derived_config,
  }
}

function numberParam(url: URL, name: string) {
  const raw = url.searchParams.get(name)
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const locationSlug = url.searchParams.get('location') ?? 'earth'
  const { data: location } = await serviceClient
    .from('locations')
    .select('id,slug,name')
    .eq('slug', locationSlug)
    .maybeSingle()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const { data: row } = await serviceClient.from('world_frames').select('*').eq('location_id', location.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'World frame nicht gefunden' }, { status: 404 })

  const frame = worldFrame(row)
  if (frame.originStatus !== 'verified' || frame.originLatDeg == null || frame.originLonDeg == null || frame.originAltM == null) {
    return NextResponse.json({
      error: 'Der reale geodätische/planetare Ursprung ist noch nicht verifiziert.',
      code: 'FRAME_ORIGIN_REQUIRED',
      location,
      frame,
    }, { status: 409 })
  }

  const mode = url.searchParams.get('mode') ?? 'local-to-planetary'
  if (mode === 'local-to-planetary') {
    const xM = numberParam(url, 'xM')
    const yM = numberParam(url, 'yM')
    const zM = numberParam(url, 'zM') ?? 0
    if (xM == null || yM == null) return NextResponse.json({ error: 'xM und yM fehlen' }, { status: 400 })
    return NextResponse.json({
      location,
      frame,
      local: { xM, yM, zM },
      planetary: localWorldToPlanetary({ xM, yM, zM }, frame),
    })
  }

  if (mode === 'planetary-to-local') {
    const latDeg = numberParam(url, 'latDeg')
    const lonDeg = numberParam(url, 'lonDeg')
    const elevationM = numberParam(url, 'elevationM') ?? 0
    if (latDeg == null || lonDeg == null) return NextResponse.json({ error: 'latDeg und lonDeg fehlen' }, { status: 400 })
    return NextResponse.json({
      location,
      frame,
      planetary: { latDeg, lonDeg, elevationM },
      local: planetaryToLocalWorld({ latDeg, lonDeg, elevationM }, frame),
    })
  }

  return NextResponse.json({ error: 'Unbekannter Modus' }, { status: 400 })
}
