/**
 * Living Population profile coverage — read-only projections of persisted facts.
 * Every NPC has a stable person ID. Missing facts are never invented.
 */
export type ProfileSection = 'identity'|'biography'|'traits'|'needs'|'health'|'relationships'|'memory'|'conversations'|'history'|'physiology'
export interface NpcProfileEvidence {
  personId: string
  name: string
  bio?: string | null
  traits?: Record<string,unknown> | null
  needs?: readonly unknown[] | null
  health?: object | null
  relationships?: readonly unknown[] | null
  memories?: readonly unknown[] | null
  conversations?: readonly unknown[] | null
  events?: readonly unknown[] | null
  physiology?: object | null
}
export interface NpcProfileCoverage {
  personId: string
  sections: Record<ProfileSection,'recorded'|'missing'>
  missing: ProfileSection[]
  complete: boolean
}
export function npcProfileCoverage(person:NpcProfileEvidence):NpcProfileCoverage {
  if(!person.personId.trim() || !person.name.trim()) throw Error('NPC identity required')
  const facts:Record<ProfileSection,boolean>={
    identity:true,
    biography:typeof person.bio==='string' && person.bio.trim().length>0,
    traits:!!person.traits && Object.keys(person.traits).length>0,
    needs:Array.isArray(person.needs) && person.needs.length>0,
    health:person.health!==null && person.health!==undefined,
    relationships:Array.isArray(person.relationships) && person.relationships.length>0,
    memory:Array.isArray(person.memories) && person.memories.length>0,
    conversations:Array.isArray(person.conversations) && person.conversations.length>0,
    history:Array.isArray(person.events) && person.events.length>0,
    physiology:person.physiology!==null && person.physiology!==undefined,
  }
  const sections=Object.fromEntries(Object.entries(facts).map(([k,v])=>[k,v?'recorded':'missing'])) as Record<ProfileSection,'recorded'|'missing'>
  const missing=(Object.keys(facts) as ProfileSection[]).filter(s=>!facts[s])
  return {personId:person.personId,sections,missing,complete:missing.length===0}
}
