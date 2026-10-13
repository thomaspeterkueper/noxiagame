// lib/game/hospitality/hearsay.ts
// Was jemand, der im Lokal arbeitet, in letzter Zeit mitbekommen hat.
//
// Alles stammt aus dem wirklichen Geschehen am Ort – gezählt, nicht erfunden.
// Zwei Arten, und der Unterschied wird mitgegeben:
//   - „Selbst gesehen“: was im eigenen Lokal passiert ist.
//   - „Gehört“: was Gäste erzählen. Das gibt die Figur als Gehörtes weiter.
// Namen kommen nicht vor: Wer wen kennt, regelt das Spiel an anderer Stelle.

import { compassDirection, roughDistance } from './placeKnowledge'

export const MAX_HEARSAY = 6
export const MAX_HEARSAY_CHARS = 140

export interface VenueHearsayInput {
  /** Käufe im eigenen Lokal in den letzten 24 Stunden. */
  guestsToday: number
  /** Stunden seit dem letzten Kauf; null, wenn es keinen gab. */
  hoursSinceLastGuest: number | null
  /** Baustellen am Ort. */
  builds: ReadonlyArray<{ name: string; distanceM: number; bearingDeg: number }>
  /** Geschehen am Ort in den letzten 24 Stunden. */
  conflicts: number
  assistances: number
  /** Erwachsene am Ort ohne Arbeit. */
  jobSeekers: number
}

const WORDS = ['kein', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn']
const word = (count: number) => WORDS[count] ?? String(count)
const fit = (text: string) => (text.length <= MAX_HEARSAY_CHARS ? text : text.slice(0, MAX_HEARSAY_CHARS - 1).trimEnd() + '…')

export function venueHearsay(input: VenueHearsayInput): string[] {
  const lines: string[] = []
  if (input.guestsToday <= 0) {
    lines.push('Selbst gesehen: Seit gestern hat hier niemand etwas bestellt – es ist ruhig')
  } else {
    const last = input.hoursSinceLastGuest == null ? '' : input.hoursSinceLastGuest < 1 ? '; der letzte Gast war eben erst da' : `; der letzte vor etwa ${word(Math.round(input.hoursSinceLastGuest))} Stunden`
    lines.push(`Selbst gesehen: Seit gestern ${input.guestsToday === 1 ? 'war ein Gast' : `waren ${word(input.guestsToday)} Gäste`} hier${last}`)
  }
  const builds = [...input.builds].sort((a, b) => a.distanceM - b.distanceM).slice(0, 2)
  for (const build of builds) lines.push(`Gehört: Am Ort wird gebaut – ${build.name}, ${roughDistance(build.distanceM)} ${compassDirection(build.bearingDeg)}`)
  if (input.jobSeekers > 0) lines.push(`Gehört: ${input.jobSeekers === 1 ? 'Eine Person' : `${word(input.jobSeekers)[0].toUpperCase()}${word(input.jobSeekers).slice(1)} Leute`} am Ort ${input.jobSeekers === 1 ? 'sucht' : 'suchen'} Arbeit`)
  if (input.conflicts > 0) lines.push(`Gehört: Seit gestern gab es am Ort ${input.conflicts === 1 ? 'einen Streit' : `${word(input.conflicts)}mal Streit`}; wer beteiligt war, weißt du nicht`)
  if (input.assistances > 0) lines.push(`Gehört: Seit gestern ${input.assistances === 1 ? 'hat jemand am Ort einem anderen geholfen' : `haben Leute am Ort einander ${word(input.assistances)}mal geholfen`}`)
  return lines.slice(0, MAX_HEARSAY).map(fit)
}
