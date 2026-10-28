// lib/knowledge/academyLevel.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Akademie-Stufe passt sich an die letzten Ergebnisse an; Einstiegsquiz nach Fachgebieten (R-17)
// Version:      1.0.0
//
// Rein, ohne DB. Die Stufe (1–6) setzt anfangs das Einstiegsquiz; danach folgt
// sie den Akademie-Aufgaben: Gezählt werden die letzten fünf Ergebnisse auf der
// aktuellen Stufe. Vier richtige → eine Stufe höher, höchstens eins richtig →
// eine Stufe tiefer. Diagnostisch: keine Freischaltungen.

export const ACADEMY_LEVEL_MIN = 1
export const ACADEMY_LEVEL_MAX = 6
export const ACADEMY_WINDOW = 5

/** Neue Stufe aus den jüngsten Ergebnissen auf der aktuellen Stufe (neueste zuerst). */
export function nextAcademyLevel(level: number, recentAtLevel: ReadonlyArray<boolean>): number {
  const current = Math.min(ACADEMY_LEVEL_MAX, Math.max(ACADEMY_LEVEL_MIN, Math.round(level) || ACADEMY_LEVEL_MIN))
  const window = recentAtLevel.slice(0, ACADEMY_WINDOW)
  if (window.length < ACADEMY_WINDOW) return current
  const right = window.filter(Boolean).length
  if (right >= 4) return Math.min(ACADEMY_LEVEL_MAX, current + 1)
  if (right <= 1) return Math.max(ACADEMY_LEVEL_MIN, current - 1)
  return current
}

export interface DomainScore { right: number; total: number }

/** Ergebnis je Fachgebiet aus dem Einstiegsquiz (nicht die einzelnen Antworten). */
export function domainScores(
  questions: ReadonlyArray<{ domain: string; correct: number }>,
  answers: ReadonlyArray<unknown>,
): Record<string, DomainScore> {
  const out: Record<string, DomainScore> = {}
  questions.forEach((q, i) => {
    const key = String(q.domain ?? '').trim() || 'Allgemein'
    const entry = out[key] ?? { right: 0, total: 0 }
    entry.total += 1
    if (answers[i] === q.correct) entry.right += 1
    out[key] = entry
  })
  return out
}

/** Schwächstes Fachgebiet (für Anregungen), bei Gleichstand das erste. */
export function weakestDomain(scores: Record<string, DomainScore>): string | null {
  let best: { key: string; ratio: number } | null = null
  for (const [key, s] of Object.entries(scores)) {
    if (s.total <= 0) continue
    const ratio = s.right / s.total
    if (!best || ratio < best.ratio) best = { key, ratio }
  }
  return best && best.ratio < 1 ? best.key : null
}

/** Satz für das Ergebnis des Einstiegsquiz. */
export function quizResultLine(score: number, total: number, level: number): string {
  return `${score} von ${total} richtig – du beginnst in der Akademie auf Stufe ${level}. Die Stufe passt sich später an deine Ergebnisse an.`
}
