// Admin-only evidence summary. No player dialogue, review findings or NPC private traits.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { buildNpcInsightOverview } from '@/lib/game/administration/npcInsightOverview'

export async function GET(req: NextRequest) {
  const userId = await verifiedBearerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const db = createServiceClient()
  const { data: admin, error: adminError } = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id', userId).maybeSingle()
  if (adminError || !admin) return NextResponse.json({ error: 'Kein Adminzugang' }, { status: 403 })

  const now = new Date()
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [conversations, wishSignals, deniedWishSignals, conversationMemories, socialEvents, insightCandidates, reviews, wishKindRows] = await Promise.all([
    db.from('npc_conversation_log').select('id', { head: true, count: 'exact' }).gte('created_at', since),
    db.from('npc_conversation_log').select('id', { head: true, count: 'exact' })
      .gte('created_at', since).not('wish_kind', 'is', null),
    db.from('npc_conversation_log').select('id', { head: true, count: 'exact' })
      .gte('created_at', since).not('wish_kind', 'is', null).eq('wish_npc_denied', true),
    db.from('npc_player_conversation_memory').select('id', { head: true, count: 'exact' }),
    db.from('population_events').select('id', { head: true, count: 'exact' })
      .gte('occurred_at', since).in('event_type', ['social_interaction', 'npc_social_interaction', 'person_conflict', 'person_assistance']),
    db.from('person_insight_candidates').select('id', { head: true, count: 'exact' }),
    db.from('npc_conversation_reviews').select('day,player_turns,players,npcs,npc_encounters')
      .order('day', { ascending: false }).limit(1),
    // Bounded structured metadata only: no free-text wishes, dialogue or player IDs.
    db.from('npc_conversation_log').select('wish_kind,wish_npc_denied')
      .gte('created_at', since).not('wish_kind', 'is', null).limit(201),
  ])
  return NextResponse.json(buildNpcInsightOverview({
    asOf: now.toISOString(), since, conversations, wishSignals, deniedWishSignals, conversationMemories, socialEvents, insightCandidates, reviews, wishKindRows,
  }), { headers: { 'Cache-Control': 'private, no-store' } })
}
