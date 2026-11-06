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
// Vergessen ist gestuft und zählt ab der letzten Erwähnung: unbestätigt 30 Tage,
// bestätigt 180 Tage, festes Wissen (≥3 Quellen über ≥30 Tage) nie.
// Nach einer Kontolöschung bleibt das Gelernte Teil der Biografie der Figur –
// ohne Verbindung zum Konto (source_key statt Spieler-ID).

import { type RiskAssessment } from '../safety/realWorldRisk'
import { containsMask, maskPersonalData } from '../safety/personalData'
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

export type LearnableClaim = { claim: string; words: string[] }

/** Wird diese Äußerung zu etwas, das die Figur als Gehörtes behalten darf? */
export function learnableClaim(text: string, topic: ConversationTopic, risk: RiskAssessment): LearnableClaim | null {
  if (!LEARNABLE_TOPICS.has(topic)) return null
  // Nur aus Sätzen, die der Schutzfilter lesen kann (06.11.2026): Deutsch und Englisch.
  if (risk.level !== 'none' || (risk.language !== 'de' && risk.language !== 'en' && risk.language !== 'none')) return null
  const stripped = maskPersonalData(text).replace(/\s+/g, ' ').trim()
  if (containsMask(stripped) && !containsMask(text)) return null
  if (stripped.includes('?')) return null
  const norm = normalizeUtterance(stripped)
  if (QUESTION_START.test(norm) || PERSONAL.test(norm)) return null
  if (norm.split(' ').length < 4 || stripped.length < 20) return null
  const words = topicWords(stripped).slice(0, 12)
  if (words.length < 2) return null
  return { claim: stripped.slice(0, CLAIM_MAX_CHARS), words }
}

export type StoredClaim = {
  id?: number
  /** Pseudonymer Schlüssel der Quelle (sha256 der Spieler-ID); bleibt nach Kontolöschung. */
  source_key: string
  claim: string
  words: string[]
  created_at: string
  /** Letzte Erwähnung – auch Wiederholungen derselben Quelle frischen auf. */
  last_heard_at?: string | null
  established?: boolean | null
}
export type HeardClaim = { claim: string; sources: number; corroborated: boolean; established: boolean; at: string }

/** Ab hier gehört eine Aussage zum festen Wissen der Figur und wird nicht mehr vergessen. */
export const ESTABLISHED_SOURCES = 3
export const ESTABLISHED_SPAN_DAYS = 30

const overlap = (a: string[], b: string[]) => a.filter(w => b.includes(w)).length
const heardAt = (r: StoredClaim) => Date.parse(r.last_heard_at ?? r.created_at)

type Cluster = { rep: StoredClaim; members: StoredClaim[] }

/** Bündelt Aussagen gleichen Inhalts (mindestens zwei gemeinsame Schlüsselwörter). */
export function clusterClaims(rows: StoredClaim[]): Cluster[] {
  const clusters: Cluster[] = []
  for (const row of [...rows].sort((a, b) => heardAt(b) - heardAt(a))) {
    const home = clusters.find(c => overlap(c.rep.words, row.words) >= 2)
    if (home) home.members.push(row)
    else clusters.push({ rep: row, members: [row] })
  }
  return clusters
}

function clusterFacts(c: Cluster) {
  const sources = new Set(c.members.map(m => m.source_key)).size
  const newest = Math.max(...c.members.map(heardAt))
  const oldest = Math.min(...c.members.map(m => Date.parse(m.created_at)))
  const established = c.members.some(m => m.established)
    || (sources >= ESTABLISHED_SOURCES && (newest - oldest) / DAY_MS >= ESTABLISHED_SPAN_DAYS)
  return { sources, newest, established, corroborated: sources >= CORROBORATION_SOURCES }
}

/**
 * IDs der Aussagen, die jetzt zum festen Wissen werden: von mindestens drei
 * unabhängigen Quellen, über mindestens 30 Tage immer wieder erzählt.
 */
export function newlyEstablishedIds(rows: StoredClaim[]): number[] {
  const ids: number[] = []
  for (const c of clusterClaims(rows)) {
    if (!clusterFacts(c).established) continue
    for (const m of c.members) if (!m.established && typeof m.id === 'number') ids.push(m.id)
  }
  return ids
}

/**
 * Was die Figur einem Spieler weitererzählen kann: nur Aussagen anderer Spieler,
 * gebündelt nach Inhalt, gewichtet nach der Zahl unabhängiger Quellen.
 *
 * Vergessen zählt ab der letzten Erwähnung (06.11.2026, Thomas: „warum
 * verschwindet etwas, obwohl es wiederholt wird?“):
 *  * unbestätigt: 30 Tage nach der letzten Erwähnung
 *  * bestätigt (≥2 Quellen): 180 Tage nach der letzten Erwähnung
 *  * festes Wissen (≥3 Quellen über ≥30 Tage): nie
 */
export function selectHeardClaims(rows: StoredClaim[], input: { currentSourceKey: string; now: number; max?: number }): HeardClaim[] {
  const out: HeardClaim[] = []
  for (const c of clusterClaims(rows)) {
    const facts = clusterFacts(c)
    // Was nur der aktuelle Spieler selbst erzählt hat, bekommt er nicht zurück.
    const others = c.members.filter(m => m.source_key !== input.currentSourceKey)
    if (!others.length) continue
    const ageDays = (input.now - facts.newest) / DAY_MS
    if (!facts.established && ageDays > (facts.corroborated ? CORROBORATED_DAYS : SINGLE_SOURCE_DAYS)) continue
    out.push({ claim: others[0].claim, sources: facts.sources, corroborated: facts.corroborated, established: facts.established, at: new Date(facts.newest).toISOString() })
  }
  out.sort((a, b) => Number(b.established) - Number(a.established) || Number(b.corroborated) - Number(a.corroborated) || b.sources - a.sources || Date.parse(b.at) - Date.parse(a.at))
  return out.slice(0, input.max ?? 3)
}

/** Zeilen für die Figur. Nie mit Namen der Quelle. */
export function heardClaimLines(claims: HeardClaim[]): string[] {
  return claims.map(c => c.established
    ? `Das erzählt man sich hier schon lange, du hältst es für wahr: „${c.claim}“`
    : c.corroborated
      ? `Mehrere Leute haben dir erzählt: „${c.claim}“`
      : `Jemand hat dir erzählt (unbestätigt, du bist dir nicht sicher): „${c.claim}“`)
}
