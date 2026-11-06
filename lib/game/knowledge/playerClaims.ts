// lib/game/knowledge/playerClaims.ts
// NOXIA-LEARN-0001 (Thomas, 05.11.2026): NPCs sollen aus Gesprächen mit echten
// Spielern lernen – möglichst unzensiert.
//
// Grundsatz: unzensierte Eingabe, aber keine ungeprüfte Übernahme.
//  * Spieler dürfen alles sagen; gefiltert wird nur Realwelt-Kriminalität
//    (lib/game/safety/realWorldRisk.ts).
//  * Eine Figur merkt sich Aussagen über die Welt (nicht über den Sprecher,
//    nicht über sich selbst) als Gehörtes, gekürzt und ohne Kontaktdaten.
//  * Weitererzählt wird gewichtet: Was mehrere Spieler unabhängig sagen, gilt als
//    „man erzählt sich“; was nur einer sagt, bleibt unbestätigt und verblasst
//    schneller. So kann ein einzelner Troll nicht allen Figuren etwas beibringen.
//  * Wer etwas erzählt hat, nennt die Figur nie.
//
// Vergessen ist gestuft, nicht pauschal: unbestätigt 30 Tage, bestätigt 180 Tage.

import { stripContactData, type RiskAssessment } from '../safety/realWorldRisk'
import type { ConversationTopic } from '../cognition/conversationTopic'
import { normalizeUtterance } from '../cognition/conversationRepeat'
import { topicWords } from '../cognition/conversationRecall'

export const CLAIM_MAX_CHARS = 200
export const SINGLE_SOURCE_DAYS = 30
export const CORROBORATED_DAYS = 180
export const CORROBORATION_SOURCES = 2
const DAY_MS = 86_400_000

const LEARNABLE_TOPICS: ReadonlySet<ConversationTopic> = new Set(['world_news', 'orientation', 'work_money', 'travel', 'other'])
const QUESTION_START = /^(wer|was|wo|wie|wann|warum|wieso|weshalb|welche\w*|kannst|koennt\w*|hast|habt|gibt es|gibts|ist|sind|bist|weisst|wisst|darf|duerfen|soll|sollen|willst|wollt|magst|who|what|where|how|when|why|which|can|could|do|does|did|is|are|have|has|will|would|should)\b/
// Aussagen über den Sprecher oder das Gegenüber gehören ins persönliche Gedächtnis, nicht ins Weltwissen.
const PERSONAL = /\b(ich|mir|mich|mein\w*|du|dir|dich|dein\w*|wir|uns|unser\w*|ihr|euch|euer\w*|i|me|my|mine|you|your|yours|we|us|our|ours)\b/
const PLACEHOLDER = /\[(Kontakt|Link|Nummer|Name) entfernt\]/

export type LearnableClaim = { claim: string; words: string[] }

/** Wird diese Äußerung zu etwas, das die Figur als Gehörtes behalten darf? */
export function learnableClaim(text: string, topic: ConversationTopic, risk: RiskAssessment): LearnableClaim | null {
  if (!LEARNABLE_TOPICS.has(topic)) return null
  // Nur aus Sätzen, die der Schutzfilter lesen kann (06.11.2026): Deutsch und Englisch.
  if (risk.level !== 'none' || (risk.language !== 'de' && risk.language !== 'en' && risk.language !== 'none')) return null
  const stripped = stripContactData(text).replace(/\s+/g, ' ').trim()
  if (PLACEHOLDER.test(stripped)) return null
  if (stripped.includes('?')) return null
  const norm = normalizeUtterance(stripped)
  if (QUESTION_START.test(norm) || PERSONAL.test(norm)) return null
  if (norm.split(' ').length < 4 || stripped.length < 20) return null
  const words = topicWords(stripped).slice(0, 12)
  if (words.length < 2) return null
  return { claim: stripped.slice(0, CLAIM_MAX_CHARS), words }
}

export type StoredClaim = { source_profile_id: string; claim: string; words: string[]; created_at: string }
export type HeardClaim = { claim: string; sources: number; corroborated: boolean; at: string }

const overlap = (a: string[], b: string[]) => a.filter(w => b.includes(w)).length

/**
 * Was die Figur einem Spieler weitererzählen kann: nur Aussagen anderer Spieler,
 * gebündelt nach Inhalt, gewichtet nach der Zahl unabhängiger Quellen.
 */
export function selectHeardClaims(rows: StoredClaim[], input: { currentPlayer: string; now: number; max?: number }): HeardClaim[] {
  const others = rows.filter(r => r.source_profile_id !== input.currentPlayer)
  const clusters: Array<{ rep: StoredClaim; members: StoredClaim[] }> = []
  for (const row of [...others].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    const home = clusters.find(c => overlap(c.rep.words, row.words) >= 2)
    if (home) home.members.push(row)
    else clusters.push({ rep: row, members: [row] })
  }
  const out: HeardClaim[] = []
  for (const c of clusters) {
    const sources = new Set(c.members.map(m => m.source_profile_id)).size
    const corroborated = sources >= CORROBORATION_SOURCES
    const newest = Math.max(...c.members.map(m => Date.parse(m.created_at)))
    const ageDays = (input.now - newest) / DAY_MS
    if (ageDays > (corroborated ? CORROBORATED_DAYS : SINGLE_SOURCE_DAYS)) continue
    out.push({ claim: c.rep.claim, sources, corroborated, at: new Date(newest).toISOString() })
  }
  out.sort((a, b) => Number(b.corroborated) - Number(a.corroborated) || b.sources - a.sources || Date.parse(b.at) - Date.parse(a.at))
  return out.slice(0, input.max ?? 3)
}

/** Zeilen für die Figur. Nie mit Namen der Quelle. */
export function heardClaimLines(claims: HeardClaim[]): string[] {
  return claims.map(c => c.corroborated
    ? `Mehrere Leute haben dir erzählt: „${c.claim}“`
    : `Jemand hat dir erzählt (unbestätigt, du bist dir nicht sicher): „${c.claim}“`)
}
