// app/api/admin/wishes/route.ts
// Admin-Bereich: Wünsche und Gebete (Thomas, 29.10.2026).
// GET  – Übersicht: Bündel mit Anzahl und Status, letzte Wünsche (private nur gezählt, nie im Wortlaut)
// POST – { id, action: 'reject' | 'adjust' | 'fulfil' | 'reopen', note?, summary?, category?, clusterKey? }

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { evaluateWish } from '@/lib/game/wishes/service.server'
import { WISH_CATEGORIES } from '@/lib/game/wishes/rules'

async function adminId(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return null
  const { data } = await createServiceClient().from('admin_profiles').select('profile_id').eq('profile_id', profileId).maybeSingle()
  return data ? profileId : null
}

type Row = { id: string; created_at: string; source: string; channel: string; place_name: string | null; text: string; status: string; category: string | null; summary: string | null; cluster_key: string | null; reason: string | null; decided_by: string | null; fulfilment: Record<string, unknown> | null; admin_note: string | null; profile_id: string | null; person_id: string | null; sense: number | null }

export async function GET(req: NextRequest) {
  if (!await adminId(req)) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('wishes')
    .select('id,created_at,source,channel,place_name,text,status,category,summary,cluster_key,reason,decided_by,fulfilment,admin_note,profile_id,person_id,sense')
    .order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Row[]
  const profileIds = [...new Set(rows.map(row => row.profile_id).filter(Boolean))] as string[]
  const personIds = [...new Set(rows.map(row => row.person_id).filter(Boolean))] as string[]
  const [{ data: profiles }, { data: people }] = await Promise.all([
    profileIds.length ? supabase.from('profiles').select('id,username').in('id', profileIds) : Promise.resolve({ data: [] }),
    personIds.length ? supabase.from('people').select('id,display_name').in('id', personIds) : Promise.resolve({ data: [] }),
  ])
  const nameOf = new Map<string, string>([
    ...((profiles ?? []) as Array<{ id: string; username: string }>).map(p => [p.id, p.username] as [string, string]),
    ...((people ?? []) as Array<{ id: string; display_name: string }>).map(p => [p.id, p.display_name + ' (Figur)'] as [string, string]),
  ])
  // Private Anliegen (echtes Leben, Notlage): nur zählen, nie im Wortlaut zeigen.
  const wishes = rows.map(row => row.status === 'privat'
    ? { id: row.id, created_at: row.created_at, source: row.source, channel: row.channel, status: row.status, reason: row.reason, private: true }
    : { ...row, who: nameOf.get(row.profile_id ?? row.person_id ?? '') ?? null, profile_id: undefined, person_id: undefined })
  const clusters = new Map<string, { key: string; summary: string; category: string | null; count: number; people: Set<string>; statuses: Record<string, number>; last: string }>()
  for (const row of rows) {
    if (row.status === 'privat' || !row.cluster_key) continue
    const entry = clusters.get(row.cluster_key) ?? { key: row.cluster_key, summary: row.summary ?? row.text.slice(0, 80), category: row.category, count: 0, people: new Set<string>(), statuses: {}, last: row.created_at }
    entry.count += 1
    entry.people.add(row.profile_id ?? row.person_id ?? row.id)
    entry.statuses[row.status] = (entry.statuses[row.status] ?? 0) + 1
    if (row.created_at > entry.last) entry.last = row.created_at
    clusters.set(row.cluster_key, entry)
  }
  const totals: Record<string, number> = {}
  for (const row of rows) totals[row.status] = (totals[row.status] ?? 0) + 1
  return NextResponse.json({
    totals,
    clusters: [...clusters.values()].map(c => ({ ...c, people: c.people.size })).sort((a, b) => b.people - a.people || b.last.localeCompare(a.last)),
    wishes,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const admin = await adminId(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id ?? '')
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Wunsch fehlt' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: row } = await supabase.from('wishes').select('id,status,assessment').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (row.status === 'privat') return NextResponse.json({ error: 'Private Anliegen werden nicht bearbeitet.' }, { status: 409 })
  const now = new Date().toISOString()
  const note = String(body.note ?? '').slice(0, 300) || null
  const action = String(body.action ?? '')
  if (action === 'reject') {
    await supabase.from('wishes').update({ status: 'abgelehnt', reason: note ?? 'vom Admin abgelehnt', decided_by: 'admin', decided_at: now, admin_note: note, updated_at: now }).eq('id', id)
    return NextResponse.json({ ok: true })
  }
  if (action === 'adjust' || action === 'fulfil' || action === 'reopen') {
    const assessment = { ...(row.assessment as Record<string, unknown> ?? {}) }
    if (typeof body.summary === 'string' && body.summary.trim()) assessment.summary = body.summary.trim().slice(0, 80)
    if ((WISH_CATEGORIES as readonly string[]).includes(String(body.category))) assessment.category = body.category
    if (typeof body.clusterKey === 'string' && body.clusterKey.trim()) assessment.clusterKey = body.clusterKey.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    // Erfüllen auf Wunsch des Admins: Sinn und Unterstützung gelten als gegeben.
    if (action === 'fulfil') Object.assign(assessment, { sense: 1, harmful: false, selfish: false, realPerson: false })
    await supabase.from('wishes').update({ assessment, admin_note: note, status: 'neu', updated_at: now }).eq('id', id)
    const { data: last } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
    const result = await evaluateWish(supabase, id, Number(last?.tick_number ?? 0), { reuse: true, force: action === 'fulfil' })
    await supabase.from('wishes').update({ decided_by: 'admin' }).eq('id', id)
    return NextResponse.json({ ok: true, status: result.status })
  }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
