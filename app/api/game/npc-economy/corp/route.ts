import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fundPlayerCorp } from '@/lib/game/npcEconomy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_CORP_FUND_AMOUNT_INVALID')) {
    return NextResponse.json({ error: 'Ungültiger Betrag.' }, { status: 400 })
  }
  if (message.includes('NOXIA_CREDITS_INSUFFICIENT')) {
    return NextResponse.json({ error: 'Nicht genug Credits.' }, { status: 409 })
  }
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) {
    return NextResponse.json({ error: 'Spielerprofil nicht gefunden.' }, { status: 404 })
  }
  console.error('player corp funding failed', message)
  return NextResponse.json({ error: 'Firmenfinanzierung fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: mapping } = await supabase
    .from('profile_economic_actors')
    .select('actor_id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!mapping?.actor_id) {
    return NextResponse.json({ exists: false, treasury: 0, activeEmployees: 0 })
  }

  const [{ data: actor }, { data: ledger }, { count: activeEmployees }] = await Promise.all([
    supabase.from('actors').select('id, display_name').eq('id', mapping.actor_id).single(),
    supabase.from('npc_ledger').select('credit_delta').eq('actor_id', mapping.actor_id),
    supabase
      .from('person_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('employer_actor_id', mapping.actor_id)
      .eq('assignment_type', 'work')
      .eq('is_active', true),
  ])

  const treasury = (ledger ?? []).reduce((sum: number, row: any) => sum + Number(row.credit_delta ?? 0), 0)
  return NextResponse.json({
    exists: true,
    actorId: actor?.id ?? mapping.actor_id,
    name: actor?.display_name ?? 'Unternehmen',
    treasury,
    activeEmployees: activeEmployees ?? 0,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const amount = Number.parseInt(String(body?.amount ?? ''), 10)
  const requestId = String(body?.requestId ?? '')

  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: 'Betrag muss zwischen 1 und 100000 Credits liegen.' }, { status: 400 })
  }
  if (!UUID_RE.test(requestId)) {
    return NextResponse.json({ error: 'Ungültige Anfrage-ID.' }, { status: 400 })
  }

  try {
    const result = await fundPlayerCorp({
      profileId: user.id,
      amount,
      requestId,
      note: typeof body?.note === 'string' ? body.note : 'Einlage des Eigentümers',
    })
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
