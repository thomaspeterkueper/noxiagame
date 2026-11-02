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
  | 'invalid_transition' | 'building_identity_reused'
export interface ParcelProjection {
  settlementId: string
  year: number
  parcels: ParcelState[]
  transitions: ParcelTransition[]
  rejected: { eventId: string; reason: ParcelRejectionReason }[]
}

function validBaseline(value: unknown): value is ParcelBaseline {
  // Even authoritative snapshots may contain malformed historical JSON.
  // Fail closed with a domain error rather than dereferencing null or
  // accepting a falsy non-string building ID on an unoccupied parcel.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as Record<string, unknown>
  if (typeof p.parcelId !== 'string' || !p.parcelId.trim()) return false
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
  const { settlementId, baselineYear, year } = input
  if (!settlementId.trim() || !Number.isInteger(baselineYear) || !Number.isInteger(year) || year < baselineYear) {
    throw new Error('Invalid settlement or projection interval')
  }
  const parcels = new Map<string, ParcelState>()
  const usedBuildings = new Set<string>()
  for (const parcel of input.baseline) {
    if (!validBaseline(parcel) || parcels.has(parcel.parcelId) ||
        (parcel.buildingId && usedBuildings.has(parcel.buildingId))) {
      throw new Error('Invalid or duplicated parcel baseline')
    }
    parcels.set(parcel.parcelId, { ...parcel })
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
  const receipts = (input.receipts as readonly unknown[])
    .filter(candidate => {
      const r = record(candidate)
      // Foreign, well-identified settlements are intentionally out of scope.
      if (typeof r.settlementId === 'string' && r.settlementId.trim() &&
          r.settlementId !== settlementId) return false
      return typeof r.worldYear !== 'number' || !Number.isFinite(r.worldYear) ||
        r.worldYear <= year
    })
    .sort((a, b) => {
      const left = order(a), right = order(b)
      return left.year - right.year || left.sequence - right.sequence || left.id.localeCompare(right.id)
    })
  for (const candidate of receipts) {
    const r = record(candidate)
    const eventId = typeof r.id === 'string' ? r.id : ''
    if (typeof r.id !== 'string' || !r.id.trim() ||
        typeof r.parcelId !== 'string' || !r.parcelId.trim() ||
        typeof r.sourceEventRef !== 'string' || !r.sourceEventRef.trim() ||
        r.settlementId !== settlementId || r.committed !== true ||
        !Number.isInteger(r.worldYear) || !Number.isInteger(r.sequence) ||
        (r.sequence as number) < 0 || (r.worldYear as number) < baselineYear ||
        !r.change || typeof r.change !== 'object' || Array.isArray(r.change) ||
        !['demolish', 'restore_meadow', 'construct'].includes((r.change as Record<string, unknown>).action as string)) {
      rejected.push({ eventId, reason: 'invalid_receipt' })
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
    parcels: [...parcels.values()].sort((a, b) => a.parcelId.localeCompare(b.parcelId)),
    transitions, rejected }
}
