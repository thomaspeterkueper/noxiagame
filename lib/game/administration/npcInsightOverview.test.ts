import { buildNpcInsightOverview, type NpcInsightOverviewInput } from './npcInsightOverview'

const base = (): NpcInsightOverviewInput => ({
  asOf: '2026-10-30T07:30:00.000Z', since: '2026-10-23T07:30:00.000Z',
  conversations: { count: 83, error: null },
  wishSignals: { count: 11, error: null },
  deniedWishSignals: { count: 3, error: null },
  conversationMemories: { count: 20, error: null },
  socialEvents: { count: 179, error: null },
  insightCandidates: { count: 0, error: null },
  reviews: { data: [{ day: '2026-10-29', player_turns: 6, players: 2, npcs: 3, npc_encounters: 5,
    summary: 'private player text', findings: { secret: 'private player text' } }], error: null },
})
let failed = 0
function check(ok: boolean, label: string) {
  if (!ok) { failed++; console.error('FAIL', label) }
}

{
  const snapshot = buildNpcInsightOverview(base())
  check(snapshot.metrics.insightCandidatesTotal.count === 0 && snapshot.metrics.insightCandidatesTotal.quality === 'recorded', 'zero is measured, not unavailable')
  check(snapshot.metrics.wishSignals7d.count === 11 && snapshot.metrics.deniedWishSignals7d.count === 3, 'conversation wish signals and denials are separate aggregate counts')
  check(snapshot.sources.wishSignals7d === 'npc_conversation_log.wish_kind', 'wish signal provenance is explicit')
  check(snapshot.note.includes('keine Autorisierung'), 'NPC denial never authorises a Core action')
  check(snapshot.latestReview?.playerTurns === 6 && snapshot.reviewQuality === 'recorded', 'safe review counters are included')
  check(!JSON.stringify(snapshot).includes('private player text'), 'private review summary and findings never escape')
  check(snapshot.note.includes('keine verifizierten'), 'evidence is not promoted into a verified insight')
}
{
  const input = base()
  input.conversations = { count: null, error: { message: 'secret database detail' } }
  input.wishSignals = { count: null, error: { message: 'secret wish query detail' } }
  input.deniedWishSignals = { count: -3 }
  input.socialEvents = { count: -1 }
  input.insightCandidates = { count: Number.NaN }
  input.reviews = { data: null, error: { message: 'secret review error' } }
  const snapshot = buildNpcInsightOverview(input)
  check(snapshot.metrics.conversations7d.count === null && snapshot.metrics.conversations7d.quality === 'unavailable', 'query error does not become zero')
  check(snapshot.metrics.wishSignals7d.quality === 'unavailable' && snapshot.metrics.deniedWishSignals7d.quality === 'unavailable', 'wish query failure or invalid counts are not interpreted as zero')
  check(snapshot.metrics.socialEvents7d.count === null && snapshot.metrics.insightCandidatesTotal.count === null, 'invalid counts rejected')
  check(snapshot.latestReview === null && snapshot.reviewQuality === 'unavailable', 'review error not treated as empty')
  check(!JSON.stringify(snapshot).includes('secret'), 'database errors are not exposed')
}
{
  const input = base()
  input.reviews = { data: [], error: null }
  check(buildNpcInsightOverview(input).reviewQuality === 'none', 'no review differs from unavailable')
  input.reviews = { data: [{ day: '2026-10-29', player_turns: -1, players: 1, npcs: 1, npc_encounters: 1 }], error: null }
  check(buildNpcInsightOverview(input).reviewQuality === 'unavailable', 'invalid review counters rejected')
}
{
  const input = base()
  input.wishSignals = { count: 90 }
  let snapshot = buildNpcInsightOverview(input)
  check(snapshot.metrics.wishSignals7d.quality === 'unavailable' && snapshot.metrics.deniedWishSignals7d.quality === 'unavailable', 'wish subset larger than conversations invalidates dependent counts')
  input.wishSignals = { count: 11 }
  input.deniedWishSignals = { count: 12 }
  snapshot = buildNpcInsightOverview(input)
  check(snapshot.metrics.wishSignals7d.count === 11 && snapshot.metrics.deniedWishSignals7d.quality === 'unavailable', 'denied wishes cannot exceed wish signals')
  input.wishSignals = { count: null, error: 'unavailable' }
  input.deniedWishSignals = { count: 3 }
  snapshot = buildNpcInsightOverview(input)
  check(snapshot.metrics.deniedWishSignals7d.quality === 'unavailable', 'dependent metric unavailable when parent query fails')
}
if (failed) throw new Error(`NPC insight overview: ${failed} checks failed`)
console.log('NPC insight overview checks passed')
