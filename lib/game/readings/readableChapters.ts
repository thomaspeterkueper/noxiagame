// lib/game/readings/readableChapters.ts
import type { ReadingMode } from './types'

/** Wie viele Kapitel bei dieser Freigabe lesbar sind (Leseprobe: die ersten n). */
export function readableChapterCount(mode: ReadingMode, total: number, sampleChapters: number) {
  if (mode === 'full') return total
  if (mode === 'sample') return Math.max(0, Math.min(total, sampleChapters))
  return 0
}
