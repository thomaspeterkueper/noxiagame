// app/api/game/services/route.ts
// Erstellt: 06.11.2026 — Polizei, Feuerwehr, Arztpraxis, Krankenhaus
// GET  ?place=…&service=… → { cases, incidents }   eigene Angaben hier (2 h) und – für die Wache –
//                                                    gemeldete Vorfälle in Lokalen (venue_incident, 2 Tage)
// POST { place, service, kind, text } → { ok, case }  Anzeige, Fundsache, Verlust, Mitmachen, Termin, Besuch

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { SERVICE_OFFERS, cleanCaseText, type ServiceCaseKind, type ServiceKind } from '@/lib/game/services/publicServices'

const PLACE_RE = /^[A-Za-z0-9:_.-]{3,120}$/
const SERVICES = Object.keys(SERVICE_OFFERS) as ServiceKind[]

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const place = req.nextUrl.searchParams.get('place') ?? ''
  const service = req.nextUrl.searchParams.get('service') as ServiceKind
  if (!PLACE_RE.test(place) || !SERVICES.includes(service)) return NextResponse.json({ error: 'Ort fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 2 * 3600e3).toISOString()
  const { data: cases } = await supabase.from('service_cases').select('kind,text,created_at').eq('place_ref', place).eq('profile_id', profileId).gte('created_at', since).order('created_at', { ascending: false }).limit(5)
  let incidents: string[] = []
  if (service === 'police') {
    const { data: rows } = await supabase.from('population_events').select('payload,created_at').eq('event_type', 'venue_incident').gte('created_at', new Date(Date.now() - 2 * 86400e3).toISOString()).order('created_at', { ascending: false }).limit(10)
    const ids = [...new Set((rows ?? []).map((r: any) => String(r.payload?.tileEntityId ?? '')).filter(Boolean))]
    const { data: tiles } = ids.length ? await supabase.from('tile_entities').select('id,display_name').in('id', ids) : { data: [] as any[] }
    const name = Object.fromEntries((tiles ?? []).map((t: any) => [t.id, String(t.display_name ?? 'einem Lokal')]))
    incidents = (rows ?? []).filter((r: any) => r.payload?.cancelled !== true).map((r: any) => {
      const p = r.payload ?? {}
      const hurt = Array.isArray(p.participants) && p.participants.some((x: any) => x?.outcome === 'verletzt')
      return `${p.level === 'kampf' ? 'Schlägerei' : 'Rangelei'} in ${name[p.tileEntityId] ?? 'einem Lokal'}${hurt ? ', jemand verletzt' : ''}${p.cause ? ' – ' + String(p.cause).slice(0, 60) : ''}`
    })
  }
  return NextResponse.json({ cases: (cases ?? []).map((c: any) => ({ kind: c.kind, text: c.text ?? '', at: c.created_at })), incidents }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const place = String(body?.place ?? '')
  const service = String(body?.service ?? '') as ServiceKind
  const kind = String(body?.kind ?? '') as ServiceCaseKind
  if (!PLACE_RE.test(place) || !SERVICES.includes(service)) return NextResponse.json({ error: 'Ort fehlt.' }, { status: 400 })
  if (!SERVICE_OFFERS[service].some(o => o.caseKind === kind)) return NextResponse.json({ error: 'Das gibt es hier nicht.' }, { status: 400 })
  const text = cleanCaseText(body?.text) ?? (kind === 'ff_mitmachen' || kind === 'termin' ? null : undefined)
  if (text === undefined) return NextResponse.json({ error: 'Bitte kurz beschreiben, worum es geht.' }, { status: 400 })
  const supabase = createServiceClient()
  const { count } = await supabase.from('service_cases').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).gte('created_at', new Date(Date.now() - 3600e3).toISOString())
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Für diese Stunde ist es genug – später wieder.' }, { status: 429 })
  const { data: row, error } = await supabase.from('service_cases').insert({ place_ref: place, service, kind, text, profile_id: profileId }).select('kind,text,created_at').single()
  if (error || !row) return NextResponse.json({ error: 'Nicht aufgenommen.' }, { status: 500 })
  return NextResponse.json({ ok: true, case: { kind: row.kind, text: row.text ?? '', at: row.created_at } })
}
