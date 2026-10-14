// Spiritual/community roles for persistent NOXIA persons.
//
// These are occupation/community-role descriptors only. They do not grant
// privileged knowledge, moral authority, special AI, or infer a person's belief.
// Concrete traditions may impose their own eligibility/ordination rules later.

export type SpiritualTradition =
  | 'christian'
  | 'islamic'
  | 'jewish'
  | 'hindu'
  | 'buddhist'
  | 'other_religious'
  | 'omnizedenz'

export type SpiritualRoleCode =
  | 'priest'
  | 'pastor'
  | 'imam'
  | 'rabbi'
  | 'monastic'
  | 'chaplain'
  | 'religious_teacher'
  | 'community_host'
  | 'resonance_facilitator'

export interface SpiritualRoleDefinition {
  code: SpiritualRoleCode
  label: string
  traditions: SpiritualTradition[]
  functions: Array<'service'|'ritual'|'teaching'|'care'|'conversation'|'community'|'reflection'>
  clergyLike: boolean
}

export const SPIRITUAL_ROLE_DEFINITIONS: readonly SpiritualRoleDefinition[] = [
  { code: 'priest', label: 'Priester/in', traditions: ['christian','other_religious'], functions: ['service','ritual','teaching','care','conversation','community'], clergyLike: true },
  { code: 'pastor', label: 'Pfarrer/in / Pastor/in', traditions: ['christian'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'imam', label: 'Imam', traditions: ['islamic'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'rabbi', label: 'Rabbiner/in', traditions: ['jewish'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'monastic', label: 'Ordens-/Klosterrolle', traditions: ['christian','buddhist','hindu','other_religious'], functions: ['ritual','teaching','care','reflection','community'], clergyLike: true },
  { code: 'chaplain', label: 'Seelsorge', traditions: ['christian','islamic','jewish','other_religious'], functions: ['care','conversation','community'], clergyLike: true },
  { code: 'religious_teacher', label: 'Religionslehre', traditions: ['christian','islamic','jewish','hindu','buddhist','other_religious'], functions: ['teaching','conversation','community'], clergyLike: false },
  { code: 'community_host', label: 'Gemeinschaftsgastgeber/in', traditions: ['christian','islamic','jewish','hindu','buddhist','other_religious','omnizedenz'], functions: ['conversation','community'], clergyLike: false },
  // Provisional functional label only; it is deliberately not declared clergy.
  { code: 'resonance_facilitator', label: 'Resonanzbegleitung', traditions: ['omnizedenz'], functions: ['conversation','reflection','community'], clergyLike: false },
] as const

export function spiritualRoleDefinition(code: SpiritualRoleCode) {
  return SPIRITUAL_ROLE_DEFINITIONS.find(role => role.code === code) ?? null
}

export function spiritualRoleFitsTradition(code: SpiritualRoleCode, tradition: SpiritualTradition) {
  return spiritualRoleDefinition(code)?.traditions.includes(tradition) ?? false
}
