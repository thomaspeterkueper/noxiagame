/**
 * Erlebnis-Studio (immersion_studio): Preise, Dauer, Gruppenrabatt und Empfangstexte.
 * Der Server rechnet (app/api/game/immersion); der Client zeigt nur an.
 */
export type ImmersionCategory = 'chronotrip' | 'game' | 'abstract'

/** Grundpreis je Person in Credits (Vergleich: Bahnreise 8 Cr + 0,15 Cr/km, Flug ab 60 Cr). */
export const IMMERSION_BASE_PRICE: Record<ImmersionCategory, number> = { chronotrip: 90, game: 60, abstract: 30 }

/** Sitzungsdauer in echten Minuten. */
export const IMMERSION_MINUTES: Record<ImmersionCategory, number> = { chronotrip: 30, game: 45, abstract: 15 }

/** Höchstzahl Pods in einer gemeinsamen Sitzung. */
export const IMMERSION_PARTY_MAX = 6

/** Rabatt je Person bei gemeinsamem Erleben: zu zweit 15 %, ab dritt 25 %. */
export function partyDiscount(size: number): number {
  return size >= 3 ? 0.25 : size === 2 ? 0.15 : 0
}

export function immersionPrice(category: ImmersionCategory, partySize = 1): number {
  const size = Math.max(1, Math.min(IMMERSION_PARTY_MAX, Math.floor(partySize)))
  return Math.round(IMMERSION_BASE_PRICE[category] * (1 - partyDiscount(size)))
}

export function immersionSeconds(category: ImmersionCategory): number {
  return IMMERSION_MINUTES[category] * 60
}

/** Empfangstexte, stabil je Studio (gleicher Name, gleiche Wahl). */
const GREETINGS = [
  'Willkommen. Such dir ein Erlebnis aus, ich richte den Pod her.',
  'Guten Tag. Allein oder zu mehreren? Zu mehreren wird es günstiger.',
  'Schön, dass du da bist. Die Pods sind frisch gereinigt.',
]

export function receptionGreeting(studioName: string): string {
  let h = 2166136261
  for (let i = 0; i < studioName.length; i++) { h ^= studioName.charCodeAt(i); h = Math.imul(h, 16777619) }
  return GREETINGS[(h >>> 0) % GREETINGS.length]
}

export function partyLabel(names: string[], max = IMMERSION_PARTY_MAX): string {
  if (!names.length) return 'noch niemand'
  const shown = names.slice(0, 3).join(', ')
  return names.length > 3 ? `${shown} und ${names.length - 3} weitere` : shown + (names.length >= max ? ' (voll)' : '')
}
