/**
 * Evidence-aware internal NPC profile projection.
 * A profile is a view of Core facts, not a second memory or source of truth.
 * Private authoring metadata and symbolic astrology never affect Core decisions.
 */
export type ProfileFactSource = 'core'|'observed'|'self_report'|'inferred'|'author_design'
export type ProfileFactVisibility = 'public'|'npc_private'|'admin_private'|'author_private'
export interface NpcProfileFact<T=unknown> {
  section: string
  value: T
  source: ProfileFactSource
  visibility: ProfileFactVisibility
  recordedTick?: number
  confidence?: number
}
export interface NpcProfileProjection {
  personId: string
  publicFacts: NpcProfileFact[]
  adminFacts: NpcProfileFact[]
  unverified: NpcProfileFact[]
}
export function projectNpcProfile(personId:string,facts:readonly NpcProfileFact[]):NpcProfileProjection {
  if(!personId.trim()) throw Error('personId required')
  const valid=facts.filter(f=>f.section.trim() && f.value!==null && f.value!==undefined
    && (f.recordedTick===undefined || Number.isSafeInteger(f.recordedTick) && f.recordedTick>=0)
    && (f.confidence===undefined || Number.isFinite(f.confidence) && f.confidence>=0 && f.confidence<=1))
  // Only authoritative Core data and directly observed facts qualify as verified.
  const verified=(f:NpcProfileFact)=>f.source==='core'||f.source==='observed'
  // A non-public field must never be promoted to the public projection.
  const publicFacts=valid.filter(f=>f.visibility==='public' && verified(f))
  const adminFacts=valid.filter(f=>f.visibility==='public'||f.visibility==='admin_private').filter(verified)
  const unverified=valid.filter(f=>!verified(f) && f.visibility!=='author_private')
  return {personId,publicFacts,adminFacts,unverified}
}
