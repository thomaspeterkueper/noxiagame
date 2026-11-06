// app/api/cron/world-news/route.ts
// Erstellt: 06.11.2026 — Regionale Meldungen für Figuren (NOXIA-LIVING-0016, Schritt 1)
// Version:      1.0.0
//
// Holt die freigegebenen Feeds mit Region, speichert nur Titel, Link und einen Satz,
// markiert, was als Traumstoff taugt, und hält den Abrufstatus je Quelle fest.
// Meldungen älter als 14 Tage und Träume älter als 30 Tage werden gelöscht.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { WORLD_AWARENESS_SOURCES } from '@/lib/game/worldAwareness'
import { isDreamMaterial, parseFeed, teaser } from '@/lib/game/worldNewsFeed'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const sources = WORLD_AWARENESS_SOURCES.filter(source => source.ingestEnabled && source.feedUrl && source.region)
  const report: Array<{ source: string; ok: boolean; count: number; error?: string }> = []

  for (const source of sources) {
    const checkedAt = new Date().toISOString()
    try {
      const response = await fetch(source.feedUrl!, {
        headers: { 'user-agent': 'NOXIA World News/1.0 (+https://github.com/thomaspeterkueper/noxiagame)' },
        signal: AbortSignal.timeout(12000),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const items = parseFeed(source.id, await response.text(), 20)
      if (items.length === 0) throw new Error('keine Meldungen im Feed')
      const rows = items.map(item => ({
        id: item.id,
        source_id: source.id,
        region: source.region!,
        title: item.title.slice(0, 240),
        teaser: teaser(item.summary),
        url: item.url,
        published_at: item.publishedAt,
        topics: item.topics,
        dream_ok: isDreamMaterial(item.title, item.summary),
        fetched_at: checkedAt,
      }))
      const { error } = await supabase.from('world_news_items').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      await supabase.from('world_news_source_status').upsert({ source_id: source.id, checked_at: checkedAt, last_ok_at: checkedAt, last_count: rows.length, last_error: null })
      report.push({ source: source.id, ok: true, count: rows.length })
    } catch (error: any) {
      const message = String(error?.message ?? error).slice(0, 200)
      await supabase.from('world_news_source_status').upsert({ source_id: source.id, checked_at: checkedAt, last_count: 0, last_error: message })
      report.push({ source: source.id, ok: false, count: 0, error: message })
    }
  }

  const now = Date.now()
  await supabase.from('world_news_items').delete().lt('published_at', new Date(now - 14 * 86400000).toISOString())
  await supabase.from('npc_dreams').delete().lt('created_at', new Date(now - 30 * 86400000).toISOString())

  return NextResponse.json({ ok: true, sources: report })
}
