/** A local, explicitly player-controlled draft from a private conversation hint.
 * No submission, location verification, civic authority or Core mutation.
 */
import type { PlayerCivicSignalView } from './playerCivicSignalView'

export interface PlayerCivicDraft {
  title: string
  description: string
  sourceRef: string
  unverifiedPlaceLabel: string | null
  status: 'local_draft'
  canTriggerWorldChange: false
}

export function preparePlayerCivicDraft(signal: PlayerCivicSignalView): PlayerCivicDraft | null {
  if (signal.status !== 'unreviewed' || signal.canTriggerWorldChange !== false ||
      !/^[1-9]\d{0,18}$/.test(signal.id) ||
      signal.sourceRef !== `npc_conversation_log:${signal.id}` ||
      typeof signal.subject !== 'string' || signal.subject.length < 3 ||
      signal.subject.length > 120 || /[\u0000-\u001f\u007f]/.test(signal.subject)) return null
  return {
    title: `Prüfanliegen: ${signal.subject}`.slice(0, 120),
    description: `In einem meiner NPC-Gespräche wurde folgender ungeprüfter Hinweis erfasst:\n\n${signal.subject}\n\nIch möchte daraus gegebenenfalls einen Vorschlag entwickeln. Bitte Sachlage, Zuständigkeit, Betroffene und mögliche Gegenpositionen prüfen.`,
    sourceRef: signal.sourceRef,
    // A client-supplied label must never become a verified settlement reference.
    unverifiedPlaceLabel: signal.unverifiedPlaceLabel,
    status: 'local_draft',
    canTriggerWorldChange: false,
  }
}

/** Called only after a player's explicit copy action; never submits automatically. */
export function formatPlayerCivicDraft(draft: PlayerCivicDraft): string {
  return `${draft.title}\n\n${draft.description}\n\nHerkunft (privater Gesprächsbeleg): ${draft.sourceRef}` +
    (draft.unverifiedPlaceLabel ? `\nOrtsangabe (ungeprüft): ${draft.unverifiedPlaceLabel}` : '') +
    '\nStatus: privater Entwurf, nicht eingereicht oder beschlossen.'
}
