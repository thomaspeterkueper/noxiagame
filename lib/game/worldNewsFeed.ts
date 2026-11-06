// lib/game/worldNewsFeed.ts
// Erstellt: 06.11.2026 — RSS/Atom lesen und Meldungen einordnen (aus app/api/game/world-awareness herausgelöst),
//                        Traumtauglichkeit je Meldung (NOXIA-LIVING-0016)
// Version:      1.0.0

import { assessRealWorldRisk } from './safety/realWorldRisk'
import { WORLD_AWARENESS_SOURCES, type AwarenessTopic, type NewsRegion, type WorldAwarenessItem } from './worldAwareness'

export function decodeFeedText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function xmlValue(block: string, tags: string[]) {
  for (const tag of tags) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
    if (match?.[1]) return decodeFeedText(match[1])
  }
  return ''
}

function linkValue(block: string) {
  const direct = xmlValue(block, ['link'])
  if (direct.startsWith('http')) return direct
  const atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)
  return atom?.[1] ?? direct
}

export function inferTopics(text: string, fallback: AwarenessTopic[]): AwarenessTopic[] {
  const value = text.toLowerCase()
  const topics = new Set<AwarenessTopic>()
  const add = (topic: AwarenessTopic, pattern: RegExp) => { if (pattern.test(value)) topics.add(topic) }
  add('space', /space|raumfahrt|mars|moon|mond|orbit|asteroid|satellit|rocket|rakete|nasa|esa|planet|solar system|weltraum/)
  add('science', /science|wissenschaft|research|forschung|study|studie|discovery|entdeckung|experiment|telescope|teleskop/)
  add('technology', /technology|technik|robot|ki\b|ai\b|computer|energy|energie|fusion|battery|batterie|engineering/)
  add('climate', /climate|klima|warming|erwärmung|weather|wetter|emission|ocean|meer|ice|eis/)
  add('economy', /economy|wirtschaft|market|markt|inflation|industry|industrie|trade|handel/)
  add('society', /society|gesellschaft|education|bildung|health|gesundheit|population|bevölkerung/)
  if (topics.size === 0) fallback.forEach(topic => topics.add(topic))
  return [...topics]
}

export function parseFeed(sourceId: string, xml: string, limit = 8): WorldAwarenessItem[] {
  const source = WORLD_AWARENESS_SOURCES.find(entry => entry.id === sourceId)
  if (!source) return []
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []
  return blocks.slice(0, limit).map((block, index) => {
    const title = xmlValue(block, ['title'])
    const summary = xmlValue(block, ['description', 'summary', 'content'])
    const url = linkValue(block)
    const publishedRaw = xmlValue(block, ['pubDate', 'published', 'updated', 'dc:date'])
    const parsed = publishedRaw ? new Date(publishedRaw) : new Date()
    const publishedAt = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
    const idSeed = xmlValue(block, ['guid', 'id']) || url || `${sourceId}:${publishedAt}:${index}`
    return {
      id: `${sourceId}:${Buffer.from(idSeed).toString('base64url').slice(0, 28)}`,
      sourceId,
      title,
      summary: summary.slice(0, 320),
      url,
      publishedAt,
      topics: inferTopics(`${title} ${summary}`, source.topics),
      kind: 'real-world' as const,
    }
  }).filter(item => item.title && item.url)
}

/**
 * Kein Traumstoff: Gewalt, Tod, Unglück, Missbrauch, Suizid, Krieg, Terror – und alles,
 * was der Schutzfilter verdächtig findet. Im Gespräch bleibt die Meldung als belegte
 * Tatsache möglich, wenn der Spieler danach fragt.
 */
const NOT_DREAM_MATERIAL = /\b(tot|tote[nr]?|tod|getötet|stirbt|starb|gestorben|leiche|mord\w*|ermordet|totschlag|anschlag|attentat|terror\w*|krieg\w*|bombe\w*|explosion|schüsse|erschossen|messer\w*|vergewaltig\w*|missbrauch\w*|suizid|selbstmord|unfall\w*|unglück\w*|absturz|abgestürzt|verletzt\w*|opfer|geisel\w*|entführ\w*|kill\w*|killed|dead|death|murder\w*|warfare|attack\w*|shooting|abuse|suicide|crash\w*)\b/iu

export function isDreamMaterial(title: string, summary = ''): boolean {
  const text = `${title} ${summary}`
  if (NOT_DREAM_MATERIAL.test(text)) return false
  return assessRealWorldRisk(text).level === 'none'
}

/** Kurzfassung höchstens ein Satz (Lizenz: nur Anreißer). */
export function teaser(summary: string, max = 220): string {
  const first = summary.split(/(?<=[.!?])\s/)[0] ?? ''
  return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first
}

/** Welche Nachrichtenregionen eine Figur an ihrem Ort hört. */
export function newsRegionsForLocation(locationSlug: string | null | undefined): NewsRegion[] {
  return locationSlug === 'earth' ? ['de-nrw', 'de'] : ['space']
}
