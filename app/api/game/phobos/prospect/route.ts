import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_RADIUS_M = 180
const MAX_RADIUS_M = 600
const CHANCE: Record<string, number> = { trace: 0.45, viable: 0.72, rich: 0.9, exceptional: 0.97 }

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function finite(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function dto(row: any) {
  const props = row.properties ?? {}
  return {
    id: row.id,
    resourceType: row.resource_type,
    xM: row.x_m,
    yM: row.y_m,
    abundance: row.discovered_at ? row.abundance : null,
    tier: props.tier ?? null,
    confidence: props.confidence ?? null,
    provenance: props.provenance ?? null,
    discoveredAt: row.discovered_at,
    discoveredVia: row.discovered_via,
  }
}

async function candidates() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('region_resources')
    .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at,discovered_via')
    .contains('properties', { body: 'phobos', surface_hub: 'stickney-alpha' })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('current_location').eq('id', user.id).maybeSingle()
  if (profile?.current_location !== 'phobos') return NextResponse.json({ error: 'Prospektion ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })

  try {
    const rows = await candidates()
    return NextResponse.json({
      ok: true,
      body: 'phobos',
      hub: 'stickney-alpha',
      discoveries: rows.filter((row: any) => row.discovered_at).map(dto),
    })
  } catch {
    return NextResponse.json({ error: 'Prospektionsdaten nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('current_location').eq('id', user.id).maybeSingle()
  if (profile?.current_location !== 'phobos') return NextResponse.json({ error: 'Prospektion ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const xM = finite(body.xM, 0)
  const yM = finite(body.yM, 0)
  const radiusM = Math.min(MAX_RADIUS_M, Math.max(25, finite(body.radiusM, DEFAULT_RADIUS_M)))

  try {
    const rows = await candidates()
    const inRange = rows.filter((row: any) => {
      const x = Number(row.x_m), y = Number(row.y_m)
      return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - xM, y - yM) <= radiusM
    })
    const alreadyKnown = inRange.filter((row: any) => row.discovered_at)
    const undiscovered = inRange.filter((row: any) => !row.discovered_at)
    const now = new Date().toISOString()
    const newlyDiscovered: any[] = []

    for (const row of undiscovered) {
      const props = row.properties ?? {}
      const chance = CHANCE[String(props.tier ?? 'trace')] ?? CHANCE.trace
      if (Math.random() >= chance) continue
      const nextProperties = { ...props, discovered_by: user.id, discovered_from_x_m: xM, discovered_from_y_m: yM }
      const { data: updated, error } = await supabase
        .from('region_resources')
        .update({ discovered_at: now, discovered_via: 'phobos_rover_scan', properties: nextProperties })
        .eq('id', row.id)
        .is('discovered_at', null)
        .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at,discovered_via')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (updated) newlyDiscovered.push(updated)
    }

    return NextResponse.json({
      ok: true,
      body: 'phobos',
      hub: 'stickney-alpha',
      xM, yM, radiusM,
      scannedTargets: inRange.length,
      alreadyKnown: alreadyKnown.map(dto),
      newlyDiscovered: newlyDiscovered.map(dto),
      missedTargets: Math.max(0, undiscovered.length - newlyDiscovered.length),
    })
  } catch {
    return NextResponse.json({ error: 'Prospektionslauf fehlgeschlagen.' }, { status: 503 })
  }
}
