import { NextResponse } from 'next/server'
import {
  WORLD_AWARENESS_SOURCES,
  type AwarenessTopic,
  type WorldAwarenessItem,
} from '@/lib/game/worldAwareness'

export const revalidate = 1800

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function xmlValue(block: string, tags: string[]) {
  for (const tag of tags) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
    if (match?.[1]) return decode(match[1])
  }
  return ''
}

function linkValue(block: string) {
  const direct = xmlValue(block, ['link'])
  if (direct.startsWith('http')) return direct
  const atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)
  return atom?.[1] ?? direct
}

function inferTopics(text: string, fallback: AwarenessTopic[]): AwarenessTopic[] {
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

function parseFeed(sourceId: string, xml: string): WorldAwarenessItem[] {
  const source = WORLD_AWARENESS_SOURCES.find(entry => entry.id === sourceId)
  if (!source) return []
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []
  return blocks.slice(0, 8).map((block, index) => {
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

export async function GET() {
  const sources = WORLD_AWARENESS_SOURCES.filter(source => source.ingestEnabled && source.feedUrl)
  const results = await Promise.allSettled(sources.map(async source => {
    const response = await fetch(source.feedUrl!, {
      headers: { 'user-agent': 'NOXIA World Awareness/1.0 (+https://github.com/thomaspeterkueper/noxiagame)' },
      next: { revalidate: 1800 },
    })
    if (!response.ok) throw new Error(`${source.id}: ${response.status}`)
    return parseFeed(source.id, await response.text())
  }))

  const items = results
    .flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 24)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    items,
    sources: sources.map(({ id, name, kind, homepage, language }) => ({ id, name, kind, homepage, language })),
  })
}
