import type { DreamAssociation } from './dreamRecombination'

/** Pure projection only: no database writes or world facts. Feature-off by default. */
export interface DreamRecallRow {
  npc_id: string
  dream_id: string
  motifs: string[]
  source_ids: string[]
  recalled: boolean
  retention: number
  created_tick: number
  canonical: false
}

function unit(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
}
function stableHash01(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

/** Caller must supply sleep-eligible NPC IDs; never projects awake NPCs. */
export function dreamRecallRows(input: {
  enabled?: boolean
  sleepingNpcIds: readonly string[]
  dreams: readonly DreamAssociation[]
  recallByNpc: Readonly<Record<string, number>>
  retentionTicks?: number
}): DreamRecallRow[] {
  if (!input.enabled) return []
  const eligible = new Set(input.sleepingNpcIds)
  const retentionTicks = Math.max(1, Math.floor(input.retentionTicks ?? 144))
  return input.dreams
    .filter(d => eligible.has(d.npcId) && d.canonical === false)
    .map(d => ({
      npc_id: d.npcId,
      dream_id: d.id,
      motifs: [...new Set(d.motifs)].slice(0, 12),
      source_ids: [...new Set([...d.sourceMemoryIds, ...d.sourceTraceIds, ...d.sourcePatternKeys])],
      recalled: stableHash01(d.npcId + ':' + d.id + ':' + d.createdAtTick) < unit(input.recallByNpc[d.npcId] ?? 0),
      retention: retentionTicks,
      created_tick: d.createdAtTick,
      canonical: false as const,
    }))
}

/** Returns bounded interest-weight delta; a non-recalled or expired dream has zero effect. */
export function dreamInterestInfluence(row: DreamRecallRow, atTick: number, motif: string): number {
  if (!row.recalled || !row.motifs.includes(motif) || atTick <= row.created_tick) return 0
  const age = atTick - row.created_tick
  if (age >= row.retention) return 0
  return Math.min(0.1, 0.1 * (1 - age / row.retention))
}
