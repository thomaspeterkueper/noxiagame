// lib/game/cognition/conversationRecall.ts
// Aktualisiert: 26.10.2026 — Verblassen und Aufwärmen des Gesprächsgedächtnisses (npc_player_conversation_memory)
// Version:      1.0.0
//
// Eine Figur erinnert sich an frühere Wortwechsel mit einem Spieler – aber
// nicht gleichförmig. Was gerade erst war, weiß sie wörtlich. Was Tage her
// ist, hat sie nur noch dem Sinn nach. Was Wochen her ist und nicht wieder
// aufkam, ist auf „wir haben uns mal unterhalten“ geschrumpft. Spricht der
// Spieler ein altes Thema wieder an, kommt genau dieser Wortwechsel zurück
// („aufwärmen“) und gilt ab dann wieder als frisch. Wiedersehen hält
// Erinnerungen länger: recent_encounter_score streckt alle Schwellen.

export type RecallExchange = { player?: unknown; npc?: unknown; at?: unknown; location?: unknown }
export type RecallStage = 'fresh' | 'faded' | 'dim' | 'forgotten'
export type RecallLine = { stage: RecallStage; index: number; text: string }

const DAY_MS = 86_400_000
const STOP = new Set(['haben', 'nicht', 'einen', 'einem', 'einer', 'eines', 'schon', 'immer', 'etwas', 'etwas', 'gerade', 'heute', 'morgen', 'gestern', 'wieder', 'können', 'kannst', 'möchte', 'würde', 'sollte', 'dabei', 'damit', 'darauf', 'daran', 'ihnen', 'ihrem', 'ihrer', 'unser', 'unsere', 'meine', 'deine', 'seine', 'diese', 'dieser', 'dieses', 'jetzt', 'hallo', 'guten', 'danke', 'bitte', 'vielen'])

function text(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Inhaltswörter (≥ 5 Buchstaben, keine Füllwörter) – die Themen eines Satzes. */
export function topicWords(sentence: string) {
  return [...new Set(sentence.toLocaleLowerCase('de-DE').replace(/[^a-zäöüß\s-]/g, ' ').split(/[\s-]+/).filter(word => word.length >= 5 && !STOP.has(word)))]
}

/** Kurzfassung eines Wortwechsels: die ersten Worte, ohne Nebensätze. */
function gist(sentence: string, maxWords: number) {
  const words = sentence.split(/[,;–—.!?]/)[0].split(' ').filter(Boolean)
  return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? ' …' : '')
}

/**
 * Stufe eines Wortwechsels nach Alter. `retention` (0…1, aus dem Wiedersehens-
 * Wert) dehnt die Schwellen: wer sich oft sieht, hält Erinnerungen länger.
 */
export function recallStage(ageDays: number, retention: number): RecallStage {
  const stretch = 1 + Math.max(0, Math.min(1, retention)) * 2
  if (ageDays <= 3 * stretch) return 'fresh'
  if (ageDays <= 21 * stretch) return 'faded'
  if (ageDays <= 90 * stretch) return 'dim'
  return 'forgotten'
}

/**
 * Erinnerungszeilen für den Prompt. `rewarmed` sind die Indizes der Wortwechsel,
 * die der Spieler mit seiner aktuellen Nachricht wieder angesprochen hat.
 */
export function recallLines(input: {
  exchanges: RecallExchange[]
  now: number
  retention: number
  playerMessage: string
  maxLines?: number
}): { lines: RecallLine[]; rewarmed: number[] } {
  const maxLines = input.maxLines ?? 5
  const topics = new Set(topicWords(input.playerMessage))
  const scored = input.exchanges.map((exchange, index) => {
    const at = Date.parse(String(exchange.at ?? ''))
    const ageDays = Number.isFinite(at) ? Math.max(0, (input.now - at) / DAY_MS) : 365
    const player = text(exchange.player, 160), npc = text(exchange.npc, 200)
    const words = topicWords(`${player} ${npc}`)
    const rewarmed = words.some(word => topics.has(word))
    const stage: RecallStage = rewarmed ? 'fresh' : recallStage(ageDays, input.retention)
    return { index, ageDays, player, npc, location: text(exchange.location, 80), stage, rewarmed, words }
  })
  const rewarmedIndices = scored.filter(entry => entry.rewarmed).map(entry => entry.index)
  const lines: RecallLine[] = []
  const when = (ageDays: number) => ageDays < 1 ? 'vorhin' : ageDays < 2 ? 'gestern' : ageDays < 8 ? 'vor ein paar Tagen' : ageDays < 35 ? 'vor ein paar Wochen' : 'vor längerer Zeit'
  // Frisch und aufgewärmt: wörtlich. Die jüngsten zuerst, damit sie beim Kürzen bleiben.
  for (const entry of [...scored].reverse()) {
    if (entry.stage !== 'fresh' || lines.length >= maxLines) continue
    const where = entry.location ? ` (${entry.location})` : ''
    const prefix = entry.rewarmed && entry.ageDays > 3 ? `[du erinnerst dich wieder genau, ${when(entry.ageDays)}${where}]` : `[${when(entry.ageDays)}${where}]`
    if (entry.player) lines.push({ stage: 'fresh', index: entry.index, text: `${prefix} Der Spieler sagte: ${entry.player}` })
    if (entry.npc) lines.push({ stage: 'fresh', index: entry.index, text: `${prefix} Du antwortetest: ${entry.npc}` })
  }
  // Verblasst: nur der Sinn, als Erinnerung formuliert.
  for (const entry of [...scored].reverse()) {
    if (entry.stage !== 'faded' || lines.length >= maxLines) continue
    const topic = entry.player ? gist(entry.player, 7) : gist(entry.npc, 7)
    if (topic) lines.push({ stage: 'faded', index: entry.index, text: `[verblasst, ${when(entry.ageDays)}] Ihr habt, wenn du dich recht erinnerst, über „${topic}“ gesprochen; Einzelheiten weißt du nicht mehr.` })
  }
  // Schwach: nur noch Themenwörter, gesammelt in einer Zeile.
  const dim = scored.filter(entry => entry.stage === 'dim')
  if (dim.length && lines.length < maxLines) {
    const words = [...new Set(dim.flatMap(entry => entry.words))].slice(0, 6)
    lines.push({ stage: 'dim', index: dim[dim.length - 1].index, text: `[schwach] Ihr habt euch vor längerer Zeit schon einmal unterhalten${words.length ? `, irgendwas mit ${words.join(', ')}` : ''}; mehr ist dir nicht geblieben.` })
  }
  return { lines: lines.slice(0, maxLines), rewarmed: rewarmedIndices }
}

/**
 * Welche Wortwechsel beim Schreiben bleiben: vergessene fallen weg, aufgewärmte
 * bekommen einen frischen Zeitstempel, dann die jüngsten `limit`.
 */
export function pruneExchanges<T extends RecallExchange>(exchanges: T[], input: { now: number; retention: number; rewarmed: number[]; limit: number }): T[] {
  const nowIso = new Date(input.now).toISOString()
  const kept = exchanges.map((exchange, index) => {
    if (input.rewarmed.includes(index)) return { ...exchange, at: nowIso, rewarmed_from: exchange.at ?? null }
    return exchange
  }).filter(exchange => {
    const at = Date.parse(String(exchange.at ?? ''))
    const ageDays = Number.isFinite(at) ? (input.now - at) / DAY_MS : 365
    return recallStage(ageDays, input.retention) !== 'forgotten'
  })
  kept.sort((a, b) => Date.parse(String(a.at ?? '')) - Date.parse(String(b.at ?? '')))
  return kept.slice(-input.limit)
}
