import { describe, expect, it } from 'vitest'
import { bubbleDurationMs, bubbleText, BUBBLE_MAX_CHARS, queueBubbles, visibleBubbles } from './bubbles'

const line = (id: number, speakerId: string | null, text: string, atMs: number, mine = false) => ({ id, speakerId, mine, text, atMs })

describe('Sprechblasen', () => {
  it('Dauer wächst mit der Länge, aber höchstens 11 Sekunden', () => {
    expect(bubbleDurationMs('Hallo')).toBeLessThan(bubbleDurationMs('Hallo, schön dass ihr alle da seid heute Abend.'))
    expect(bubbleDurationMs('x'.repeat(500))).toBe(11_000)
  })
  it('kürzt lange Sätze an der Wortgrenze mit Auslassung', () => {
    const long = 'Ich glaube, dass wir einander mehr zuhören sollten, gerade wenn wir uns nicht einig sind, und dass das schon ein Anfang wäre für vieles andere.'
    const cut = bubbleText(long)
    expect(cut.length).toBeLessThanOrEqual(BUBBLE_MAX_CHARS + 2)
    expect(cut.endsWith(' …')).toBe(true)
    expect(cut).not.toMatch(/\w … $/)
    expect(bubbleText('Kurz.')).toBe('Kurz.')
  })
  it('reiht Blasen nacheinander ein, nie übereinander', () => {
    const now = 100_000
    const queue = queueBubbles([], [line(1, 'a', 'Guten Abend zusammen.', now - 1000), line(2, 'b', 'Schön, dass du da bist.', now - 500)], now)
    expect(queue).toHaveLength(2)
    expect(queue[1].from).toBe(queue[0].until)
    expect(visibleBubbles(queue, now + 1)).toHaveLength(1)
    expect(visibleBubbles(queue, queue[1].from + 1).map(b => b.speakerId)).toEqual(['b'])
  })
  it('zeigt höchstens zwei Blasen gleichzeitig', () => {
    const bubbles = [{ id: 1, speakerId: 'a', text: 'x', from: 0, until: 100 }, { id: 2, speakerId: 'b', text: 'y', from: 10, until: 100 }, { id: 3, speakerId: 'c', text: 'z', from: 20, until: 100 }]
    expect(visibleBubbles(bubbles, 50).map(b => b.speakerId)).toEqual(['b', 'c'])
  })
  it('Beiträge des Spielers, alte Beiträge und Doppelte bekommen keine Blase', () => {
    const now = 100_000
    const queue = queueBubbles([], [line(1, null, 'ich', now, true), line(2, 'a', 'alt', now - 60_000), line(3, 'a', 'neu', now - 100)], now)
    expect(queue.map(b => b.id)).toEqual([3])
    expect(queueBubbles(queue, [line(3, 'a', 'neu', now - 100)], now + 10)).toHaveLength(1)
  })
  it('entfernt abgelaufene Blasen', () => {
    const queue = queueBubbles([{ id: 1, speakerId: 'a', text: 'x', from: 0, until: 50 }], [], 100)
    expect(queue).toEqual([])
  })
})
