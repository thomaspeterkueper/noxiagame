// NOXIA-LIVING — adaptive person depth.
//
// This is deliberately independent from simulation_tier and person_key.
// A person can stay owned by the general Living Population engine while
// becoming richly represented in UI, conversation and world presence.

export type PersonDepthLevel = 'persistent' | 'situated' | 'developed' | 'focal'

export interface PersonDepthEvidence {
  active: boolean
  hasHome: boolean
  hasWork: boolean
  hasEconomy: boolean
  hasAppearance: boolean
  hasLifeState: boolean
  relationshipCount: number
  memoryCount: number
  skillCount: number
}

export interface PersonDepthAssessment {
  level: PersonDepthLevel
  score: number
  reasons: string[]
}

export function assessPersonDepth(e: PersonDepthEvidence): PersonDepthAssessment {
  let score = e.active ? 1 : 0
  const reasons:string[] = e.active ? ['active simulation'] : []

  const add=(ok:boolean,points:number,reason:string)=>{ if(ok){ score+=points; reasons.push(reason) } }
  add(e.hasHome,1,'stable home')
  add(e.hasWork,1,'stable work')
  add(e.hasEconomy,1,'economic identity')
  add(e.hasAppearance,1,'persistent appearance')
  add(e.hasLifeState,1,'life-course state')
  add(e.skillCount>0,1,'skills')
  add(e.relationshipCount>=3,1,'social network')
  add(e.relationshipCount>=6,1,'dense social network')
  add(e.memoryCount>=20,1,'accumulated memories')
  add(e.memoryCount>=60,1,'substantial lived history')
  add(e.memoryCount>=120,1,'deep lived history')

  const level:PersonDepthLevel =
    score >= 11 ? 'focal'
    : score >= 8 ? 'developed'
    : score >= 5 ? 'situated'
    : 'persistent'

  return { level, score, reasons }
}

/**
 * Whether the person has enough persisted life to justify richer presentation.
 * This never changes decision ownership and must never assign person_key.
 */
export function shouldEnrichPerson(e:PersonDepthEvidence){
  const assessment=assessPersonDepth(e)
  return assessment.level==='developed' || assessment.level==='focal'
}
