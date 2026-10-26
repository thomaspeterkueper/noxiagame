// lib/game/interiors/baseFacts.ts
// Was jede Figur in jedem begehbaren Gebäude von ihrem Platz aus weiß
// (NOXIA-INTERIOR-0001): wo sie ist, wie der Raum aussieht, wo der Spieler
// steht, wer sonst da ist. Gebäudeeigenes Wissen hängt die Einrichtung an.

import { canSeeRoom, describePlayerPosition, othersFact, type VenueFigure, type VenueLayout, type VenuePoint, type VenueSpot } from '../hospitality/venues'

export const MAX_FACTS = 16
export const MAX_FACT_CHARS = 140

export function fitFact(text: string): string {
  return text.length <= MAX_FACT_CHARS ? text : text.slice(0, MAX_FACT_CHARS - 1).trimEnd() + '…'
}

export interface BaseFactsInput {
  layout: VenueLayout
  buildingName: string
  self: VenueFigure
  figures: readonly VenueFigure[]
  playerPos: VenuePoint
  playerSeat?: VenueSpot | null
  /** „Du arbeitest hier als Lehrkraft“ – Rolle des Personals in diesem Haus. */
  staffRoleText?: string
}

export function baseInteriorFacts(input: BaseFactsInput): string[] {
  const { layout, self } = input
  const staff = self.roomRole === 'staff'
  const name = String(input.buildingName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const seesRoom = canSeeRoom(layout, self.spot.roomId, layout.playerRoomId)
  const posture = self.spot.posture === 'sitting' ? 'sitzt' : 'stehst'
  const facts: string[] = [name ? `Ihr befindet euch ${layout.locative} ${name}` : `Ihr befindet euch ${layout.locative}`]
  if (seesRoom) facts.push(layout.roomFact)
  if (staff) facts.push(fitFact(`${input.staffRoleText ?? 'Du arbeitest hier'} und ${posture} ${self.spot.label}`))
  else if (self.roomRole === 'companion') facts.push(`Du bist mit deinem Gegenüber hergekommen und ${posture} ${self.spot.label}`)
  else facts.push(`Du bist als Besucher hier und ${posture} ${self.spot.label}`)
  if (seesRoom) {
    facts.push(input.playerSeat ? fitFact(`Dein Gegenüber sitzt ${input.playerSeat.label}`) : `Dein Gegenüber steht gerade ${describePlayerPosition(layout, input.playerPos)}`)
    facts.push(othersFact(layout, self, input.figures))
  }
  facts.push(staff ? layout.staffBackFact : layout.guestBackFact)
  return facts.map(fitFact)
}

/** Hängt gebäudeeigenes Wissen an und hält die Grenze der Gesprächsroute ein. */
export function withExtraFacts(base: string[], extra: readonly string[]): string[] {
  return [...base, ...extra.map(fitFact)].slice(0, MAX_FACTS)
}
