/** Private, read-only discovery of a player's own unreviewed conversation hints.
 * Not a public council feed; never treat client-supplied place names as authority.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { projectPlayerConversationSignals } from '@/lib/game/civic/playerConversationSignals'

const PRIVATE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: PRIVATE })
  const requested = Number(req.nextUrl.searchParams.get('limit') ?? 20)
  const limit = Number.isSafeInteger(requested) ? Math.max(1, Math.min(20, requested)) : 20
  const { data, error } = await createServiceClient()
    .from('npc_conversation_log')
    .select('id, created_at, wish_kind, wish_object, wish_npc_denied, location_name, opening, outcome')
    .eq('player_profile_id', profileId)
    .eq('opening', false)
    .in('outcome', ['reply', 'repeat_hint'])
    .not('wish_kind', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('civic-signals read failed', { code: error.code })
    return NextResponse.json({ error: 'signals_unavailable' }, { status: 503, headers: PRIVATE })
  }
  return NextResponse.json({
    signals: projectPlayerConversationSignals(data ?? [], limit),
    scope: 'own_conversations',
    authority: 'none',
    note: 'Ungeprüfte Hinweise aus eigenen Gesprächen, keine Anträge oder Beschlüsse.',
  }, { headers: PRIVATE })
}
