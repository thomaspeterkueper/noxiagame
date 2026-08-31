export type AwarenessTopic = 'general' | 'science' | 'technology' | 'climate' | 'economy' | 'society' | 'space'

export interface WorldAwarenessSource {
  id: string
  name: string
  kind: 'journalism' | 'institution'
  trustTier: 1 | 2
  topics: AwarenessTopic[]
  feedUrl?: string
  homepage: string
  usageNote?: string
}

/**
 * Source policy for real-world topics used by NOXIA residents.
 *
 * Facts must originate from a configured source. NPC dialogue may interpret
 * those facts, but must never invent an event or present an NPC opinion as a
 * sourced statement. The original source, publication time and URL must stay
 * attached to every imported awareness item.
 */
export const WORLD_AWARENESS_SOURCES: WorldAwarenessSource[] = [
  {
    id: 'deutschlandfunk-news',
    name: 'Deutschlandfunk',
    kind: 'journalism',
    trustTier: 1,
    topics: ['general', 'economy', 'society'],
    feedUrl: 'https://www.deutschlandfunk.de/nachrichten-100.rss',
    homepage: 'https://www.deutschlandfunk.de/',
  },
  {
    id: 'deutschlandfunk-wissen',
    name: 'Deutschlandfunk Wissen',
    kind: 'journalism',
    trustTier: 1,
    topics: ['science', 'technology', 'climate', 'space'],
    feedUrl: 'https://www.deutschlandfunk.de/wissen-106.rss',
    homepage: 'https://www.deutschlandfunk.de/wissen-106.html',
  },
  {
    id: 'tagesschau',
    name: 'tagesschau.de',
    kind: 'journalism',
    trustTier: 1,
    topics: ['general', 'economy', 'society', 'science', 'technology', 'climate'],
    homepage: 'https://www.tagesschau.de/',
    usageNote: 'RSS publication/reuse is licence-dependent. Do not ingest into production until the intended NOXIA use is cleared.',
  },
]

export interface WorldAwarenessItem {
  id: string
  sourceId: string
  title: string
  summary: string
  url: string
  publishedAt: string
  topics: AwarenessTopic[]
  kind: 'real-world' | 'colony'
}

export function sourceForAwarenessItem(item: WorldAwarenessItem) {
  return WORLD_AWARENESS_SOURCES.find(source => source.id === item.sourceId) ?? null
}
