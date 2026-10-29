import { assessEncounter, type EncounterAssessment } from './npcSymbolicExperiment'
import type { PersonNeed, PersonRelationship } from '../population/types'
import type { AffectState } from './personAffect'

/** Read-only bridge from authoritative persisted snapshots into the A/B experiment.
 * Does not fetch, store, or infer another NPC's private thoughts.
 */
export interface PersistedEncounterInput {
  npcId: string
  needs: readonly PersonNeed[]
  relationships: readonly PersonRelationship[]
  affect?: AffectState
  observedPersonId: string
  /** Observable distress, not access to the target's hidden affect. */
  observedDistress: number
  /** True only when this NPC has an accessible conflict memory. */
  rememberedConflict: boolean
}
export interface EncounterReview {
  npcId: string
  baseline: EncounterAssessment['baseline']
  symbolic: EncounterAssessment['symbolic']
  diagnostics: { missingAffect: boolean; missingRelationship: boolean; source: 'authoritative-snapshot' }
}
const unit=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0
export function reviewPersistedEncounter(input: PersistedEncounterInput):EncounterReview {
  const relation=input.relationships.find(r=>r.personId===input.npcId&&r.otherPersonId===input.observedPersonId)
  const rest=input.needs.find(n=>n.personId===input.npcId&&n.needCode==='rest')
  const fatigue=rest?1-unit(rest.satisfaction):0
  const trust=relation?unit(relation.trust):.5
  const experiment=assessEncounter({
    npcId:input.npcId,
    fatigue:unit(fatigue + (input.affect?.pain ?? 0)*.15),
    trust,
    observedDistress:unit(input.observedDistress),
    remembersConflict:input.rememberedConflict,
  })
  return {
    npcId:experiment.npcId,
    baseline:experiment.baseline,
    symbolic:experiment.symbolic,
    diagnostics:{missingAffect:!input.affect,missingRelationship:!relation,source:'authoritative-snapshot'},
  }
}
