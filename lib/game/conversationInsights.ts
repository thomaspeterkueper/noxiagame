// lib/game/conversationInsights.ts
// NOXIA-PRIVACY-0004 (05.11.2026): Gespräche werden nur automatisch ausgewertet.
// Admins sehen Kennzahlen, nie Wortlaut und nie einzelne Spieler. Jede Zelle
// braucht mindestens MIN_GROUP verschiedene Spieler, sonst wird sie ausgeblendet.

export const MIN_GROUP = 5
export const RAW_TEXT_RETENTION_DAYS = 14
export const REPORT_RETENTION_DAYS = 90

export type InsightRow = {
  player_profile_id: string
  created_at: string
  npc_person_id?: string | null
  npc_name?: string | null
  location_name?: string | null
  topic?: string | null
  outcome?: string | null
  world_action?: string | null
  wish_kind?: string | null
  opening?: boolean | null
}

export type InsightCell = { key: string; turns: number; players: number; endedShare: number; errorShare: number }
export type InsightGroup = { cells: InsightCell[]; hidden: number }

export type ConversationInsights = {
  minGroup: number
  totals: { turns: number; conversationsStarted: number; players: number | null }
  byTopic: InsightGroup
  byNpc: InsightGroup
  byLocation: InsightGroup
  byOutcome: InsightGroup
  byWorldAction: InsightGroup
  byWish: InsightGroup
  byDay: InsightGroup
}

const ENDED = new Set(['breakoff', 'dismissed'])

function group(rows: InsightRow[], keyOf: (row: InsightRow) => string | null | undefined, minGroup: number): InsightGroup {
  const buckets = new Map<string, { turns: number; players: Set<string>; ended: number; errors: number }>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    const bucket = buckets.get(key) ?? { turns: 0, players: new Set<string>(), ended: 0, errors: 0 }
    bucket.turns++
    bucket.players.add(row.player_profile_id)
    if (row.outcome && ENDED.has(row.outcome)) bucket.ended++
    if (row.outcome === 'error') bucket.errors++
    buckets.set(key, bucket)
  }
  const cells: InsightCell[] = []
  let hidden = 0
  for (const [key, b] of buckets) {
    if (b.players.size < minGroup) { hidden++; continue }
    cells.push({
      key,
      turns: b.turns,
      players: b.players.size,
      endedShare: Math.round((b.ended / b.turns) * 100) / 100,
      errorShare: Math.round((b.errors / b.turns) * 100) / 100,
    })
  }
  cells.sort((a, b) => b.turns - a.turns || a.key.localeCompare(b.key))
  return { cells, hidden }
}

/** Kennzahlen ohne Wortlaut und ohne Spieler-IDs. */
export function buildConversationInsights(rows: InsightRow[], minGroup = MIN_GROUP): ConversationInsights {
  const players = new Set(rows.map(r => r.player_profile_id)).size
  const byDay = group(rows, r => r.created_at?.slice(0, 10), minGroup)
  byDay.cells.sort((a, b) => b.key.localeCompare(a.key))
  return {
    minGroup,
    totals: {
      turns: rows.length,
      conversationsStarted: rows.filter(r => r.opening).length,
      players: players >= minGroup ? players : null,
    },
    byTopic: group(rows, r => r.topic ?? 'unbestimmt', minGroup),
    byNpc: group(rows, r => r.npc_name ?? null, minGroup),
    byLocation: group(rows, r => r.location_name ?? null, minGroup),
    byOutcome: group(rows, r => r.outcome ?? null, minGroup),
    byWorldAction: group(rows, r => r.world_action ?? null, minGroup),
    byWish: group(rows, r => r.wish_kind ?? null, minGroup),
    byDay,
  }
}

export type ExcerptLine = { speaker: string; text: string; at: string }

/** Ausschnitt für eine Meldung: höchstens `max` Zeilen, jede gekürzt. */
export function clipExcerpt(lines: ExcerptLine[], max = 16, chars = 600): ExcerptLine[] {
  return lines.slice(-max).map(line => ({
    speaker: String(line.speaker).slice(0, 60),
    text: String(line.text ?? '').replace(/\s+/g, ' ').trim().slice(0, chars),
    at: line.at,
  })).filter(line => line.text.length > 0)
}
