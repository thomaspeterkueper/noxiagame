// lib/knowledge/academyExam.ts
// Erstellt:     29.10.2026
// Aktualisiert: 29.10.2026 — Prüfung serverseitig bewerten, Prämie je Modulstufe
// Version:      1.0.0
//
// Rein, ohne DB. Entschieden (Thomas, 28.10.2026): Nur wer die Prüfung besteht,
// schließt ein Modul ab, bekommt Freischaltungen und eine Prämie in Credits.
// Anschauen allein bringt nichts.

export const EXAM_PASS_SHARE = 0.7
/** Nach so vielen nicht bestandenen Versuchen in EXAM_RETRY_WINDOW_MIN Minuten wird gesperrt. */
export const EXAM_MAX_FAILED_IN_WINDOW = 3
export const EXAM_RETRY_WINDOW_MIN = 30

export type ExamScore = { correct: number; total: number; passed: boolean; needed: number }

/** Bewertet Antworten (Index je Frage) gegen die richtigen Optionen. */
export function scoreExam(correctOptions: number[], answers: Array<number | null | undefined>): ExamScore {
  const total = correctOptions.length
  const needed = Math.ceil(total * EXAM_PASS_SHARE)
  if (total === 0) return { correct: 0, total: 0, passed: false, needed: 0 }
  let correct = 0
  correctOptions.forEach((right, i) => { if (answers[i] === right) correct++ })
  return { correct, total, passed: correct >= needed, needed }
}

/** Liest „0,2,1,-“ aus der Anfrage. Leere oder ungültige Stellen werden null. */
export function parseExamAnswers(raw: string | null | undefined): Array<number | null> | null {
  if (raw == null || raw.trim() === '') return null
  return raw.split(',').map(part => {
    const n = Number(part.trim())
    return part.trim() !== '' && Number.isInteger(n) && n >= 0 && n < 16 ? n : null
  })
}

/** Prämie in Credits je Modulstufe (aus der Kennung, etwa ECO-L1-000003). */
export function examPremiumForModule(moduleId: string): number {
  if (moduleId.includes('-L2-')) return 120
  if (moduleId.includes('-L1-')) return 60
  return 30
}

/** Gesperrt, wenn zu viele Fehlversuche im Zeitfenster liegen. */
export function examRetryBlocked(failedAtMs: number[], nowMs: number): { blocked: boolean; retryInMin: number } {
  const windowMs = EXAM_RETRY_WINDOW_MIN * 60_000
  const recent = failedAtMs.filter(t => nowMs - t < windowMs).sort((a, b) => a - b)
  if (recent.length < EXAM_MAX_FAILED_IN_WINDOW) return { blocked: false, retryInMin: 0 }
  const oldest = recent[recent.length - EXAM_MAX_FAILED_IN_WINDOW]
  return { blocked: true, retryInMin: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 60_000)) }
}
