import type { CityHistoryEvent, CityChange } from './cityChronicle'

/** Domain event receipt issued only after a successful authoritative Core command.
 * The caller must authenticate and verify this receipt against persisted domain state.
 */
export interface CommittedWorldReceipt {
  eventId: string
  settlementId: string
  worldYear: number
  sequence: number
  domain: 'buildings' | 'infrastructure' | 'institutions' | 'services'
  domainEventRef: string
  actorRef: string
  committed: boolean
  change: CityChange
}
export interface ChronicleAdaptation {
  events: CityHistoryEvent[]
  rejected: { eventId: string; reason: string }[]
}
/** Read-only adapter. Never turns a proposed or failed command into history. */
export function adaptCommittedWorldEvents(receipts: readonly CommittedWorldReceipt[]): ChronicleAdaptation {
  const events: CityHistoryEvent[] = []
  const rejected: ChronicleAdaptation['rejected'] = []
  const seen = new Set<string>()
  for (const r of receipts) {
    if (!r.committed) { rejected.push({ eventId: r.eventId, reason: 'not_committed' }); continue }
    if (!r.eventId || !r.settlementId || !r.domainEventRef || !r.actorRef ||
        !Number.isInteger(r.worldYear) || !Number.isInteger(r.sequence)) {
      rejected.push({ eventId: r.eventId, reason: 'invalid_receipt' }); continue
    }
    const identity = r.settlementId + ':' + r.eventId
    if (seen.has(identity)) { rejected.push({ eventId: r.eventId, reason: 'duplicate' }); continue }
    seen.add(identity)
    // This is a projection, not a proof that the upstream authority is genuine.
    events.push({
      id: r.eventId, settlementId: r.settlementId, year: r.worldYear, sequence: r.sequence,
      provenanceRefs: [r.domainEventRef, r.actorRef], committed: true, change: r.change,
    })
  }
  events.sort((a, b) => a.settlementId.localeCompare(b.settlementId) || a.year - b.year ||
    a.sequence - b.sequence || a.id.localeCompare(b.id))
  return { events, rejected }
}
