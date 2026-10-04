import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const personId = typeof body?.personId === 'string' ? body.personId : null
  const state = body?.state === 'inferred' ? 'inferred' : body?.state === 'known' ? 'known' : null
  const sourceKind = typeof body?.sourceKind === 'string' && body.sourceKind.trim()
    ? body.sourceKind.trim()
    : state === 'known' ? 'introduction' : 'observation'
  const sourceRef = typeof body?.sourceRef === 'string' ? body.sourceRef : null
  const inferredName = typeof body?.inferredName === 'string' && body.inferredName.trim()
    ? body.inferredName.trim()
    : null

  if (!personId || !state) {
    return NextResponse.json({ error: 'personId und state erforderlich.' }, { status: 400 })
  }
  if (state === 'inferred' && !inferredName) {
    return NextResponse.json({ error: 'inferredName erforderlich.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('id, display_name')
    .eq('id', personId)
    .maybeSingle()

  if (personError || !person) return NextResponse.json({ error: 'Person nicht gefunden.' }, { status: 404 })

  const { data: tickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = {
    profile_id: user.id,
    person_id: person.id,
    identity_state: state,
    inferred_name: state === 'inferred' ? inferredName : null,
    known_name: state === 'known' ? person.display_name : null,
    confidence: state === 'known' ? 1 : 0.65,
    source_kind: sourceKind,
    source_ref: sourceRef,
    learned_tick: tickRow?.tick_number ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('player_person_identity_knowledge')
    .upsert(row, { onConflict: 'profile_id,person_id' })

  if (error) return NextResponse.json({ error: 'Identität konnte nicht gespeichert werden.' }, { status: 500 })

  return NextResponse.json({
    personId: person.id,
    identityState: state,
    perceivedLabel: state === 'known' ? person.display_name : inferredName,
  })
}
