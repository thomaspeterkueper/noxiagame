// lib/game/evolution/feedbackMask.ts
// Version: 1.0.0
// Aktualisiert: 07.11.2026 – Rückmeldungen sind freie Spielertexte: Kontaktdaten und Selbstauskünfte
// werden vor dem Speichern maskiert (wie im Raum-Chat und in NPC-Gesprächen, Thomas 06.11.2026).
import { maskPersonalData } from '@/lib/game/safety/personalData'
import { validateFeedback, type FeedbackDraft } from './playerFeedback'

/**
 * Maskiert Titel, Beschreibung und Ortshinweis und prüft das Ergebnis erneut gegen den
 * Eingangsvertrag. Wird ein Text dadurch zu kurz (z. B. nur eine E-Mail-Adresse), gibt es
 * null – der Aufrufer lehnt die Eingabe dann ab, statt Klartext oder Datenbankfehler.
 */
export function maskFeedbackDraft(draft: FeedbackDraft): FeedbackDraft | null {
  const masked = {
    ...draft,
    title: maskPersonalData(draft.title).trim(),
    description: maskPersonalData(draft.description).trim(),
    ...(draft.locationRef ? { locationRef: maskPersonalData(draft.locationRef).trim() } : {}),
  }
  const checked = validateFeedback(masked)
  return checked.valid && checked.normalized ? checked.normalized : null
}
