/** Local-only feedback export for a player's deliberate copy action.
 * Not an intake receipt, publication, vote, approval, or Core command.
 */
import { validateFeedback } from './playerFeedback'

export type LocalFeedbackCopy =
  | { ok: false; errors: string[]; status: 'local_only'; canTriggerWorldChange: false }
  | { ok: true; text: string; status: 'local_only'; canTriggerWorldChange: false }

export function prepareLocalFeedbackCopy(input: unknown): LocalFeedbackCopy {
  const checked = validateFeedback(input)
  if (!checked.valid || !checked.normalized) {
    return { ok: false, errors: checked.errors, status: 'local_only', canTriggerWorldChange: false }
  }
  const value = checked.normalized
  return {
    ok: true,
    status: 'local_only',
    canTriggerWorldChange: false,
    text: [
      'NOXIA – privater Feedback-Entwurf (NICHT eingereicht)',
      `Kategorie: ${value.category}`,
      `Ziel: ${value.destination === 'world_initiative' ? 'Initiative in der Spielwelt' : 'Feedback zur Software'}`,
      `Gewünschte Sichtbarkeit (NICHT veröffentlicht): ${value.visibility}`,
      `Titel: ${value.title}`,
      `Beschreibung:\n${value.description}`,
      ...(value.locationRef ? [`Ortsangabe (ungeprüft): ${value.locationRef}`] : []),
      'Status: nur lokal vorbereitet; keine Prüfung, Veröffentlichung oder Weltänderung.',
    ].join('\n\n'),
  }
}
