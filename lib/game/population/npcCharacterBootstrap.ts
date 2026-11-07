import { narrativeTraitBaseline, type NarrativeBirthSeed, type NarrativeTraitBaseline } from './npcNarrativeTraits'

/** Pure preparation only: persistence ownership stays in population Core. */
export interface CharacterBootstrapInput extends NarrativeBirthSeed {
  existingTraits?: Readonly<Record<string, unknown>> | null
}
export interface CharacterBootstrapResult {
  personId: string
  disposition: NarrativeTraitBaseline
  initialTraits: Readonly<Record<string, unknown>>
  shouldPersist: boolean
}
export function prepareCharacterBootstrap(input:CharacterBootstrapInput):CharacterBootstrapResult {
  const disposition=narrativeTraitBaseline(input)
  const existing=input.existingTraits
  // Any actual recorded trait payload is authoritative. Never regenerate over it.
  const hasPersisted=!!existing && Object.keys(existing).length>0
  return {
    personId:input.personId,
    disposition,
    initialTraits:hasPersisted ? {...existing} : {...disposition.traits},
    shouldPersist:!hasPersisted,
  }
}

export interface ExperiencedTraitChange {
  key: keyof NarrativeTraitBaseline['traits']
  delta: number
  eventId: string
}
/** Computes a candidate only. Verified Core event, authorization and atomic write are required upstream. */
export function proposeExperiencedTraitChange(
  current:Readonly<Record<string,number>>,
  change:ExperiencedTraitChange,
):Readonly<Record<string,number>> {
  if(!change.eventId.trim() || !Number.isFinite(change.delta) || Math.abs(change.delta)>0.15) throw Error('invalid experience evidence')
  const old=current[change.key]
  if(typeof old!=='number' || !Number.isFinite(old)||old<0||old>1)throw Error('missing valid current trait')
  const newValue=Math.max(0,Math.min(1,old+change.delta))
  return {...current,[change.key]:Math.round(newValue*1000)/1000}
}
