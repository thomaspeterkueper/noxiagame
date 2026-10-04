import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeNpcGiftAmount, transferPlayerToNpcCredits } from '@/lib/game/npcEconomy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function transferError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_TRANSFER_AMOUNT_INVALID')) {
    return NextResponse.json({ error: 'Ungültiger Betrag.' }, { status: 400 })
  }
  if (message.includes('NOXIA_CREDITS_INSUFFICIENT')) {
    return NextResponse.json({ error: 'Nicht genug Credits.' }, { status: 409 })
  }
  if (message.includes('NOXIA_PERSON_NOT_FOUND')) {
    return NextResponse.json({ error: 'Person nicht gefunden.' }, { status: 404 })
  }
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) {
    return NextResponse.json({ error: 'Spielerprofil nicht gefunden.' }, { status: 404 })
  }
  console.error('npc credit transfer failed', message)
  return NextResponse.json({ error: 'Credit-Transfer fehlgeschlagen.' }, { status: 500 })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const personId = String(body?.personId ?? '')
  const amount = normalizeNpcGiftAmount(body?.amount)
  if (!UUID_RE.test(personId)) return NextResponse.json({ error: 'Ungültige Person.' }, { status: 400 })
  if (!amount) return NextResponse.json({ error: 'Betrag muss zwischen 1 und 1000 Credits liegen.' }, { status: 400 })

  try {
    const result = await transferPlayerToNpcCredits({
      profileId: user.id,
      personId,
      amount,
      note: typeof body?.note === 'string' ? body.note : 'Geschenk im persönlichen Gespräch',
    })
    return NextResponse.json({
      ok: true,
      amount: result.amount,
      playerCredits: result.player_credits,
      npcCredits: result.npc_credits,
      npcActorId: result.actor_id,
    })
  } catch (error) {
    return transferError(error)
  }
}
