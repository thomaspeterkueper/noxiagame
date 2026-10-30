import { cityAtYear, compareCityYears, type CityAsset, type CitySnapshot, type CityDiff } from './cityChronicle'
import { adaptCommittedWorldEvents, type CommittedWorldReceipt } from './committedEventAdapter'

export interface CityEvolutionView {
 before: CitySnapshot
 after: CitySnapshot
 changes: CityDiff
 rejectedReceipts: { eventId: string; reason: string }[]
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
     !Array.isArray(input.importedBaseline) || !Array.isArray(input.authoritativeReceipts)) {
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
