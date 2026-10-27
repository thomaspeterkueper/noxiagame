// app/api/game/practice/route.ts
// Übungen in Schulen und Werkstätten (NOXIA-SCHOOL-0001). Lernen kostet nie Geld.
//
// GET  ?tileEntityId=…  → aktive Übungen, Vorrat des Gebäudes, laufende Übung des Spielers,
//                         eigene Kompetenzen und Bescheinigungen.
// POST { action: 'start', tileEntityId, recipeCode, guideProfileId? }
// POST { action: 'complete', sessionId }
// Die Regeln liegen in SQL (noxia_start_practice / noxia_complete_practice), Formeln wie
// lib/game/skills/skills.ts. Der Würfel wird hier gezogen, nicht im Client.

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i
const CODE_RE = /^[a-z0-9_:-]{1,80}$/
const headers = { 'Cache-Control': 'private, no-store' }

type Amount = { resource: string; amount: number }
type RecipeRow = { inputs: Amount[] | null } & Record<string, unknown>
type InventoryRow = { logistics_inventory_items: Amount[] | null } | null
type RpcResult = { ok?: boolean } & Record<string, unknown>

async function currentTick(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  return Number(data?.tick_number ?? 0)
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = new URL(req.url).searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })

  const supabase = createServiceClient()
  const [{ data: recipes }, { data: inventory }, { data: running }, { data: skills }, { data: certificates }, tick] = await Promise.all([
    supabase.from('practice_recipes').select('code,skill_code,capability,difficulty,duration_game_minutes,min_level,requires_guide,inputs,outputs,kg_module_id').eq('active', true),
    supabase.from('logistics_inventories').select('id,logistics_inventory_items(resource,amount)').eq('storage_kind', 'native').eq('subject_type', 'tile_entity').eq('subject_id', tileEntityId).maybeSingle(),
    supabase.from('practice_sessions').select('id,recipe_code,tile_entity_id,guide_kind,started_tick,due_tick').eq('learner_profile_id', profileId).eq('status', 'running').maybeSingle(),
    supabase.from('profile_skills').select('skill_code,level,peak_level,last_practiced_tick').eq('profile_id', profileId),
    supabase.from('skill_certificates').select('skill_code,kind,level,issued_tick').eq('holder_profile_id', profileId).order('issued_tick', { ascending: false }).limit(50),
    currentTick(supabase),
  ])
  const stock = Object.fromEntries(((inventory as InventoryRow)?.logistics_inventory_items ?? []).map(row => [row.resource, Number(row.amount)]))
  const offers = ((recipes ?? []) as RecipeRow[]).map(r => ({
    ...r,
    materialsAvailable: (r.inputs ?? []).every(i => (stock[i.resource] ?? 0) >= Number(i.amount)),
  }))
  return NextResponse.json({ ok: true, tick, offers, stock, running: running ?? null, skills: skills ?? [], certificates: certificates ?? [] }, { headers })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })

  const supabase = createServiceClient()
  const tick = await currentTick(supabase)

  if (body.action === 'start') {
    const tileEntityId = String(body.tileEntityId ?? '')
    const recipeCode = String(body.recipeCode ?? '')
    const guideProfileId = body.guideProfileId == null ? null : String(body.guideProfileId)
    if (!UUID_RE.test(tileEntityId) || !CODE_RE.test(recipeCode) || (guideProfileId && !UUID_RE.test(guideProfileId))) {
      return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 })
    }
    const commandId = typeof body.commandId === 'string' && UUID_RE.test(body.commandId) ? body.commandId : randomUUID()
    const { data, error } = await supabase.rpc('noxia_start_practice', {
      p_command_id: commandId, p_learner_person_id: null, p_learner_profile_id: profileId,
      p_recipe_code: recipeCode, p_tile_entity_id: tileEntityId,
      p_guide_person_id: null, p_guide_profile_id: guideProfileId, p_tick: tick,
    })
    if (error) return NextResponse.json({ error: 'Übung konnte nicht beginnen.' }, { status: 500 })
    return NextResponse.json({ ...(data as RpcResult), tick }, { status: (data as RpcResult)?.ok ? 200 : 409, headers })
  }

  if (body.action === 'complete') {
    const sessionId = String(body.sessionId ?? '')
    if (!UUID_RE.test(sessionId)) return NextResponse.json({ error: 'sessionId fehlt.' }, { status: 400 })
    const { data: session } = await supabase.from('practice_sessions').select('id').eq('id', sessionId).eq('learner_profile_id', profileId).maybeSingle()
    if (!session) return NextResponse.json({ error: 'Übung nicht gefunden.' }, { status: 404 })
    const { data, error } = await supabase.rpc('noxia_complete_practice', { p_session_id: sessionId, p_roll: Math.random(), p_tick: tick })
    if (error) return NextResponse.json({ error: 'Übung konnte nicht abgeschlossen werden.' }, { status: 500 })
    return NextResponse.json({ ...(data as RpcResult), tick }, { status: (data as RpcResult)?.ok ? 200 : 409, headers })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
