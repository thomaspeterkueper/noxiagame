import { describe, expect, it } from 'vitest'
import { pruneExchanges, recallLines, recallStage, topicWords } from './conversationRecall'

const DAY = 86_400_000
const now = Date.parse('2026-10-26T20:00:00Z')
const ex = (daysAgo: number, player: string, npc: string) => ({ player, npc, at: new Date(now - daysAgo * DAY).toISOString(), location: 'Bibliothek' })

describe('conversation recall', () => {
  it('fades with age and is held longer by frequent encounters', () => {
    expect(recallStage(1, 0)).toBe('fresh')
    expect(recallStage(10, 0)).toBe('faded')
    expect(recallStage(60, 0)).toBe('dim')
    expect(recallStage(200, 0)).toBe('forgotten')
    expect(recallStage(60, 1)).toBe('faded')
  })

  it('quotes recent talk, paraphrases older talk, and keeps only a trace of old talk', () => {
    const { lines } = recallLines({ now, retention: 0, playerMessage: 'hallo', exchanges: [
      ex(60, 'Kennst du gute Krimis?', 'Der Resonanzhack ist spannend.'),
      ex(10, 'Ich suche etwas über Kosmologie', 'Das wobbelnde Universum passt.'),
      ex(1, 'Hast du heute geöffnet?', 'Bis 18 Uhr.'),
    ] })
    const text = lines.map(line => line.text).join('\n')
    expect(text).toContain('Der Spieler sagte: Hast du heute geöffnet?')
    expect(text).toContain('verblasst')
    expect(text).toContain('Ich suche etwas über Kosmologie')
    expect(text).not.toContain('Das wobbelnde Universum')
    expect(text).toContain('schwach')
    expect(text).toContain('krimis')
  })

  it('rewarms an old exchange when the player raises the topic again', () => {
    const exchanges = [ex(60, 'Kennst du gute Krimis?', 'Der Resonanzhack ist spannend.'), ex(1, 'Hast du geöffnet?', 'Bis 18 Uhr.')]
    const { lines, rewarmed } = recallLines({ now, retention: 0, playerMessage: 'Du hattest mir mal Krimis empfohlen', exchanges })
    expect(rewarmed).toEqual([0])
    expect(lines.map(line => line.text).join('\n')).toContain('erinnerst dich wieder genau')
    expect(lines.map(line => line.text).join('\n')).toContain('Der Resonanzhack ist spannend.')
    const kept = pruneExchanges(exchanges, { now, retention: 0, rewarmed, limit: 6 })
    expect(kept[kept.length - 1].player).toBe('Kennst du gute Krimis?')
    expect(Date.parse(String(kept[kept.length - 1].at))).toBe(now)
  })

  it('drops forgotten exchanges on write and keeps the newest within the limit', () => {
    const kept = pruneExchanges([ex(400, 'alt', 'alt'), ex(5, 'a', 'b'), ex(2, 'c', 'd'), ex(1, 'e', 'f')], { now, retention: 0, rewarmed: [], limit: 2 })
    expect(kept.map(entry => entry.player)).toEqual(['c', 'e'])
    expect(topicWords('Hallo, kennst du gute Krimis über Bibliotheken?')).toEqual(['kennst', 'krimis', 'bibliotheken'])
  })
})
