/**
 * Read-only projection of Core-committed land-parcel transitions.
 *
 * A demolition does not create a meadow. Restoration is a separate, committed
 * world action. This module cannot approve actions, modify ownership, charge
 * resources, persist events or authorize a client-supplied `committed` flag.
 * Callers MUST read and authenticate receipts from the authoritative Core store.
 */
export type ParcelSurface = 'occupied' | 'cleared' | 'meadow'
export interface ParcelBaseline {
  parcelId: string
  surface: ParcelSurface
  buildingId?: string
}
export interface ParcelState extends ParcelBaseline {}
export type ParcelChange =
  | { action: 'demolish'; buildingId: string }
  | { action: 'restore_meadow' }
  | { action: 'construct'; buildingId: string }
export interface CoreParcelReceipt {
  id: string
  settlementId: string
  parcelId: string
  worldYear: number
  sequence: number
  sourceEventRef: string
  committed: true
  change: ParcelChange
}
export interface ParcelTransition {
  eventId: string
  parcelId: string
  year: number
  from: ParcelSurface
  to: ParcelSurface
  sourceEventRef: string
}
export type ParcelRejectionReason =
  | 'duplicate_event' | 'duplicate_source_event' | 'invalid_receipt' | 'unknown_parcel'
  | 'invalid_transition' | 'building_identity_reused' | 'conflicting_event'
  | 'conflicting_source_event'
export interface ParcelProjection {
  settlementId: string
  year: number
  parcels: ParcelState[]
  transitions: ParcelTransition[]
  rejected: { eventId: string; reason: ParcelRejectionReason }[]
}

function validBaseline(value: unknown, settlementId: string, baselineYear: number): value is ParcelBaseline {
  // Even authoritative snapshots may contain malformed historical JSON.
  // Fail closed with a domain error rather than dereferencing null or
  // accepting a falsy non-string building ID on an unoccupied parcel.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as Record<string, unknown>
  if (typeof p.parcelId !== 'string' || !p.parcelId.trim()) return false
  // A Core snapshot may carry its settlement ID as additional metadata.
  // Never publish another settlement's parcels because of a mis-scoped read.
  // Legacy baselines without this optional field remain supported.
  if (p.settlementId !== undefined && p.settlementId !== settlementId) return false
  // An explicitly versioned Core baseline must match the requested replay
  // anchor. Otherwise stale snapshots could be combined with newer events.
  // Legacy snapshots without baselineYear remain supported.
  if (p.baselineYear !== undefined && p.baselineYear !== baselineYear) return false
  if (p.surface === 'occupied') {
    return typeof p.buildingId === 'string' && !!p.buildingId.trim()
  }
  if (p.surface === 'cleared' || p.surface === 'meadow') {
    return p.buildingId === undefined
  }
  return false
}

