// lib/figures/playerLook.ts
// Eigene Figur gestalten (Thomas, 04.11.2026: Second-Life-Mechanik, „alles
// nacheinander“). Der Spieler stellt seine Kiesel-Figur selbst ein; gespeichert in
// player_appearance, gezeigt im Lokal, auf der Karte und den anderen Spielern im Raum.
// Hier: erlaubte Werte, Prüfung, Vorgabe. Arbeitskleidung kommt bei einer Schicht von
// selbst dazu, die Person bleibt dieselbe. Reine Regeln.

import { KIESEL_CLOTHES, kieselLookFor, type KieselAge, type KieselBeard, type KieselBuild, type KieselClothes, type KieselFace, type KieselHair, type KieselLook } from './kiesel'

export const PLAYER_LOOK_OPTIONS = {
  age: [['jung', 'jung'], ['erwachsen', 'erwachsen'], ['aelter', 'älter'], ['alt', 'alt']] as [KieselAge, string][],
  build: [['schmal', 'schmal'], ['mittel', 'mittel'], ['kraeftig', 'kräftig']] as [KieselBuild, string][],
  skin: ['#f6d7c3', '#eabf9f', '#d49a6a', '#b07a4c', '#8a5a36', '#5e3b25', '#f1c9a5', '#c68a5c'],
  hair: [['kurz', 'kurz'], ['lang', 'lang'], ['locken', 'Locken'], ['zopf', 'Zopf'], ['dutt', 'Dutt'], ['glatze', 'Glatze']] as [KieselHair, string][],
  hairColor: ['#26201d', '#5b3a24', '#8a5a2b', '#d9b563', '#a8452a', '#a7a39c', '#e8e4dc', '#3b4f8a', '#8f3e6b'],
  beard: [['ohne', 'ohne'], ['stoppeln', 'Stoppeln'], ['schnurrbart', 'Schnurrbart'], ['vollbart', 'Vollbart']] as [KieselBeard, string][],
  face: [['freundlich', 'freundlich'], ['neutral', 'ruhig'], ['erstaunt', 'neugierig']] as [KieselFace, string][],
  clothes: (['alltag', 'kleid', 'fest', 'overall', 'kittel'] as KieselClothes[]).map(c => [c, KIESEL_CLOTHES[c].label] as [KieselClothes, string]),
  topColor: ['#4f7fa8', '#6a8f5a', '#a8664f', '#7a6aa8', '#c49a3a', '#4f8f8a', '#8f4f5f', '#5f6f7f', '#2f3540', '#d9d4c4'],
} as const

const HEX = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(v: unknown, allowed: readonly (readonly [T, string])[], fallback: T): T => allowed.some(([a]) => a === v) ? v as T : fallback
const color = (v: unknown, allowed: readonly string[], fallback: string) => typeof v === 'string' && HEX.test(v) && allowed.includes(v.toLowerCase()) ? v.toLowerCase() : fallback

/** Vorgabe, solange der Spieler nichts eingestellt hat – fest aus der Kennung. */
export function defaultPlayerLook(id: string): KieselLook {
  const l = kieselLookFor({ id })
  return { ...l, age: l.age === 'kind' ? 'erwachsen' : l.age, face: 'freundlich', robot: false, verletzt: false }
}

/** Nur erlaubte Werte; alles andere fällt auf die Vorgabe zurück. Keine Kinder, keine Roboter. */
export function cleanPlayerLook(raw: unknown, id: string): KieselLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = defaultPlayerLook(id)
  const O = PLAYER_LOOK_OPTIONS
  return {
    age: pick(r.age, O.age, d.age === 'jung' || d.age === 'erwachsen' || d.age === 'aelter' || d.age === 'alt' ? d.age : 'erwachsen'),
    build: pick(r.build, O.build, d.build),
    skin: color(r.skin, O.skin, O.skin.includes(d.skin as never) ? d.skin : O.skin[2]),
    hair: pick(r.hair, O.hair, d.hair),
    hairColor: color(r.hairColor, O.hairColor, d.hairColor),
    beard: pick(r.beard, O.beard, d.beard),
    face: pick(r.face, O.face, 'freundlich'),
    clothes: pick(r.clothes, O.clothes, d.clothes === 'kleid' ? 'kleid' : 'alltag'),
    topColor: color(r.topColor, O.topColor, d.topColor && O.topColor.includes(d.topColor as never) ? d.topColor : O.topColor[0]),
    robot: false,
  }
}

/** Bei der Schicht: Arbeitskleidung über die eigene Figur. */
export function lookAtWork(look: KieselLook, id: string, work: string | null | undefined): KieselLook {
  if (!work) return look
  const clothes = kieselLookFor({ id }, work).clothes
  return clothes === 'alltag' || clothes === 'kleid' ? look : { ...look, clothes }
}
