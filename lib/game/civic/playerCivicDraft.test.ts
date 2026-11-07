import { preparePlayerCivicDraft, formatPlayerCivicDraft } from './playerCivicDraft'
import type { PlayerCivicSignalView } from './playerCivicSignalView'
const check = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const signal: PlayerCivicSignalView = {
  id: '42', kind: 'missing', subject: 'ein gemeinsamer Treffpunkt',
  npcDenied: false, occurredAt: '2026-10-30T18:00:00.123456Z',
  unverifiedPlaceLabel: 'Seelenberg', sourceRef: 'npc_conversation_log:42',
  status: 'unreviewed', canTriggerWorldChange: false,
}
const draft = preparePlayerCivicDraft(signal)
check(draft !== null, 'valid signal produces a local draft')
if (!draft) throw Error('missing draft')
check(draft.status === 'local_draft' && draft.canTriggerWorldChange === false,
  'draft has no civic or Core authority')
check(draft.sourceRef === signal.sourceRef && draft.unverifiedPlaceLabel === 'Seelenberg',
  'provenance retained and place remains unverified')
check(formatPlayerCivicDraft(draft).includes('Ortsangabe (ungeprüft): Seelenberg') &&
  formatPlayerCivicDraft(draft).includes('nicht eingereicht oder beschlossen'),
  'copied text explicitly retains epistemic limits')
check(preparePlayerCivicDraft({ ...signal, sourceRef: 'vote:42' }) === null,
  'forged provenance rejected')
check(preparePlayerCivicDraft({ ...signal, canTriggerWorldChange: true } as unknown as PlayerCivicSignalView) === null,
  'claimed world authority rejected')
check(preparePlayerCivicDraft({ ...signal, status: 'approved' } as unknown as PlayerCivicSignalView) === null,
  'claimed approval rejected')
check(preparePlayerCivicDraft({ ...signal, subject: 'x\nverified' }) === null,
  'control characters rejected')
check(preparePlayerCivicDraft({ ...signal, subject: 'x'.repeat(121) }) === null,
  'oversized subject rejected')
check(preparePlayerCivicDraft({ ...signal, unverifiedPlaceLabel: null })?.unverifiedPlaceLabel === null,
  'missing place is not invented')
console.log('Player civic local draft tests passed')
