// lib/game/rounds/bubbles.ts
// Sprechblasen über den Figuren in der Runde (Thomas, 02.11.2026): lesbar bleiben heißt
// – höchstens zwei Blasen gleichzeitig, jede so lange, wie man zum Lesen braucht,
// der Reihe nach statt übereinander, und lange Sätze gekürzt (voller Text steht im Verlauf).
// Rein, getestet.

export interface BubbleLine { id: number; speakerId: string | null; mine: boolean; text: string; atMs: number }
export interface Bubble { id: number; speakerId: string; text: string; from: number; until: number }

export const BUBBLE_MAX_CHARS = 130
export const BUBBLE_MAX_VISIBLE = 2
/** Beiträge, die älter sind, bekommen keine Blase (Verlauf beim Betreten). */
export const BUBBLE_MAX_AGE_MS = 30_000

/** Anzeigedauer: Grundzeit plus Lesezeit, höchstens 11 s. */
export function bubbleDurationMs(text: string): number {
  return Math.min(11_000, 3_500 + text.length * 55)
}

/** Auf Wortgrenze kürzen. */
export function bubbleText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= BUBBLE_MAX_CHARS) return clean
  const cut = clean.slice(0, BUBBLE_MAX_CHARS)
  const space = cut.lastIndexOf(' ')
  return (space > BUBBLE_MAX_CHARS * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '') + ' …'
}

/**
 * Neue Beiträge in die Warteschlange der Blasen einreihen. Jede Blase beginnt, wenn die vorige
 * zu Ende ist (nie zwei Sprecher übereinander), Beiträge des Spielers bekommen keine Blase
 * (er sieht sie im Verlauf), alte Beiträge auch nicht.
 */
export function queueBubbles(existing: readonly Bubble[], lines: readonly BubbleLine[], nowMs: number): Bubble[] {
  const out = existing.filter(bubble => bubble.until > nowMs)
  let free = out.reduce((latest, bubble) => Math.max(latest, bubble.until), nowMs)
  for (const line of lines) {
    if (line.mine || !line.speakerId) continue
    if (nowMs - line.atMs > BUBBLE_MAX_AGE_MS) continue
    if (out.some(bubble => bubble.id === line.id)) continue
    const text = bubbleText(line.text)
    if (!text) continue
    const from = Math.max(nowMs, free)
    const until = from + bubbleDurationMs(text)
    out.push({ id: line.id, speakerId: line.speakerId, text, from, until })
    free = until
  }
  return out
}

/** Was gerade zu sehen ist: laufende Blasen, höchstens BUBBLE_MAX_VISIBLE (die zuletzt begonnenen). */
export function visibleBubbles(bubbles: readonly Bubble[], nowMs: number): Bubble[] {
  return bubbles.filter(bubble => bubble.from <= nowMs && nowMs < bubble.until).sort((a, b) => a.from - b.from).slice(-BUBBLE_MAX_VISIBLE)
}
