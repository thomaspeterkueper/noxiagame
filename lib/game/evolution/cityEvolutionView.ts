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
 if (input.fromYear > input.toYear) throw Error('City time must advance')
 const relevant = input.authoritativeReceipts.filter(r=>r.settlementId===input.settlementId)
 const adapted = adaptCommittedWorldEvents(relevant)
 const before = cityAtYear({settlementId:input.settlementId,year:input.fromYear,baseline:input.importedBaseline,events:adapted.events})
 const after = cityAtYear({settlementId:input.settlementId,year:input.toYear,baseline:input.importedBaseline,events:adapted.events})
 return {before,after,changes:compareCityYears(before,after),rejectedReceipts:adapted.rejected}
}
