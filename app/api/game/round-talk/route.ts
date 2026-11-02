// app/api/game/round-talk/route.ts
// Erstellt: 02.11.2026
// Offene Gesprächsrunde: Die Anwesenden sprechen miteinander, der Spieler kann sich einklinken
// (lib/game/rounds/roundTalk.ts, Tabelle round_talk_lines).
//
// GET  ?roundKey=…&after=<id>   Beiträge lesen (für alle sichtbare und die eigenen)
// POST { roundKey, placeName, label, participants:[personId…], after?, text? }
//   ohne text: die Runde führt sich von selbst fort (höchstens alle ROUND_TICK_MS, geteilt für alle)
//   mit text:  der Spieler spricht; die Figuren antworten, nur für ihn sichtbar

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { chatComplete, chatProviderAvailable } from '@/lib/ai/chatProvider.server'
import { HELP_LINE, looksLikeDistress } from '@/lib/game/wishes/rules'
import {
  mayContinue, parseRoundLines, roundSystemPrompt, roundUserPrompt,
  ROUND_MAX_CHARS, ROUND_MAX_PEOPLE, ROUND_MAX_PLAYER_LINES_PER_MIN,
  type RoundPerson,
} from '@/lib/game/rounds/roundTalk'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const noStore = { 'Cache-Control': 'no-store' }

type Row = { id: number; speaker_person_id: string | null; speaker_name: string; text: string; visible_to: string | null; created_at: string }
const view = (row: Row, userId: string) => ({ id: row.id, name: row.speaker_name, text: row.text, speakerId: row.speaker_person_id, mine: row.visible_to === userId && row.speaker_person_id === null })

function roundKeyFrom(value: unknown): string | null {
  const key = typeof value === 'string' ? value.trim().slice(0, 160) : ''
  return key.length >= 3 ? key : null
}

export async function GET(req: NextRequest) {
  const userId = await verifiedBearerUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const roundKey = roundKeyFrom(req.nextUrl.searchParams.get('roundKey'))
  if (!roundKey) return NextResponse.json({ error: 'roundKey' }, { status: 400 })
  const after = Math.max(0, Number(req.nextUrl.searchParams.get('after') ?? 0) || 0)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('round_talk_lines')
    .select('id,speaker_person_id,speaker_name,text,visible_to,created_at')
    .eq('round_key', roundKey)
    .gt('id', after)
    .or(`visible_to.is.null,visible_to.eq.${userId}`)
    .order('id', { ascending: true })
    .limit(60)
  if (error) return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  return NextResponse.json({ lines: ((data ?? []) as Row[]).map(row => view(row, userId)) }, { headers: noStore })
}

