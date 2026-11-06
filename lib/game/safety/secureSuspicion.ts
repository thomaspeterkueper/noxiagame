// lib/game/safety/secureSuspicion.ts
// NOXIA-SAFETY-0001: Bei Verdacht sichert der Schutzfilter den Ausschnitt in
// conversation_reports (origin 'filter'). Nur diese Kopie wird für Menschen
// lesbar; sie ist damit von der 14-Tage-Löschung des Wortlauts ausgenommen.
// Kein zweiter Bericht für dieselbe Person am selben Ort innerhalb von 30 Minuten.

import type { SupabaseClient } from '@supabase/supabase-js'
import { clipExcerpt, type ExcerptLine } from '../conversationInsights'
import type { RiskAssessment } from './realWorldRisk'

export async function secureSuspicion(db: SupabaseClient, input: {
  subjectProfileId: string
  source: 'npc' | 'room' | 'direct'
  risk: RiskAssessment
  excerpt: ExcerptLine[]
  roomKey?: string | null
  locationName?: string | null
  npcPersonId?: string | null
  npcName?: string | null
}): Promise<boolean> {
  if (input.risk.level !== 'suspect') return false
  let recent = db.from('conversation_reports').select('id', { count: 'exact', head: true })
    .eq('origin', 'filter').eq('subject_profile_id', input.subjectProfileId)
    .gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString())
  recent = input.roomKey ? recent.eq('room_key', input.roomKey) : recent.eq('source', input.source)
  const { count } = await recent
  if ((count ?? 0) > 0) return false
  const { error } = await db.from('conversation_reports').insert({
    origin: 'filter',
    reporter_profile_id: null,
    subject_profile_id: input.subjectProfileId,
    source: input.source,
    reason: 'safety',
    comment: input.risk.reasons.join('; ').slice(0, 500),
    signals: input.risk.signals,
    room_key: input.roomKey ?? null,
    location_name: input.locationName ?? null,
    npc_person_id: input.npcPersonId ?? null,
    npc_name: input.npcName ?? null,
    excerpt: clipExcerpt(input.excerpt, 12),
  })
  if (error) console.error('[safety] suspicion not secured', { code: error.code })
  return !error
}
