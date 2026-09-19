import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveAscentReadiness } from '@/lib/game/core/ascentReadiness'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const shipId = nonEmpty(body.shipId)
  const departureSurfaceSlug = nonEmpty(body.departureSurfaceSlug)
  const targetOrbitNodeSlug = nonEmpty(body.targetOrbitNodeSlug)

  if (!shipId || !UUID_RE.test(shipId)) {
    return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })
  }
  if (!departureSurfaceSlug || !targetOrbitNodeSlug) {
    return NextResponse.json({
      error: 'departureSurfaceSlug und targetOrbitNodeSlug sind erforderlich.',
    }, { status: 400 })
  }

  try {
    // Crew, cargo and Engineering are deliberately not client inputs. Their owning
    // subsystems must supply trusted verdicts server-side in later integration steps.
    const result = await resolveAscentReadiness(
      user.id,
      shipId,
      departureSurfaceSlug,
      targetOrbitNodeSlug,
    )

    if (result.ship && result.ship.profile_id !== user.id) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Schiff.', code: 'FORBIDDEN' }, { status: 403 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const schemaMissing = message.includes('PGRST202')
      || message.includes('PGRST205')
      || message.includes('Could not find the table')
      || message.includes('schema cache')

    if (schemaMissing) {
      return NextResponse.json({
        error: 'Der Ascent-Core ist auf der Datenbank noch nicht vollständig ausgerollt.',
        code: 'ASCENT_CORE_NOT_DEPLOYED',
      }, { status: 503 })
    }

    console.error('ascent readiness failed:', message)
    return NextResponse.json({ error: 'Ascent-Readiness konnte nicht aufgelöst werden.' }, { status: 500 })
  }
}
