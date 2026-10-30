import { cityAtYear, compareCityYears, type CityAsset, type CitySnapshot, type CityDiff } from './cityChronicle'
import { adaptCommittedWorldEvents, type CommittedWorldReceipt } from './committedEventAdapter'

export interface CityEvolutionView {
 before: CitySnapshot
 after: CitySnapshot
 changes: CityDiff
 rejectedReceipts: { eventId: string; reason: string }[]
}
/** Reject malformed or ambiguous initial imports before any historical replay.
 * A duplicate ID must not silently overwrite another imported asset.
 * This validates shape only; provenance must be verified by the importing Core.
 */
function validBaseline(assets: readonly CityAsset[]): boolean {
 const ids = new Set<string>()
 for (const candidate of assets as readonly unknown[]) {
   if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false
   const asset = candidate as Record<string, unknown>
   if (typeof asset.id !== 'string' || !asset.id.trim() ||
       typeof asset.name !== 'string' || !asset.name.trim() ||
       typeof asset.districtId !== 'string' || !asset.districtId.trim() ||
       !Number.isInteger(asset.introducedYear) ||
       (asset.kind !== 'building' && asset.kind !== 'infrastructure' &&
        asset.kind !== 'institution' && asset.kind !== 'service')) return false
   if (ids.has(asset.id)) return false
   ids.add(asset.id)
 }
 return true
}

/**
 * Composes a read-only city evolution view from verified upstream domain receipts.
 * Caller must fetch/authenticate those receipts from authoritative Core persistence.
 * Never accepts proposal/discussion as an authoritative state mutation.
 */
export function cityEvolutionView(input:{
 settlementId:string
 fromYear:number
 toYear:number
 importedBaseline:readonly CityAsset[]
 authoritativeReceipts:readonly CommittedWorldReceipt[]
}):CityEvolutionView {
 // Runtime guards matter: callers may deserialize persisted JSON despite TS types.
 if (!input || typeof input !== 'object' ||
     typeof input.settlementId !== 'string' || !input.settlementId.trim() ||
     !Number.isInteger(input.fromYear) || !Number.isInteger(input.toYear) ||
     input.fromYear > input.toYear ||
     !Array.isArray(input.importedBaseline) || !Array.isArray(input.authoritativeReceipts) ||
     !validBaseline(input.importedBaseline)) {
   throw Error('Invalid city evolution input')
 }
 const rejectedMalformed: CityEvolutionView['rejectedReceipts'] = []
 const relevant: CommittedWorldReceipt[] = []
 for (const candidate of input.authoritativeReceipts as readonly unknown[]) {
   if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
     rejectedMalformed.push({eventId: '', reason: 'invalid_receipt'})
     continue
   }
   const receipt = candidate as Partial<CommittedWorldReceipt>
   // Events belonging to another settlement are not part of this view.
   if (typeof receipt.settlementId === 'string' &&
       receipt.settlementId !== input.settlementId) continue
   if (receipt.settlementId !== input.settlementId) {
     rejectedMalformed.push({eventId: typeof receipt.eventId === 'string' ? receipt.eventId : '', reason: 'invalid_receipt'})
     continue
   }
   relevant.push(receipt as CommittedWorldReceipt)
 }
 const adapted = adaptCommittedWorldEvents(relevant)
 const before = cityAtYear({settlementId:input.settlementId,year:input.fromYear,baseline:input.importedBaseline,events:adapted.events})
 const after = cityAtYear({settlementId:input.settlementId,year:input.toYear,baseline:input.importedBaseline,events:adapted.events})
 return {before,after,changes:compareCityYears(before,after),rejectedReceipts:[...rejectedMalformed,...adapted.rejected]}
}
