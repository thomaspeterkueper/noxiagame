// Read-only, privacy-minimised projection for the NPC observatory (#545).
// Counts describe stored evidence; they never certify an NPC idea or trigger Core actions.

export type CountResult = { count: number | null; error?: unknown }
export type ReviewResult = { data: unknown[] | null; error?: unknown }
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

  return {
    asOf: input.asOf,
    since: input.since,
    metrics: {
      conversations7d: metric(input.conversations),
      wishSignals7d: metric(input.wishSignals),
      deniedWishSignals7d: metric(input.deniedWishSignals),
      memoryPairsTotal: metric(input.conversationMemories),
      socialEvents7d: metric(input.socialEvents),
      insightCandidatesTotal: metric(input.insightCandidates),
    },
    latestReview,
    reviewQuality,
    sources: {
      conversations7d: 'npc_conversation_log',
      wishSignals7d: 'npc_conversation_log.wish_kind',
      deniedWishSignals7d: 'npc_conversation_log.wish_npc_denied',
      memoryPairsTotal: 'npc_player_conversation_memory',
      socialEvents7d: 'population_events',
      insightCandidatesTotal: 'person_insight_candidates',
      latestReview: 'npc_conversation_reviews',
    },
    note: 'Wunsch-/Suchmarkierungen stammen aus protokollierten Gesprächen und sind keine verifizierten Erkenntnisse oder eigenständigen NPC-Ideen. NPC-Ablehnungen sind keine Autorisierung. Ideen bleiben bis zur Prüfung unverbindlich.',
  }
}
