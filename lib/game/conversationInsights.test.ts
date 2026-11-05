import { describe, expect, it } from 'vitest'
import { buildConversationInsights, clipExcerpt, type InsightRow } from './conversationInsights'

const row = (player: number, extra: Partial<InsightRow> = {}): InsightRow => ({
  player_profile_id: 'p' + player,
  created_at: '2026-11-05T10:00:00Z',
  topic: 'arbeit',
  outcome: 'reply',
  npc_name: 'Mara',
  ...extra,
})

describe('buildConversationInsights', () => {
  it('blendet Zellen mit weniger als fünf Spielern aus', () => {
    const rows = [1, 2, 3, 4].map(p => row(p))
    const insights = buildConversationInsights(rows)
    expect(insights.byTopic.cells).toEqual([])
    expect(insights.byTopic.hidden).toBe(1)
    expect(insights.totals.players).toBeNull()
  })

  it('zeigt Zellen ab fünf Spielern mit Anteilen', () => {
    const rows = [1, 2, 3, 4, 5].map(p => row(p, { outcome: p === 1 ? 'breakoff' : 'reply' }))
    const insights = buildConversationInsights(rows)
    expect(insights.byTopic.cells).toEqual([{ key: 'arbeit', turns: 5, players: 5, endedShare: 0.2, errorShare: 0 }])
    expect(insights.totals.players).toBe(5)
  })

  it('zählt viele Wortmeldungen eines Spielers nicht als Gruppe', () => {
    const rows = Array.from({ length: 20 }, () => row(1))
    expect(buildConversationInsights(rows).byNpc.cells).toEqual([])
  })

  it('enthält weder Wortlaut noch Spieler-IDs', () => {
    const rows = [1, 2, 3, 4, 5].map(p => ({ ...row(p), player_text: 'geheim' } as InsightRow))
    const json = JSON.stringify(buildConversationInsights(rows))
    expect(json).not.toContain('geheim')
    expect(json).not.toMatch(/"p[1-5]"/)
  })
})

describe('clipExcerpt', () => {
  it('kürzt Länge und Anzahl und entfernt leere Zeilen', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ speaker: 'Du', text: i === 19 ? '' : 'x'.repeat(700), at: 't' }))
    const out = clipExcerpt(lines)
    expect(out.length).toBe(15)
    expect(out[0].text.length).toBe(600)
  })
})
