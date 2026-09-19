import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAscentMissionForShip } from '@/lib/game/core/ascentPersistence'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENGINEERING_REQUEST = 'EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function coreNotRolledOut(message: string) {
  return message.includes('PGRST202')
    || message.includes('PGRST205')
    || message.includes('Could not find the function')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
}

function ascentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (coreNotRolledOut(message)) {
    return NextResponse.json({
      error: 'Der Ascent-Core ist auf der Datenbank noch nicht ausgerollt.',
      code: 'ASCENT_CORE_NOT_DEPLOYED',
    }, { status: 503 })
  }
  if (message.includes('NOXIA_ASCENT_FORBIDDEN')) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Schiff.', code: 'FORBIDDEN' }, { status: 403 })
  }
  console.error('ascent state query failed:', message)
  return NextResponse.json({ error: 'Ascent-Zustand konnte nicht geladen werden.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipId = uuid(new URL(req.url).searchParams.get('shipId'))
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  try {
    const mission = await getAscentMissionForShip(user.id, shipId)
    return NextResponse.json({
      ok: true,
      mission,
      engineeringRequest: ENGINEERING_REQUEST,
      executionReady: false,
    })
  } catch (error) {
    return ascentError(error)
  }
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

  const action = typeof body.action === 'string' ? body.action : ''
  const shipId = uuid(body.shipId)
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  // Intentionally fail closed. Neither Engineering authority nor a flight executor may
  // be asserted by an untrusted client. Once Engineering supplies the exact lunar
  // ascent profile, this route can resolve it server-side and invoke the trusted Core
  // facade without changing the persistence contract.
  if (action === 'authorize') {
    return NextResponse.json({
      error: 'Für diesen Schiffsrahmen liegt noch keine autoritative Engineering-Freigabe für Mondoberfläche → Mondorbit vor.',
      code: 'ENGINEERING_ASCENT_AUTHORITY_UNAVAILABLE',
      engineeringRequest: ENGINEERING_REQUEST,
      shipId,
    }, { status: 409 })
  }

  if (['start', 'mark-insertion', 'mark-arrival', 'cancel'].includes(action)) {
    return NextResponse.json({
      error: 'Die operative Ascent-Ausführung ist noch nicht freigegeben. Zustandsübergänge dürfen nicht vom Client vorgetäuscht werden.',
      code: 'ASCENT_EXECUTION_UNAVAILABLE',
      engineeringRequest: ENGINEERING_REQUEST,
      shipId,
    }, { status: 409 })
  }

  return NextResponse.json({ error: 'Ungültige Ascent-Aktion.' }, { status: 400 })
}
