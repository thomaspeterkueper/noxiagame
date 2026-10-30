// Read-only, privacy-minimised projection for the NPC observatory (#545).
// Counts describe stored evidence; they never certify an NPC idea or trigger Core actions.

export type NpcInsightWindow = { asOf: string; since: string }

// An observation window is closed at a single captured instant: future-dated
// records must not leak into the historical evidence summary.
export function npcInsightWindow(now: Date): NpcInsightWindow {
  const timestamp = now.getTime()
  if (!Number.isFinite(timestamp)) throw new Error('Invalid NPC observation timestamp')
  return {
    asOf: new Date(timestamp).toISOString(),
    since: new Date(timestamp - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export interface WindowFilter<T> {
  gte(column: string, value: string): T
  lte(column: string, value: string): T
}

export function withinNpcInsightWindow<T extends WindowFilter<T>>(
  query: T, column: 'created_at' | 'occurred_at', window: NpcInsightWindow,
): T {
  return query.gte(column, window.since).lte(column, window.asOf)
}

export type CountResult = { count: number | null; error?: unknown }
export type ReviewResult = { data: unknown[] | null; error?: unknown }
export type WishKindResult = { data: unknown[] | null; error?: unknown }
const WISH_KINDS = ['wish', 'seeking', 'how_to', 'missing'] as const
export type EvidenceQuality = 'recorded' | 'unavailable'
export type CountMetric = { count: number | null; quality: EvidenceQuality }

export interface NpcInsightOverviewInput {
  asOf: string
  since: string
  conversations: CountResult
  wishSignals: CountResult
  deniedWishSignals: CountResult
  conversationMemories: CountResult
  socialEvents: CountResult
  insightCandidates: CountResult
  reviews: ReviewResult
  wishKindRows: WishKindResult
}

function metric(result: CountResult): CountMetric {
  if (result.error || !Number.isSafeInteger(result.count) || (result.count ?? -1) < 0) {
    return { count: null, quality: 'unavailable' }
  }
  return { count: result.count, quality: 'recorded' }
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function buildNpcInsightOverview(input: NpcInsightOverviewInput) {
  let reviewQuality: 'recorded' | 'none' | 'unavailable' = 'unavailable'
  let latestReview: {
    day: string
    playerTurns: number
    players: number
    npcs: number
    npcEncounters: number
  } | null = null

  if (!input.reviews.error && Array.isArray(input.reviews.data)) {
    if (input.reviews.data.length === 0) {
      reviewQuality = 'none'
    } else {
      const row = input.reviews.data[0]
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>
        if (typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) &&
          safeNonnegativeInteger(r.player_turns) && safeNonnegativeInteger(r.players) &&
          safeNonnegativeInteger(r.npcs) && safeNonnegativeInteger(r.npc_encounters)) {
          latestReview = {
            day: r.day,
            playerTurns: r.player_turns,
            players: r.players,
            npcs: r.npcs,
            npcEncounters: r.npc_encounters,
          }
          reviewQuality = 'recorded'
        }
      }
    }
  }

  // A subset cannot exceed its parent; never display contradictory counts as evidence.
  const conversations7d = metric(input.conversations)
  const wishSignals7d = metric(input.wishSignals)
  let deniedWishSignals7d = metric(input.deniedWishSignals)
  if (wishSignals7d.count !== null && conversations7d.count !== null && wishSignals7d.count > conversations7d.count) {
    wishSignals7d.count = null
    wishSignals7d.quality = 'unavailable'
  }
  if (deniedWishSignals7d.count !== null && (wishSignals7d.count === null || deniedWishSignals7d.count > wishSignals7d.count)) {
    deniedWishSignals7d = { count: null, quality: 'unavailable' }
  }

  // Read only bounded, whitelisted structured tags. Never forward conversation text,
  // wish_object, player identifiers or row-level records to the admin browser.
  const wishKindBreakdown: {
    quality: EvidenceQuality
    categories: { kind: string; count: number; denied: number }[]
  } = { quality: 'unavailable', categories: [] }
  const rows = input.wishKindRows.data
  if (!input.wishKindRows.error && Array.isArray(rows) &&
      wishSignals7d.count !== null && deniedWishSignals7d.count !== null &&
      wishSignals7d.count <= 200 && rows.length === wishSignals7d.count) {
    const categories = WISH_KINDS.map(kind => ({ kind, count: 0, denied: 0 }))
    // IDs are used only server-side to prevent duplicate evidence from being
    // mistaken for distinct conversations. They never appear in the response.
    const seenIds = new Set<string>()
    let valid = true
    for (const row of rows) {
      if (!row || typeof row !== 'object') { valid = false; break }
      const record = row as Record<string, unknown>
      // PostgREST bigint IDs can be safe JS integers or decimal strings.
      const id = typeof record.id === 'number' && Number.isSafeInteger(record.id) && record.id > 0
        ? String(record.id)
        : typeof record.id === 'string' && /^[1-9][0-9]*$/.test(record.id) ? record.id : null
      const category = categories.find(item => item.kind === record.wish_kind)
      if (!id || seenIds.has(id) || !category ||
          (record.wish_npc_denied !== null && typeof record.wish_npc_denied !== 'boolean')) {
        valid = false
        break
      }
      seenIds.add(id)
      category.count++
      if (record.wish_npc_denied === true) category.denied++
    }
    if (valid && categories.reduce((sum, item) => sum + item.denied, 0) === deniedWishSignals7d.count) {
      wishKindBreakdown.quality = 'recorded'
      wishKindBreakdown.categories = categories
    }
  }

  return {
    asOf: input.asOf,
    since: input.since,
    metrics: {
      conversations7d,
      wishSignals7d,
      deniedWishSignals7d,
      memoryPairsTotal: metric(input.conversationMemories),
      socialEvents7d: metric(input.socialEvents),
      insightCandidatesTotal: metric(input.insightCandidates),
    },
    latestReview,
    reviewQuality,
    wishKindBreakdown,
    sources: {
      conversations7d: 'npc_conversation_log',
      wishSignals7d: 'npc_conversation_log.wish_kind',
      wishKindBreakdown: 'npc_conversation_log.wish_kind + wish_npc_denied',
      deniedWishSignals7d: 'npc_conversation_log.wish_npc_denied',
      memoryPairsTotal: 'npc_player_conversation_memory',
      socialEvents7d: 'population_events',
      insightCandidatesTotal: 'person_insight_candidates',
      latestReview: 'npc_conversation_reviews',
    },
    note: 'Wunsch-/Suchmarkierungen stammen aus protokollierten Gesprächen und sind keine verifizierten Erkenntnisse oder eigenständigen NPC-Ideen. NPC-Ablehnungen sind keine Autorisierung. Ideen bleiben bis zur Prüfung unverbindlich.',
  }
}
