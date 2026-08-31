import type { AwarenessTopic, WorldAwarenessItem } from './worldAwareness'

export interface AwarenessConversation {
  item: WorldAwarenessItem
  opener: string
  followUp: string
}

const ROLE_TOPICS: Record<string, AwarenessTopic[]> = {
  science: ['science', 'space', 'climate', 'technology'],
  engineering: ['technology', 'space', 'science', 'climate'],
  operations: ['economy', 'technology', 'society', 'general'],
  habitat: ['society', 'climate', 'general', 'science'],
  general: ['general', 'society', 'science', 'technology', 'space'],
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function interestsForRole(role: string) {
  const value = role.toLowerCase()
  if (/research|science|lab|fors|akadem|scient/.test(value)) return ROLE_TOPICS.science
  if (/engineer|tech|mine|drill|water|solar|wart|bau/.test(value)) return ROLE_TOPICS.engineering
  if (/log|trade|admin|oper|pilot|transport/.test(value)) return ROLE_TOPICS.operations
  if (/home|habitat|care|social|resident/.test(value)) return ROLE_TOPICS.habitat
  return ROLE_TOPICS.general
}

function score(item: WorldAwarenessItem, interests: AwarenessTopic[]) {
  return item.topics.reduce((total, topic) => total + (interests.includes(topic) ? 3 : topic === 'general' ? 1 : 0), 0)
}

export function awarenessConversationForResident(
  residentId: string,
  role: string,
  items: WorldAwarenessItem[],
  dayKey: string,
): AwarenessConversation | null {
  if (!items.length) return null
  const interests = interestsForRole(role)
  const ranked = items.map(item => ({ item, score: score(item, interests) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  const top = ranked[0]?.score ?? 0
  const pool = ranked.filter(entry => entry.score >= Math.max(1, top - 1)).slice(0, 8)
  if (!pool.length) return null

  const item = pool[hash(`${residentId}:${dayKey}:awareness`) % pool.length].item
  const topic = item.topics.find(value => interests.includes(value)) ?? item.topics[0] ?? 'general'
  const followUps: Record<AwarenessTopic, string> = {
    space: 'Was davon könnte für unsere nächste Ausbaustufe relevant werden?',
    science: 'Welche Beobachtung oder welches Experiment könnte das hier prüfen?',
    technology: 'Könnte man daraus unter unseren Bedingungen eine brauchbare Technik machen?',
    climate: 'Wie würde sich dieselbe Entwicklung in einem geschlossenen Koloniesystem auswirken?',
    economy: 'Welche Ressourcen oder Lieferketten könnten dadurch wichtiger werden?',
    society: 'Wie würde eine kleine Gemeinschaft wie unsere darauf reagieren?',
    general: 'Mal sehen, welche Folgen daraus in den nächsten Tagen entstehen.',
  }

  return {
    item,
    opener: `Heute ist diese Meldung im Umlauf: ${item.title}`,
    followUp: followUps[topic],
  }
}
