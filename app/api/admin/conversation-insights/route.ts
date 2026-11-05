// app/api/admin/conversation-insights/route.ts
// NOXIA-PRIVACY-0004 (05.11.2026): Kein Mensch liest Spielergespräche mit.
// GET  → Kennzahlen (ab MIN_GROUP Spielern je Zelle), Kausalspur-Zähler,
//        Gespräche der Admin-Testkonten im Wortlaut, von Spielern gemeldete Ausschnitte,
//        vom Schutzfilter gesicherte Ausschnitte (NOXIA-SAFETY-0001), Umfang des Gelernten
// POST { reportId, status: 'done' | 'open' } → Meldung als erledigt markieren
//
// Wortlaut geschützter Gespräche verlässt diese Route nie.

import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { createServiceClient } from '@/lib/supabase/service'
import { buildConversationInsights, MIN_GROUP, RAW_TEXT_RETENTION_DAYS, REPORT_RETENTION_DAYS, type InsightRow } from '@/lib/game/conversationInsights'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

async function requireAdmin(req: NextRequest) {
  const actor = await verifiedBearerUserId(req)
  if (!actor) return { error: NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 }) }
  const db = createServiceClient()
  const { data: admin, error } = await db.from('admin_profiles').select('profile_id').eq('profile_id', actor).maybeSingle()
  if (error || !admin) return { error: NextResponse.json({ error: 'Keine Adminberechtigung' }, { status: 403 }) }
  return { actor, db }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const { actor, db } = auth
  const days = Math.max(1, Math.min(180, Number(req.nextUrl.searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: admins, error: adminsError } = await db.from('admin_profiles').select('profile_id')
  if (adminsError) return NextResponse.json({ error: 'Adminliste nicht verfügbar' }, { status: 503 })
  const adminIds = new Set((admins ?? []).map(a => String(a.profile_id)))

  // Nur Spalten ohne Wortlaut.
  const { data: rows, error } = await db.from('npc_conversation_log')
    .select('player_profile_id,created_at,npc_person_id,npc_name,location_name,topic,outcome,world_action,wish_kind,opening,safety_flags')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(20000)
  if (error) return NextResponse.json({ error: 'Auswertung nicht verfügbar' }, { status: 503 })
  const playerRows = (rows ?? []).filter(r => !adminIds.has(String(r.player_profile_id))) as InsightRow[]
  const testRows = (rows ?? []).filter(r => adminIds.has(String(r.player_profile_id))) as InsightRow[]

  const { data: traces, error: traceError } = await db.from('npc_conversation_causal_traces')
    .select('stage,status').gte('created_at', since).limit(50000)
  if (traceError) return NextResponse.json({ error: 'Kausalspuren nicht verfügbar' }, { status: 503 })
  const traceCounts = new Map<string, number>()
  for (const t of traces ?? []) {
    const key = `${t.stage}|${t.status}`
    traceCounts.set(key, (traceCounts.get(key) ?? 0) + 1)
  }

  // Schutzfilter-Kennzeichen (NOXIA-SAFETY-0001): nur Zählungen, kein Wortlaut.
  const { data: roomFlags, error: roomFlagError } = await db.from('player_room_messages')
    .select('flags').gte('created_at', since).neq('flags', '{}').limit(20000)
  if (roomFlagError) return NextResponse.json({ error: 'Raumkennzeichen nicht verfügbar' }, { status: 503 })
  const safetyCounts = new Map<string, { npc: number; room: number }>()
  const bump = (flag: string, where: 'npc' | 'room') => {
    if (!flag.startsWith('risk:')) return
    const entry = safetyCounts.get(flag.slice(5)) ?? { npc: 0, room: 0 }
    entry[where]++
    safetyCounts.set(flag.slice(5), entry)
  }
  for (const r of playerRows as Array<InsightRow & { safety_flags?: string[] }>) for (const f of r.safety_flags ?? []) bump(f, 'npc')
  for (const r of roomFlags ?? []) for (const f of (r.flags as string[] | null) ?? []) bump(f, 'room')

  // Was Figuren von Spielern gelernt haben (NOXIA-LEARN-0001): nur Umfang.
  const { data: claims, error: claimError } = await db.from('npc_learned_claims')
    .select('npc_person_id,source_profile_id').limit(50000)
  if (claimError) return NextResponse.json({ error: 'Gelerntes nicht verfügbar' }, { status: 503 })
  const claimSources = new Set((claims ?? []).map(c => String(c.source_profile_id))).size
  const learning = {
    claims: claims?.length ?? 0,
    npcs: new Set((claims ?? []).map(c => String(c.npc_person_id))).size,
    sources: claimSources >= MIN_GROUP ? claimSources : null,
  }

  // Admin-Testkonten: Wortlaut erlaubt.
  const { data: testTurns, error: testError } = adminIds.size
    ? await db.from('npc_conversation_log')
      .select('id,created_at,npc_name,npc_role,location_name,player_text,npc_reply,topic,outcome,world_action,wish_kind,turn_index,correlation_id')
      .in('player_profile_id', [...adminIds]).order('created_at', { ascending: false }).limit(50)
    : { data: [], error: null }
  if (testError) return NextResponse.json({ error: 'Testgespräche nicht verfügbar' }, { status: 503 })

  // Vom Spieler selbst gemeldete Ausschnitte.
  const { data: reports, error: reportError } = await db.from('conversation_reports')
    .select('id,origin,reporter_profile_id,subject_profile_id,signals,created_at,expires_at,source,reason,comment,npc_name,room_key,location_name,excerpt,status')
    .order('created_at', { ascending: false }).limit(50)
  if (reportError) return NextResponse.json({ error: 'Meldungen nicht verfügbar' }, { status: 503 })
  if (reports?.length) {
    const audit = reports.map(o => ({
      admin_profile_id: actor, profile_id: o.origin === 'filter' ? o.subject_profile_id : o.reporter_profile_id, report_id: o.id, conversation_log_id: null,
    })).filter(a => a.profile_id)
    const { error: auditError } = audit.length ? await db.from('admin_conversation_read_audit').insert(audit) : { error: null }
    if (auditError) return NextResponse.json({ error: 'Zugriffsprotokoll konnte nicht geschrieben werden' }, { status: 503 })
  }

  return NextResponse.json({
    days,
    minGroup: MIN_GROUP,
    retention: { rawTextDays: RAW_TEXT_RETENTION_DAYS, reportDays: REPORT_RETENTION_DAYS },
    insights: buildConversationInsights(playerRows),
    testInsights: { turns: testRows.length },
    traces: [...traceCounts].map(([key, count]) => {
      const [stage, status] = key.split('|')
      return { stage, status, count }
    }).sort((a, b) => b.count - a.count),
    testTurns: testTurns ?? [],
    safety: [...safetyCounts].map(([signal, c]) => ({ signal, ...c })).sort((a, b) => (b.npc + b.room) - (a.npc + a.room)),
    learning,
    reports: (reports ?? []).map(({ reporter_profile_id, subject_profile_id, ...rest }) => { void reporter_profile_id; void subject_profile_id; return rest }),
  }, { headers })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const body = await req.json().catch(() => null) as { reportId?: unknown; status?: unknown } | null
  const reportId = Number(body?.reportId)
  const status = body?.status === 'open' ? 'open' : 'done'
  if (!Number.isInteger(reportId) || reportId <= 0) return NextResponse.json({ error: 'Meldung fehlt' }, { status: 400 })
  const { error } = await auth.db.from('conversation_reports').update({ status }).eq('id', reportId)
  if (error) return NextResponse.json({ error: 'Nicht gespeichert' }, { status: 503 })
  return NextResponse.json({ ok: true }, { headers })
}