/** A stable parcel is not the building occupying it; both have distinct IDs. */
export function projectParcelLifecycle(input: {
  settlementId: string
  baselineYear: number
  year: number
  baseline: readonly ParcelBaseline[]
  receipts: readonly CoreParcelReceipt[]
}): ParcelProjection {
  // A failed/partial Core read must never be mistaken for an empty history.
  // Validate the read-model envelope before trusting the baseline or receipts.
  if (!input || typeof input !== 'object' || !Array.isArray(input.baseline) ||
      !Array.isArray(input.receipts)) {
    throw new Error('Invalid parcel replay input')
  }
  const { settlementId, baselineYear, year } = input
  if (typeof settlementId !== 'string' || !settlementId.trim() ||
      !Number.isSafeInteger(baselineYear) || !Number.isSafeInteger(year) ||
      year < baselineYear) {
    throw new Error('Invalid settlement or projection interval')
  }
  const parcels = new Map<string, ParcelState>()
  const usedBuildings = new Set<string>()
  for (const parcel of input.baseline) {
    if (!validBaseline(parcel, settlementId, baselineYear) || parcels.has(parcel.parcelId) ||
        (parcel.buildingId && usedBuildings.has(parcel.buildingId))) {
      throw new Error('Invalid or duplicated parcel baseline')
    }
    // A baseline may contain private/operational fields from the Core store.
    // Publish only the explicit parcel read-model contract; never spread raw JSON.
    parcels.set(parcel.parcelId, {
      parcelId: parcel.parcelId,
      surface: parcel.surface,
      ...(parcel.surface === 'occupied' ? { buildingId: parcel.buildingId } : {}),
    })
    if (parcel.buildingId) usedBuildings.add(parcel.buildingId)
  }
  const transitions: ParcelTransition[] = []
  const rejected: ParcelProjection['rejected'] = []
  const seen = new Set<string>()
  // One persisted Core event may affect several parcels, but must not advance
  // the same parcel twice (e.g. demolition and meadow from one approval).
  const appliedSourceEvents = new Map<string, Set<string>>()
  // A persisted Core reader can still return malformed historical JSON.
  // Filter and sort defensively BEFORE dereferencing fields; invalid rows must
  // be reported, not crash the entire Seelenberg/Brombach city projection.
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {}
  const order = (value: unknown) => {
    const r = record(value)
    return {
      year: typeof r.worldYear === 'number' && Number.isFinite(r.worldYear) ? r.worldYear : Number.MAX_SAFE_INTEGER,
      sequence: typeof r.sequence === 'number' && Number.isInteger(r.sequence) ? r.sequence : Number.MAX_SAFE_INTEGER,
      id: typeof r.id === 'string' ? r.id : '',
    }
  }
  // Code-unit ordering is independent of the host ICU locale. Historical
  // replay must not change when server or runtime locale settings change.
  const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
  // Two corrupt receipts may share the same ID, year and sequence but differ
  // in their domain payload. Never let their input order decide which one is
  // replayed. This is a deterministic tie-break, NOT proof of Core authority.
  const payloadKey = (value: unknown) => {
    const r = record(value)
    const change = record(r.change)
    return JSON.stringify([
      typeof r.settlementId === 'string' ? r.settlementId : '',
      typeof r.parcelId === 'string' ? r.parcelId : '',
      typeof r.sourceEventRef === 'string' ? r.sourceEventRef : '',
      r.committed === true ? '1' : '0',
      typeof change.action === 'string' ? change.action : '',
      typeof change.buildingId === 'string' ? change.buildingId : '',
    ])
  }
  // Only structurally valid, in-scope receipts may participate in a collision
  // check. Corrupt rows must not suppress a valid Core receipt with the same ID.
  const validReceiptShape = (r: Record<string, unknown>): boolean => {
    const change = record(r.change)
    return typeof r.id === 'string' && !!r.id.trim() &&
      typeof r.parcelId === 'string' && !!r.parcelId.trim() &&
      typeof r.sourceEventRef === 'string' && !!r.sourceEventRef.trim() &&
      r.settlementId === settlementId && r.committed === true &&
      Number.isSafeInteger(r.worldYear) && Number.isSafeInteger(r.sequence) &&
      (r.sequence as number) >= 0 && (r.worldYear as number) >= baselineYear &&
      ['demolish', 'restore_meadow', 'construct'].includes(change.action as string) &&
      (change.action === 'restore_meadow'
        ? change.buildingId === undefined
        : (typeof change.buildingId === 'string' && !!change.buildingId.trim()))
  }
  const receipts = (input.receipts as readonly unknown[])
    .filter(candidate => {
      const r = record(candidate)
      // Foreign, well-identified settlements are intentionally out of scope.
      if (typeof r.settlementId === 'string' && r.settlementId.trim() &&
          r.settlementId !== settlementId) return false
      // Defer only structurally valid future receipts. A future-dated row
      // with an invalid sequence, change, identity or committed marker is
      // malformed NOW and must be diagnosed, not silently hidden by its year.
      // This is validation only; it does not authenticate Core provenance.
      return !validReceiptShape(r) || (r.worldYear as number) <= year
    })
    .sort((a, b) => {
      const left = order(a), right = order(b)
      return left.year - right.year || left.sequence - right.sequence ||
        compareIds(left.id, right.id) || compareIds(payloadKey(a), payloadKey(b))
    })
  // Receipt IDs are unique throughout the projected settlement history,
  // not just at a single (year, sequence) instant. Reusing an ID with a
  // different instant or payload is ambiguous: quarantine every valid claimant.
  // This is an integrity guard, NOT authentication of the Core event store.
  const signatures = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const candidate of receipts) {
    const r = record(candidate)
    if (!validReceiptShape(r)) continue
    const key = r.id as string
    const signature = JSON.stringify([r.worldYear, r.sequence, payloadKey(candidate)])
    const previous = signatures.get(key)
    if (previous !== undefined && previous !== signature) conflicts.add(key)
    else if (previous === undefined) signatures.set(key, signature)
  }
  // A single Core source must not claim two different events for the same
  // parcel, even at different years/sequences. Otherwise a recycled source
  // reference could silently advance the parcel twice. Multi-parcel events
  // remain valid because the key includes the parcel identity. This is an
  // integrity check only, not proof of Core authority.
  const sourceClaims = new Map<string, string>()
  const sourceConflicts = new Set<string>()
  const sourceKey = (r: Record<string, unknown>) =>
    JSON.stringify([r.parcelId, r.sourceEventRef])
  for (const candidate of receipts) {
    const r = record(candidate)
    if (!validReceiptShape(r)) continue
    const key = sourceKey(r)
    const signature = JSON.stringify([r.worldYear, r.sequence, r.id, payloadKey(candidate)])
    const previous = sourceClaims.get(key)
    if (previous !== undefined && previous !== signature) sourceConflicts.add(key)
    else if (previous === undefined) sourceClaims.set(key, signature)
  }
  // A single Core source event has one logical instant, even when it affects
  // several parcels. Reject all in-scope claims if the same source reference
  // appears with incompatible years or sequences across different parcels.
  // This does not establish that the source reference is authentic.
  const sourceInstants = new Map<string, string>()
  const sourceInstantConflicts = new Set<string>()
  for (const candidate of receipts) {
    const r = record(candidate)
    if (!validReceiptShape(r)) continue
    const key = r.sourceEventRef as string
    const instant = JSON.stringify([r.worldYear, r.sequence])
    const previous = sourceInstants.get(key)
    if (previous !== undefined && previous !== instant) sourceInstantConflicts.add(key)
    else if (previous === undefined) sourceInstants.set(key, instant)
  }
  for (const candidate of receipts) {
    const r = record(candidate)
    const eventId = typeof r.id === 'string' ? r.id : ''
    if (!validReceiptShape(r)) {
      rejected.push({ eventId, reason: 'invalid_receipt' })
      continue
    }
    if (conflicts.has(eventId)) {
      rejected.push({ eventId, reason: 'conflicting_event' })
      continue
    }
    if (sourceConflicts.has(sourceKey(r)) ||
        sourceInstantConflicts.has(r.sourceEventRef as string)) {
      rejected.push({ eventId, reason: 'conflicting_source_event' })
      continue
    }
    // A rejected event cannot reserve an ID or source reference: a corrupt
    // historical row must not hide a valid committed receipt with that key.
    if (seen.has(eventId)) {
      rejected.push({ eventId, reason: 'duplicate_event' })
      continue
    }
    const receipt = r as unknown as CoreParcelReceipt
    const parcel = parcels.get(receipt.parcelId)
    if (!parcel) {
      rejected.push({ eventId: receipt.id, reason: 'unknown_parcel' })
      continue
    }
    if (appliedSourceEvents.get(receipt.parcelId)?.has(receipt.sourceEventRef)) {
      rejected.push({ eventId: receipt.id, reason: 'duplicate_source_event' })
      continue
    }
    const change = receipt.change
    // A historical JSON row can contain a numeric/object buildingId despite
    // the TypeScript union. Validate before any .trim() or state transition.
    if ((change.action === 'demolish' || change.action === 'construct') &&
        (typeof change.buildingId !== 'string' || !change.buildingId.trim())) {
      rejected.push({ eventId: receipt.id, reason: 'invalid_receipt' })
      continue
    }
    let next: ParcelState | null = null
    if (change.action === 'demolish') {
      if (parcel.surface === 'occupied' && parcel.buildingId === change.buildingId) {
        next = { parcelId: parcel.parcelId, surface: 'cleared' }
      }
    } else if (change.action === 'restore_meadow') {
      if (parcel.surface === 'cleared') next = { parcelId: parcel.parcelId, surface: 'meadow' }
    } else if (change.action === 'construct') {
      if (usedBuildings.has(change.buildingId)) {
        rejected.push({ eventId: receipt.id, reason: 'building_identity_reused' })
        continue
      }
      if (parcel.surface !== 'occupied') {
        next = { parcelId: parcel.parcelId, surface: 'occupied', buildingId: change.buildingId }
        usedBuildings.add(change.buildingId)
      }
    }
    if (!next) {
      rejected.push({ eventId: receipt.id, reason: 'invalid_transition' })
      continue
    }
    seen.add(eventId)
    const refs = appliedSourceEvents.get(receipt.parcelId) ?? new Set<string>()
    refs.add(receipt.sourceEventRef)
    appliedSourceEvents.set(receipt.parcelId, refs)
    parcels.set(receipt.parcelId, next)
    transitions.push({ eventId: receipt.id, parcelId: receipt.parcelId, year: receipt.worldYear,
      from: parcel.surface, to: next.surface, sourceEventRef: receipt.sourceEventRef })
  }
  return { settlementId, year,
    parcels: [...parcels.values()].sort((a, b) => compareIds(a.parcelId, b.parcelId)),
    transitions, rejected }
}
