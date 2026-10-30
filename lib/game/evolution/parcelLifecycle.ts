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
  | 'duplicate_event' | 'invalid_receipt' | 'unknown_parcel'
  | 'invalid_transition' | 'building_identity_reused'
export interface ParcelProjection {
  settlementId: string
  year: number
  parcels: ParcelState[]
  transitions: ParcelTransition[]
  rejected: { eventId: string; reason: ParcelRejectionReason }[]
}

function validBaseline(p: ParcelBaseline): boolean {
  return !!p.parcelId?.trim() &&
    (p.surface === 'occupied' || p.surface === 'cleared' || p.surface === 'meadow') &&
    (p.surface === 'occupied' ? !!p.buildingId?.trim() : !p.buildingId)
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
  const receipts = input.receipts
    .filter(r => r.settlementId === settlementId && (!Number.isFinite(r.worldYear) || r.worldYear <= year))
    .sort((a, b) => a.worldYear - b.worldYear || a.sequence - b.sequence || a.id.localeCompare(b.id))
  for (const receipt of receipts) {
    if (seen.has(receipt.id)) {
      rejected.push({ eventId: receipt.id, reason: 'duplicate_event' })
      continue
    }
    seen.add(receipt.id)
    if (!receipt.id?.trim() || !receipt.parcelId?.trim() || !receipt.sourceEventRef?.trim() ||
        receipt.committed !== true || !Number.isInteger(receipt.worldYear) ||
        !Number.isInteger(receipt.sequence) || receipt.sequence < 0 || receipt.worldYear < baselineYear ||
        !receipt.change || !['demolish', 'restore_meadow', 'construct'].includes(receipt.change.action)) {
      rejected.push({ eventId: receipt.id, reason: 'invalid_receipt' })
      continue
    }
    const parcel = parcels.get(receipt.parcelId)
    if (!parcel) {
      rejected.push({ eventId: receipt.id, reason: 'unknown_parcel' })
      continue
    }
    const change = receipt.change
    let next: ParcelState | null = null
    if (change.action === 'demolish') {
      if (parcel.surface === 'occupied' && parcel.buildingId === change.buildingId) {
        next = { parcelId: parcel.parcelId, surface: 'cleared' }
      }
    } else if (change.action === 'restore_meadow') {
      if (parcel.surface === 'cleared') next = { parcelId: parcel.parcelId, surface: 'meadow' }
    } else if (change.action === 'construct') {
      if (!change.buildingId?.trim()) {
        rejected.push({ eventId: receipt.id, reason: 'invalid_receipt' })
        continue
      }
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
    parcels.set(receipt.parcelId, next)
    transitions.push({ eventId: receipt.id, parcelId: receipt.parcelId, year: receipt.worldYear,
      from: parcel.surface, to: next.surface, sourceEventRef: receipt.sourceEventRef })
  }
  return { settlementId, year,
    parcels: [...parcels.values()].sort((a, b) => a.parcelId.localeCompare(b.parcelId)),
    transitions, rejected }
}
