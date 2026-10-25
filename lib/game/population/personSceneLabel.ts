// lib/game/population/personSceneLabel.ts
// Was über einer Figur in der Spielansicht steht (Entscheidung Thomas, 25.10.2026):
// nur „Mann“, „Frau“, „Junge“, „Mädchen“ usw., solange man die Person nicht
// kennt; kennt man sie, ihr Name; weiß man das Alter, in Klammern dahinter –
// „Thomas Küper (58)“. Die lange Beschreibung („Ein Mann mittleren Alters mit
// ruhiger Haltung …“) gehört in die Personentafel, nicht über die Figur.

import type { PersonAppearance } from './personAppearance'

export interface PersonSceneLabelInput {
  identityState?: 'unknown' | 'inferred' | 'known'
  /** Der Name, wie der Spieler ihn kennt oder vermutet. */
  displayName?: string
  appearance?: Pick<PersonAppearance, 'genderPresentation' | 'visibleAgeBand'> | null
  /** Alter in Jahren – nur, wenn der Spieler es wirklich weiß. */
  knownAgeYears?: number | null
}

/** Kurzes Wort für jemanden, den man nicht kennt – nach dem, was man sieht. */
export function observedPersonNoun(appearance: PersonSceneLabelInput['appearance']): string {
  const g = appearance?.genderPresentation ?? 'androgynous'
  const band = appearance?.visibleAgeBand ?? 'adult'
  const pick = (f: string, m: string, n: string) => g === 'feminine' ? f : g === 'masculine' ? m : n
  switch (band) {
    case 'child': return pick('Mädchen', 'Junge', 'Kind')
    case 'teen': return pick('Jugendliche', 'Jugendlicher', 'Jugendliche Person')
    case 'young_adult': return pick('Junge Frau', 'Junger Mann', 'Junge Person')
    case 'older': return pick('Ältere Frau', 'Älterer Mann', 'Ältere Person')
    default: return pick('Frau', 'Mann', 'Person')
  }
}

export function personSceneLabel(input: PersonSceneLabelInput): string {
  const state = input.identityState ?? 'unknown'
  const name = (input.displayName ?? '').trim()
  if ((state === 'known' || state === 'inferred') && name) {
    const age = input.knownAgeYears
    return Number.isFinite(age) && (age as number) >= 0 ? `${name} (${Math.floor(age as number)})` : name
  }
  return observedPersonNoun(input.appearance)
}
