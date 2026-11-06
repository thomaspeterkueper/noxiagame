import { NextResponse } from 'next/server'
// Aktualisiert: 06.11.2026 — Feed-Lesen nach lib/game/worldNewsFeed.ts verschoben (auch für den Nachrichten-Cron)
import { WORLD_AWARENESS_SOURCES } from '@/lib/game/worldAwareness'
import { parseFeed } from '@/lib/game/worldNewsFeed'

export const revalidate = 1800

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
