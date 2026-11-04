// Admin-only evidence summary. No player dialogue, review findings or NPC private traits.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { buildNpcInsightOverview, npcInsightWindow, withinNpcInsightWindow } from '@/lib/game/administration/npcInsightOverview'

export async function GET(req: NextRequest) {
  const userId = await verifiedBearerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const db = createServiceClient()
  const { data: admin, error: adminError } = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id', userId).maybeSingle()
  if (adminError || !admin) return NextResponse.json({ error: 'Kein Adminzugang' }, { status: 403 })

  const window = npcInsightWindow(new Date())
  const { asOf, since } = window
  const [conversations, wishSignals, deniedWishSignals, conversationMemories, socialEvents, insightCandidates, reviews, wishKindRows] = await Promise.all([
    withinNpcInsightWindow(db.from('npc_conversation_log').select('id', { head: true, count: 'exact' }), 'created_at', window),
    withinNpcInsightWindow(db.from('npc_conversation_log').select('id', { head: true, count: 'exact' }), 'created_at', window)
      .not('wish_kind', 'is', null),
    withinNpcInsightWindow(db.from('npc_conversation_log').select('id', { head: true, count: 'exact' }), 'created_at', window)
      .not('wish_kind', 'is', null).eq('wish_npc_denied', true),
    db.from('npc_player_conversation_memory').select('id', { head: true, count: 'exact' }),
    withinNpcInsightWindow(db.from('population_events').select('id', { head: true, count: 'exact' }), 'occurred_at', window)
      .in('event_type', ['social_interaction', 'npc_social_interaction', 'person_conflict', 'person_assistance']),
    db.from('person_insight_candidates').select('id', { head: true, count: 'exact' }),
    db.from('npc_conversation_reviews').select('day,player_turns,players,npcs,npc_encounters')
      .lte('day', asOf.slice(0, 10)).order('day', { ascending: false }).limit(1),
    // Bounded structured metadata; IDs only for server-side deduplication.
    // No free-text wishes, dialogue or player IDs leave the database.
    withinNpcInsightWindow(db.from('npc_conversation_log').select('id,wish_kind,wish_npc_denied'), 'created_at', window)
      .not('wish_kind', 'is', null).limit(201),
  ])
  return NextResponse.json(buildNpcInsightOverview({
    asOf, since, conversations, wishSignals, deniedWishSignals, conversationMemories, socialEvents, insightCandidates, reviews, wishKindRows,
  }), { headers: { 'Cache-Control': 'private, no-store' } })
}
