/**
 * A model action marker is only a proposal. The player must request movement
 * in this turn, or explicitly accept the immediately preceding NPC offer.
 * A visit target must also be grounded in the request or the accepted offer.
 * This is a presentation gate, not authorization to mutate Core state.
 */
export function hasNpcMovementConsent(input: {
  playerText: string
  previousNpcReply?: string | null
  action: 'lead_walk' | 'visit_place'
  targetName?: string | null
}): boolean {
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim()
  const player = normalize(input.playerText)
  const previous = normalize(input.previousNpcReply ?? '')
  if (!player || /\b(nein|nee|nicht|kein|keine|später|spaeter|stopp|stop|vergiss|ohne mich|allein|alleine)\b/i.test(player)) return false

  const directRequest = /\b(zeig(?:e|en)?|führ(?:e|en)?|bring(?:e|en)?|begleit(?:e|en)?|komm mit|gehen wir|lass uns|ich folge dir|ich komme mit)\b/i.test(player)
  const affirmativeText = player.replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim()
  const affirmation = /^(ja|ja bitte|ja gern|ja gerne|ja klar|ja ich komme mit|ja ich folge dir|klar|klar gerne|gern|gerne|ok|okay|los|machen wir|gehen wir|ich folge dir|ich komme mit)$/i.test(affirmativeText)
  const offered = /\b(soll ich|kann ich|ich kann|ich könnte|wir können|wir könnten|möchtest du|willst du|lass uns|ich zeige|ich führe|ich bringe|ich begleite|komm mit|gehen wir)\b/i.test(previous)
    && /\b(weg|gehen|laufen|zeigen|zeige|führen|führe|bringen|bringe|begleiten|begleite|mitnehmen|mitkommen|spaziergang|tour|mitgehen)\b/i.test(previous)
  if (!directRequest && !(affirmation && offered)) return false

  if (input.action === 'visit_place') {
    const target = normalize(input.targetName ?? '')
    if (!target) return false
    // Do not allow the model to substitute an unrelated destination.
    if (!player.includes(target) && !(affirmation && offered && previous.includes(target))) return false
  }
  return true
}
