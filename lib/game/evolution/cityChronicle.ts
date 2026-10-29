/**
 * Living Future Cities — deterministic read-only historical projection.
 *
 * Input events must already have been accepted by their owning Core domains.
 * This module cannot build, demolish, authorize, pay for or persist anything.
 */
export type CityAssetKind = 'building' | 'infrastructure' | 'institution' | 'service'
export interface CityAsset {
  id: string
  kind: CityAssetKind
  name: string
  districtId: string
  introducedYear: number
}
export type CityChange =
  | { action: 'establish'; asset: CityAsset }
  | { action: 'retire'; assetId: string }
  | { action: 'rename'; assetId: string; name: string }
export interface CityHistoryEvent {
  id: string
  settlementId: string
  year: number
  /** Monotonically ordered within one year; ties are resolved by event ID. */
  sequence: number
  provenanceRefs: string[]
  /** Only authoritative domain-committed events may be projected. */
  committed: true
  change: CityChange
}
export interface CitySnapshot {
  settlementId: string
  year: number
  assets: CityAsset[]
  appliedEventIds: string[]
  rejectedEventIds: string[]
}
export interface CityDiff {
  fromYear: number
  toYear: number
  added: CityAsset[]
  removed: CityAsset[]
  renamed: { assetId: string; before: string; after: string }[]
}

function validateEvent(e: CityHistoryEvent, settlementId: string): boolean {
  return e.settlementId === settlementId &&
    e.committed === true &&
    Number.isInteger(e.year) && Number.isInteger(e.sequence) &&
    typeof e.id === 'string' && e.id.trim().length > 0 &&
    Array.isArray(e.provenanceRefs) && e.provenanceRefs.length > 0 &&
    e.provenanceRefs.every(ref => typeof ref === 'string' && ref.trim().length > 0)
}

/** Runtime guard: persisted events can be malformed despite static TypeScript types. */
function validChange(change: unknown): change is CityChange {
  if (!change || typeof change !== 'object') return false
  const value = change as Record<string, unknown>
  if (value.action === 'retire') {
    return typeof value.assetId === 'string' && value.assetId.trim().length > 0
  }
  if (value.action === 'rename') {
    return typeof value.assetId === 'string' && value.assetId.trim().length > 0 &&
      typeof value.name === 'string' && value.name.trim().length > 0
  }
  if (value.action === 'establish') {
    if (!value.asset || typeof value.asset !== 'object') return false
    const asset = value.asset as Record<string, unknown>
    return typeof asset.id === 'string' && asset.id.trim().length > 0 &&
      typeof asset.name === 'string' && asset.name.trim().length > 0 &&
      typeof asset.districtId === 'string' && asset.districtId.trim().length > 0 &&
      Number.isInteger(asset.introducedYear) &&
      (asset.kind === 'building' || asset.kind === 'infrastructure' ||
        asset.kind === 'institution' || asset.kind === 'service')
  }
  return false
}
/** Reconstruct a city at a chosen year without leaking later changes. */
export function cityAtYear(input: {
  settlementId: string
  year: number
  baseline: readonly CityAsset[]
  events: readonly CityHistoryEvent[]
}): CitySnapshot {
  if (!Number.isInteger(input.year)) throw new Error('City history year must be an integer')
  const assets = new Map(input.baseline.filter(a => a.introducedYear <= input.year).map(a => [a.id, { ...a }]))
  const appliedEventIds: string[] = []
  const rejectedEventIds: string[] = []
  const seen = new Set<string>()
  const ordered = input.events.filter(e => e.settlementId === input.settlementId && e.year <= input.year)
    .sort((a, b) => a.year - b.year || a.sequence - b.sequence || a.id.localeCompare(b.id))
  for (const event of ordered) {
    if (seen.has(event.id) || !validateEvent(event, input.settlementId)) {
      rejectedEventIds.push(event.id)
      continue
    }
    seen.add(event.id)
    if (!validChange(event.change)) {
      rejectedEventIds.push(event.id)
      continue
    }
    const change = event.change
    if (change.action === 'establish') {
      if (assets.has(change.asset.id) || change.asset.introducedYear !== event.year) {
        rejectedEventIds.push(event.id); continue
      }
      assets.set(change.asset.id, { ...change.asset })
    } else if (change.action === 'retire') {
      if (!assets.delete(change.assetId)) { rejectedEventIds.push(event.id); continue }
    } else if (change.action === 'rename') {
      const previous = assets.get(change.assetId)
      if (!previous || !change.name.trim()) { rejectedEventIds.push(event.id); continue }
      assets.set(change.assetId, { ...previous, name: change.name })
    }
    appliedEventIds.push(event.id)
  }
  return { settlementId: input.settlementId, year: input.year,
    assets: [...assets.values()].sort((a, b) => a.id.localeCompare(b.id)),
    appliedEventIds, rejectedEventIds }
}
export function compareCityYears(before: CitySnapshot, after: CitySnapshot): CityDiff {
  if (before.settlementId !== after.settlementId || before.year > after.year) {
    throw new Error('Compare ordered snapshots of the same settlement')
  }
  const a = new Map(before.assets.map(x => [x.id, x]))
  const b = new Map(after.assets.map(x => [x.id, x]))
  return { fromYear: before.year, toYear: after.year,
    added: after.assets.filter(x => !a.has(x.id)),
    removed: before.assets.filter(x => !b.has(x.id)),
    renamed: after.assets.filter(x => a.has(x.id) && a.get(x.id)!.name !== x.name)
      .map(x => ({ assetId: x.id, before: a.get(x.id)!.name, after: x.name })) }
}
