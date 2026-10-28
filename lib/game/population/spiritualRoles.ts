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
  | 'davaru'

/**
 * Religions and philosophical ways are kept apart on purpose:
 * Omnizedenz is a philosophy of becoming, the Way of DaVaRu an ethical
 * practice (Davaru-Kodex). Neither is modelled as a church or a creed.
 */
export type TraditionKind = 'religious' | 'philosophical'

export const TRADITION_KIND: Readonly<Record<SpiritualTradition, TraditionKind>> = {
  christian: 'religious',
  islamic: 'religious',
  jewish: 'religious',
  hindu: 'religious',
  buddhist: 'religious',
  other_religious: 'religious',
  omnizedenz: 'philosophical',
  davaru: 'philosophical',
}

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
  | 'omnizedent'
  | 'davaru_companion'

export interface SpiritualRoleDefinition {
  code: SpiritualRoleCode
  label: string
  traditions: SpiritualTradition[]
  functions: Array<'service'|'ritual'|'teaching'|'care'|'conversation'|'community'|'reflection'>
  clergyLike: boolean
}

export const SPIRITUAL_ROLE_DEFINITIONS: readonly SpiritualRoleDefinition[] = [
  { code: 'priest', label: 'Priester/in', traditions: ['christian','hindu','other_religious'], functions: ['service','ritual','teaching','care','conversation','community'], clergyLike: true },
  { code: 'pastor', label: 'Pfarrer/in / Pastor/in', traditions: ['christian'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'imam', label: 'Imam', traditions: ['islamic'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'rabbi', label: 'Rabbiner/in', traditions: ['jewish'], functions: ['service','teaching','care','conversation','community'], clergyLike: true },
  { code: 'monastic', label: 'Ordens-/Klosterrolle', traditions: ['christian','buddhist','hindu','other_religious'], functions: ['ritual','teaching','care','reflection','community'], clergyLike: true },
  { code: 'chaplain', label: 'Seelsorge', traditions: ['christian','islamic','jewish','other_religious'], functions: ['care','conversation','community'], clergyLike: true },
  { code: 'religious_teacher', label: 'Religionslehre', traditions: ['christian','islamic','jewish','hindu','buddhist','other_religious'], functions: ['teaching','conversation','community'], clergyLike: false },
  { code: 'community_host', label: 'Gemeinschaftsgastgeber/in', traditions: ['christian','islamic','jewish','hindu','buddhist','other_religious','omnizedenz','davaru'], functions: ['conversation','community'], clergyLike: false },
  // Provisional functional label only; it is deliberately not declared clergy.
  // Hosts a resonance place (space, schedule, quiet) – not a teacher of doctrine.
  { code: 'resonance_facilitator', label: 'Resonanzbegleitung', traditions: ['omnizedenz'], functions: ['conversation','reflection','community'], clergyLike: false },
  // Advocate and conversation partner for the philosophy (NOXIA-NPC-RELIGION-0002).
  // A person who holds and explains Omnizedenz, no ordination, no office.
  { code: 'omnizedent', label: 'Omnizedent/in', traditions: ['omnizedenz'], functions: ['conversation','teaching','reflection'], clergyLike: false },
  // Practitioner of the Way of DaVaRu who accompanies others through its questions.
  // Thomas (28.10.2026): „Dava“, Mehrzahl „Davas“, für alle Geschlechter gleich.
  { code: 'davaru_companion', label: 'Dava', traditions: ['davaru'], functions: ['conversation','care','reflection'], clergyLike: false },
] as const

export function spiritualRoleDefinition(code: SpiritualRoleCode) {
  return SPIRITUAL_ROLE_DEFINITIONS.find(role => role.code === code) ?? null
}

export function spiritualRoleFitsTradition(code: SpiritualRoleCode, tradition: SpiritualTradition) {
  return spiritualRoleDefinition(code)?.traditions.includes(tradition) ?? false
}

export function traditionKind(tradition: SpiritualTradition): TraditionKind {
  return TRADITION_KIND[tradition]
}
