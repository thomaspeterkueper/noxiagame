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

const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Validate runtime JSON before constructing a typed historical event. */
function validChange(value: unknown, year: number): value is CityChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const change = value as Record<string, unknown>
  if (change.action === 'retire') return nonempty(change.assetId)
  if (change.action === 'rename') return nonempty(change.assetId) && nonempty(change.name)
  if (change.action !== 'establish' || !change.asset ||
      typeof change.asset !== 'object' || Array.isArray(change.asset)) return false
  const asset = change.asset as Record<string, unknown>
  return nonempty(asset.id) && nonempty(asset.name) && nonempty(asset.districtId) &&
    Number.isInteger(asset.introducedYear) && asset.introducedYear === year &&
    (asset.kind === 'building' || asset.kind === 'infrastructure' ||
     asset.kind === 'institution' || asset.kind === 'service')
}

function validReceipt(value: unknown): value is CommittedWorldReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as Record<string, unknown>
  return nonempty(r.eventId) && nonempty(r.settlementId) &&
    nonempty(r.domainEventRef) && nonempty(r.actorRef) &&
    Number.isInteger(r.worldYear) && Number.isInteger(r.sequence) &&
    (r.domain === 'buildings' || r.domain === 'infrastructure' ||
     r.domain === 'institutions' || r.domain === 'services') &&
    validChange(r.change, r.worldYear as number) &&
    // An establishing event must originate in the Core domain that owns its asset kind.
    // Retire/rename lack an asset kind in this receipt contract; the verified reader
    // must enforce ownership for those actions against persisted domain state.
    (r.change.action !== 'establish' || r.domain === ({
      building: 'buildings', infrastructure: 'infrastructure',
      institution: 'institutions', service: 'services',
    } as const)[r.change.asset.kind])
}

/** Read-only adapter. Never turns a proposed or failed command into history.
 * Runtime guards protect against malformed persisted JSON, but do NOT authenticate
 * the origin of receipts. Only a server-side verified eventstore reader may call this.
 */
export function adaptCommittedWorldEvents(receipts: readonly CommittedWorldReceipt[]): ChronicleAdaptation {
  const events: CityHistoryEvent[] = []
  const rejected: ChronicleAdaptation['rejected'] = []
  const seen = new Set<string>()
  // One persisted domain event may authorize at most one city-history change.
  // Reject *all* conflicting IDs for the same source, regardless of input order.
  // Count only valid committed receipts: malformed rows must not poison good events.
  const sourceEventIds = new Map<string, Set<string>>()
  // The same settlement/event ID must not carry two different committed payloads.
  // Compare only semantic fields so JSON object key order cannot change identity.
  const eventSignatures = new Map<string, Set<string>>()
  const receiptSignature = (r: CommittedWorldReceipt): string => {
    const c = r.change
    const change = c.action === 'establish'
      ? [c.action, c.asset.id, c.asset.kind, c.asset.name, c.asset.districtId, c.asset.introducedYear]
      : c.action === 'retire' ? [c.action, c.assetId] : [c.action, c.assetId, c.name]
    return JSON.stringify([r.worldYear, r.sequence, r.domain, r.domainEventRef, r.actorRef, change])
  }
  for (const candidate of receipts as readonly unknown[]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
        (candidate as CommittedWorldReceipt).committed !== true ||
        !validReceipt(candidate)) continue
    const r = candidate
    const sourceKey = JSON.stringify([r.settlementId, r.domain, r.domainEventRef])
    const ids = sourceEventIds.get(sourceKey) ?? new Set<string>()
    ids.add(r.eventId)
    sourceEventIds.set(sourceKey, ids)
    const identity = JSON.stringify([r.settlementId, r.eventId])
    const signatures = eventSignatures.get(identity) ?? new Set<string>()
    signatures.add(receiptSignature(r))
    eventSignatures.set(identity, signatures)
  }
  for (const candidate of receipts) {
    // The public TypeScript type does not protect against JSON/DB values at runtime.
    const eventId = candidate && typeof candidate === 'object' &&
      nonempty((candidate as CommittedWorldReceipt).eventId)
      ? (candidate as CommittedWorldReceipt).eventId : ''
    if (!candidate || typeof candidate !== 'object' ||
        (candidate as CommittedWorldReceipt).committed !== true) {
      rejected.push({ eventId, reason: candidate && typeof candidate === 'object' &&
        (candidate as CommittedWorldReceipt).committed === false ? 'not_committed' : 'invalid_receipt' })
      continue
    }
    if (!validReceipt(candidate)) {
      rejected.push({ eventId, reason: 'invalid_receipt' })
      continue
    }
    const r = candidate
    const sourceKey = JSON.stringify([r.settlementId, r.domain, r.domainEventRef])
    if ((sourceEventIds.get(sourceKey)?.size ?? 0) > 1) {
      rejected.push({ eventId: r.eventId, reason: 'ambiguous_domain_ref' })
      continue
    }
    const identity = JSON.stringify([r.settlementId, r.eventId])
    if ((eventSignatures.get(identity)?.size ?? 0) > 1) {
      rejected.push({ eventId: r.eventId, reason: 'ambiguous_event_id' })
      continue
    }
    if (seen.has(identity)) { rejected.push({ eventId: r.eventId, reason: 'duplicate' }); continue }
    seen.add(identity)
    // This is a projection, not a proof that the upstream authority is genuine.
    // Do not retain references to mutable deserialized Core receipts. A caller
    // changing its input after adaptation must not rewrite projected history.
    const change: CityChange = r.change.action === 'establish'
      ? { action: 'establish', asset: { ...r.change.asset } }
      : { ...r.change }
    events.push({
      id: r.eventId, settlementId: r.settlementId, year: r.worldYear, sequence: r.sequence,
      provenanceRefs: [r.domainEventRef, r.actorRef], committed: true, change,
    })
  }
  events.sort((a, b) => a.settlementId.localeCompare(b.settlementId) || a.year - b.year ||
    a.sequence - b.sequence || a.id.localeCompare(b.id))
  return { events, rejected }
}
