// lib/game/safety/aiReview.ts
// NOXIA-SAFETY-0001, Stufe 2 (06.11.2026): Regeln kennen keine Codewörter und
// nicht jede Sprache. Auffällige Gesprächsfenster (needsAiReview) prüft deshalb
// eine KI im Zusammenhang – in jeder Sprache, mit Blick auf Tarnbegriffe.
//
//  * Nur Fenster, die Stufe 1 auffällig findet; nicht jede Nachricht.
//  * Höchstens eine Prüfung je Person und Raum in 10 Minuten.
//  * Gespeichert wird nur das Ergebnis (safety_reviews), kein Wortlaut.
//  * Bei „real_world“ mit ausreichender Sicherheit wird der Ausschnitt gesichert
//    (secureSuspicion). Die KI entscheidet nichts über Spieler – ein Mensch prüft.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExcerptLine } from '../conversationInsights'
import type { RiskAssessment } from './realWorldRisk'

export const AI_REVIEW_MODEL = 'claude-haiku-4-5-20251001'
export const AI_REVIEW_COOLDOWN_MS = 10 * 60_000
export const AI_REVIEW_MIN_CONFIDENCE = 0.6

export type AiVerdict = {
  verdict: 'game' | 'unclear' | 'real_world'
  category: 'none' | 'drugs' | 'weapons' | 'violence' | 'minors' | 'sexual' | 'fraud' | 'other'
  confidence: number
  reason: string
  language: string
}

const SYSTEM = `Du bist der Schutzfilter des Online-Spiels NOXIA. Du prüfst einen kurzen Chat-Ausschnitt zwischen Spielern.

Über NOXIA: eine Zukunftswelt mit Raumfahrt, Kolonien auf dem Mars und auf Stationen sowie einer vereinfachten Erde mit realen Orten (z. B. Sundern, Frankfurt, Seelenberg, Bahnhöfe, Cafés). Bezahlt wird im Spiel nur in Credits (Cr). Spieler handeln Waren wie Erz, Wasser, Lebensmittel, Baumaterial; sie dürfen im Spiel schmuggeln, intrigieren, streiten und Verbrechen der Spielwelt spielen. Das ist erlaubt und KEIN Treffer.

Deine Frage: Nutzt jemand den Chat, um eine Straftat in der REALEN Welt zu verabreden oder anzubahnen? Dazu zählen insbesondere:
- Verkauf oder Übergabe von Drogen, Waffen, gefälschten Dokumenten, gestohlenen Daten
- reale Gewalt, Drohungen gegen reale Personen oder Orte
- Annäherung an Minderjährige mit sexuellem Bezug, Geheimhaltung oder Wechsel auf private Kanäle
- Betrug mit echtem Geld

Achte besonders auf:
- jede Sprache und Mischsprache, Umgangssprache, Abkürzungen
- harmlos klingende Codewörter (z. B. „Tickets“, „Kuchen“, „Pakete“, „Weißes“, Emojis), deren Bedeutung sich erst aus Menge, Preis in echter Währung, Treffpunkt, Uhrzeit oder Bezahlweg ergibt
- Hinweise auf die reale Welt: echte Währung statt Credits, „in echt“, Wechsel auf Messenger, Telefonnummern, Bezahldienste

Sei zurückhaltend: Rollenspiel, Witze, Spielhandel in Credits und Gespräche über reale Orte ohne Straftat sind „game“. Nimm „real_world“ nur, wenn der Zusammenhang wirklich auf eine reale Straftat zeigt; bei echtem Zweifel „unclear“.

Antworte NUR mit JSON, ohne Text davor oder danach:
{"verdict":"game|unclear|real_world","category":"none|drugs|weapons|violence|minors|sexual|fraud|other","confidence":0.0-1.0,"reason":"kurzer deutscher Satz, ohne Zitate aus dem Chat","language":"ISO-Sprachcode des Chats"}`

const CATEGORIES = new Set(['none', 'drugs', 'weapons', 'violence', 'minors', 'sexual', 'fraud', 'other'])

export function parseAiVerdict(text: string): AiVerdict | null {
  const match = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    const verdict = raw.verdict === 'real_world' || raw.verdict === 'unclear' ? raw.verdict : raw.verdict === 'game' ? 'game' : null
    if (!verdict) return null
    const category = CATEGORIES.has(String(raw.category)) ? raw.category as AiVerdict['category'] : 'other'
    const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0))
    const reason = String(raw.reason ?? '').replace(/["„“”]/g, '').slice(0, 300)
    const language = String(raw.language ?? '').slice(0, 12)
    return { verdict, category, confidence, reason, language }
  } catch {
    return null
  }
}

/** Ruft die KI-Prüfung auf. Liefert null bei Fehler oder Zeitüberschreitung. */
export async function runAiReview(lines: ExcerptLine[], signals: string[]): Promise<AiVerdict | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !lines.length) return null
  const transcript = lines.map((l, i) => `[${i + 1}] ${l.speaker}: ${l.text}`).join('\n').slice(0, 6000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_REVIEW_MODEL,
        max_tokens: 300,
        temperature: 0,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Merkmale aus der Vorprüfung: ${signals.join(', ') || 'keine'}\n\nChat-Ausschnitt:\n${transcript}` }],
      }),
    })
    if (!response.ok) {
      console.error('[safety] ai review failed', response.status)
      return null
    }
    const data = await response.json() as { content?: Array<{ text?: string }> }
    return parseAiVerdict(data.content?.[0]?.text ?? '')
  } catch (error) {
    console.error('[safety] ai review error', error instanceof Error ? error.name : error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function aiVerdictIsSuspect(v: AiVerdict | null): boolean {
  return Boolean(v && v.verdict === 'real_world' && v.confidence >= AI_REVIEW_MIN_CONFIDENCE)
}

/**
 * Stufe 2 für ein Raumfenster: Sperrfrist prüfen, KI fragen, Ergebnis ohne
 * Wortlaut speichern, bei Verdacht sichern lassen. Gibt das Urteil zurück.
 */
export async function reviewWindow(db: SupabaseClient, input: {
  subjectProfileId: string
  roomKey: string
  whisper: boolean
  risk: RiskAssessment
  lines: ExcerptLine[]
}): Promise<AiVerdict | null> {
  const { count } = await db.from('safety_reviews').select('id', { count: 'exact', head: true })
    .eq('subject_profile_id', input.subjectProfileId).eq('room_key', input.roomKey)
    .gte('created_at', new Date(Date.now() - AI_REVIEW_COOLDOWN_MS).toISOString())
  if ((count ?? 0) > 0) return null
  const verdict = await runAiReview(input.lines, input.risk.signals)
  const { error } = await db.from('safety_reviews').insert({
    subject_profile_id: input.subjectProfileId,
    room_key: input.roomKey,
    whisper: input.whisper,
    signals: input.risk.signals,
    screen_language: input.risk.language,
    verdict: verdict?.verdict ?? 'error',
    category: verdict?.category ?? null,
    confidence: verdict?.confidence ?? null,
    detected_language: verdict?.language || null,
    model: AI_REVIEW_MODEL,
  })
  if (error) console.error('[safety] review not stored', { code: error.code })
  return verdict
}
