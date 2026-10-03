import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { materializeEarthPlace } from '@/lib/world/spatial/earthPlaceMaterializer.server'

export const maxDuration = 120

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

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { slug?: string; label?: string; lat?: number; lon?: number; radiusKm?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const lat = Number(body.lat)
  const lon = Number(body.lon)
  const label = String(body.label ?? '').trim().slice(0, 240)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !label) {
    return NextResponse.json({ error: 'Ort, Breite und Länge sind erforderlich' }, { status: 400 })
  }

  const canonicalSlug = earthPlaceSlug({ lat, lon })
  if (body.slug && body.slug !== canonicalSlug) {
    return NextResponse.json({ error: 'Ortsidentität stimmt nicht mit den Koordinaten überein' }, { status: 400 })
  }

  try {
    const result = await materializeEarthPlace({
      slug: canonicalSlug,
      label,
      lat,
      lon,
      radiusKm: body.radiusKm,
    })

    return NextResponse.json(result, {
      status: result.ok ? 200 : 202,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    console.error('earth place materialization request failed', {
      slug: canonicalSlug,
      label,
      error,
    })
    return NextResponse.json({
      ok: false,
      status: 'failed',
      slug: canonicalSlug,
      error: error instanceof Error ? error.message : 'Ortsmaterialisierung fehlgeschlagen',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }
}