export async function POST(req: NextRequest) {
  const userId = await verifiedBearerUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!chatProviderAvailable()) return NextResponse.json({ error: 'provider_unavailable' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const roundKey = roundKeyFrom(body.roundKey)
  if (!roundKey) return NextResponse.json({ error: 'roundKey' }, { status: 400 })
  const ids = (Array.isArray(body.participants) ? body.participants : []).map(String).filter((id: string) => UUID_RE.test(id)).slice(0, ROUND_MAX_PEOPLE)
  if (ids.length < 2) return NextResponse.json({ lines: [], quiet: true }, { headers: noStore })
  const label = String(body.label ?? 'Offene Gesprächszeit').slice(0, 60)
  const placeName = String(body.placeName ?? 'diesem Ort').slice(0, 60)
  const after = Math.max(0, Number(body.after ?? 0) || 0)
  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, ROUND_MAX_CHARS) : ''

  const supabase = createServiceClient()
  const { data: rows } = await supabase.from('people').select('id,display_name,public_role,bio_short').in('id', ids)
  const byId = new Map((rows ?? []).map(row => [String(row.id), row]))
  const people: RoundPerson[] = ids.flatMap((id: string) => {
    const row = byId.get(id)
    return row ? [{ id, name: String(row.display_name ?? ''), role: String(row.public_role ?? ''), bio: row.bio_short ? String(row.bio_short) : null }] : []
  }).filter((person: RoundPerson) => person.name)
  if (people.length < 2) return NextResponse.json({ lines: [], quiet: true }, { headers: noStore })

  const visibleFilter = `visible_to.is.null,visible_to.eq.${userId}`
  const { data: recentRows } = await supabase
    .from('round_talk_lines')
    .select('id,speaker_person_id,speaker_name,text,visible_to,created_at')
    .eq('round_key', roundKey).or(visibleFilter).order('id', { ascending: false }).limit(10)
  const recent = ((recentRows ?? []) as Row[]).reverse()
  const lastSpeakerId = [...recent].reverse().find(row => row.speaker_person_id)?.speaker_person_id ?? null
  const lastSpeaker = lastSpeakerId ? people.findIndex(person => person.id === lastSpeakerId) : -1

  const generate = async (count: number, player: { name: string; text: string } | null) => {
    const result = await chatComplete({
      messages: [
        { role: 'system', content: roundSystemPrompt({ label, placeName, people }) },
        { role: 'user', content: roundUserPrompt({ recent: recent.map(row => ({ name: row.speaker_name, text: row.text })), count, player }) },
      ],
      json: true, maxTokens: 260, temperature: 0.8, timeoutMs: 14000,
    })
    return result.ok ? parseRoundLines(result.content, people.length, count, lastSpeaker >= 0 ? lastSpeaker : null) : []
  }
  const insert = async (entries: Array<{ person: RoundPerson | null; name: string; text: string }>, visibleTo: string | null) => {
    if (!entries.length) return
    await supabase.from('round_talk_lines').insert(entries.map(entry => ({ round_key: roundKey, speaker_person_id: entry.person?.id ?? null, speaker_name: entry.name, text: entry.text, visible_to: visibleTo })))
  }
  const respond = async () => {
    const { data } = await supabase.from('round_talk_lines').select('id,speaker_person_id,speaker_name,text,visible_to,created_at')
      .eq('round_key', roundKey).gt('id', after).or(visibleFilter).order('id', { ascending: true }).limit(60)
    return NextResponse.json({ lines: ((data ?? []) as Row[]).map(row => view(row, userId)) }, { headers: noStore })
  }

  if (text) {
    // Notlage: nicht ins Gespräch geben, Hilfe nennen.
    if (looksLikeDistress(text)) return NextResponse.json({ lines: [], help: HELP_LINE }, { headers: noStore })
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count } = await supabase.from('round_talk_lines').select('id', { count: 'exact', head: true }).eq('visible_to', userId).is('speaker_person_id', null).gte('created_at', since)
    if ((count ?? 0) >= ROUND_MAX_PLAYER_LINES_PER_MIN) return NextResponse.json({ error: 'slow_down' }, { status: 429, headers: noStore })
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
    const playerName = String(profile?.username ?? '').trim().slice(0, 40) || 'Ein Gast'
    await insert([{ person: null, name: playerName, text }], userId)
    recent.push({ id: 0, speaker_person_id: null, speaker_name: playerName, text, visible_to: userId, created_at: new Date().toISOString() })
    const replies = await generate(2, { name: playerName, text })
    await insert(replies.map(reply => ({ person: people[reply.index], name: people[reply.index].name, text: reply.text })), userId)
    return respond()
  }

  // Die Runde führt sich fort: geteilt für alle, höchstens alle ROUND_TICK_MS.
  const { data: lastPublic } = await supabase.from('round_talk_lines').select('created_at').eq('round_key', roundKey).is('visible_to', null).order('id', { ascending: false }).limit(1).maybeSingle()
  const { count: publicCount } = await supabase.from('round_talk_lines').select('id', { count: 'exact', head: true }).eq('round_key', roundKey).is('visible_to', null)
  if (mayContinue(lastPublic?.created_at ? Date.parse(String(lastPublic.created_at)) : null, Date.now(), publicCount ?? 0)) {
    // Eigene (private) Beiträge sollen die gemeinsame Runde nicht beeinflussen: nur Öffentliches als Verlauf.
    const publicRecent = recent.filter(row => row.visible_to === null)
    recent.length = 0
    recent.push(...publicRecent)
    const lines = await generate(1, null)
    await insert(lines.map(line => ({ person: people[line.index], name: people[line.index].name, text: line.text })), null)
    // Gelegentlich Altes aufräumen.
    if (Math.random() < 0.05) await supabase.from('round_talk_lines').delete().lt('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString())
  }
  return respond()
}
