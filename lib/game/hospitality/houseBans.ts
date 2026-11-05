// lib/game/hospitality/houseBans.ts
// Hausverbot prüfen (05.11.2026): Wer eins hat, wird nicht eingelassen, bestellt nichts
// und redet nicht im Raum-Chat dieses Hauses. Für die Routen (Service-Client).

export async function activeBanUntil(supabase: any, tileEntityId: string, profileId: string): Promise<string | null> {
  const { data } = await supabase.from('venue_bans').select('until').eq('tile_entity_id', tileEntityId).eq('profile_id', profileId).eq('lifted', false).gt('until', new Date().toISOString()).order('until', { ascending: false }).limit(1).maybeSingle()
  return data?.until ? String(data.until) : null
}
