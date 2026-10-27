// lib/worldlab/reanchor.ts
// Aufgabe 6 der Erdkarte: Der Zeichenanker wandert mit.
//
// Die Weltkarte rechnet in Metern relativ zu einem festen Anker, mit dem
// Mercator-Maßstab seiner Breite. Kacheln haben aber den Maßstab ihrer eigenen
// Breite. Je weiter man sich vom Anker entfernt, desto weniger passen beide
// zusammen: Von Sundern nach Frankfurt (1,2° südlicher) sind die Kacheln 2,6 %
// größer als ihr Abstand – rund 5 m Überlappung je Kachel, dazu ungenaue Zahlen
// auf der Grafikkarte. Deshalb wird die Welt um die Spielfigur neu verankert,
// sobald sie zu weit vom Anker steht.

import { mercPerGroundMetre } from './mercator'

/** Ab dieser Entfernung vom Anker (m) wird neu verankert. */
export const REANCHOR_DISTANCE_M = 5000
/** Beim Laufen erst, wenn die Figur so lange stillsteht (s) – dann stört der kurze Neuaufbau nicht. */
export const REANCHOR_IDLE_S = 1.5

/** Fehler im Kachelabstand (Anteil), wenn der Anker auf `anchorLat` liegt und die Figur auf `lat`. */
export function anchorScaleError(anchorLat: number, lat: number): number {
  return Math.abs(mercPerGroundMetre(anchorLat) / mercPerGroundMetre(lat) - 1)
}

/**
 * Soll jetzt neu verankert werden?
 * - nach einem Sprung sofort, wenn das Ziel weiter als die Schwelle vom Anker liegt;
 * - beim Laufen erst, wenn die Figur weit genug weg ist und still steht.
 */
export function shouldReanchor(input: { distanceM: number; jumped: boolean; idleS: number; autoWalking: boolean }): boolean {
  if (input.distanceM <= REANCHOR_DISTANCE_M) return false
  if (input.jumped) return true
  return !input.autoWalking && input.idleS >= REANCHOR_IDLE_S
}
