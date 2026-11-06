// lib/game/pilots.ts
// Erstellt:     06.11.2026 – NPC-Piloten zum Anheuern für Schiffe ohne Spieler an Bord
// Version:      1.0.0
//
// Reine Ableitung, kein eigener Zustand: Am Ort liegen je Schiff und Tag drei
// Piloten zur Auswahl (deterministisch aus Schiff, Ort und Tag). Erfahrene
// Piloten verlangen mehr Honorar. Das Honorar fällt immer an, weil nicht der
// Spieler fliegt (anders als pilotFee in pilotQualification.ts).

import { PILOT_FEE_CR_PER_ENERGY } from './pilotQualification'

export type HiredPilot = {
  /** 0–2: Position in der Auswahl des Tages. */
  index: number
  name: string
  /** 1 Neuling · 2 erfahren · 3 Veteran */
  level: 1 | 2 | 3
  levelLabel: string
  /** Faktor auf das Grundhonorar. */
  feeFactor: number
}

const FIRST_NAMES = ['Aiko', 'Jonas', 'Mira', 'Tomasz', 'Leila', 'Ravi', 'Hanna', 'Okoye', 'Ines', 'Dmitri', 'Salma', 'Eero', 'Camila', 'Yusuf', 'Greta', 'Kofi']
const LAST_NAMES = ['Brandt', 'Nakamura', 'Okafor', 'Lindqvist', 'Haddad', 'Moreau', 'Petrov', 'Alvarez', 'Weiss', 'Tanaka', 'Novak', 'Duarte', 'Hoffmann', 'Sato', 'Varga', 'Ibarra']

const LEVELS: Array<{ level: 1 | 2 | 3; label: string; feeFactor: number }> = [
  { level: 1, label: 'Neuling', feeFactor: 0.8 },
  { level: 2, label: 'erfahren', feeFactor: 1 },
  { level: 3, label: 'Veteran', feeFactor: 1.35 },
]

function fnv(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Die drei Piloten, die heute für dieses Schiff an diesem Ort zur Auswahl stehen. */
export function availablePilots(shipId: string, location: string, day: string): HiredPilot[] {
  return LEVELS.map((lvl, index) => {
    const h = fnv(`${shipId}|${location}|${day}|${index}`)
    return {
      index,
      name: `${FIRST_NAMES[h % FIRST_NAMES.length]} ${LAST_NAMES[(h >>> 8) % LAST_NAMES.length]}`,
      level: lvl.level,
      levelLabel: lvl.label,
      feeFactor: lvl.feeFactor,
    }
  })
}

export function pilotByIndex(shipId: string, location: string, day: string, index: number): HiredPilot | null {
  return availablePilots(shipId, location, day)[index] ?? null
}

/** Honorar des angeheuerten Piloten für einen Flug (immer fällig, mindestens 1 Cr). */
export function hiredPilotFee(quote: { energy: number }, pilot: Pick<HiredPilot, 'feeFactor'>): number {
  return Math.max(1, Math.round(quote.energy * PILOT_FEE_CR_PER_ENERGY * pilot.feeFactor))
}

/** Tagesschlüssel (UTC) für die tägliche Auswahl. */
export function pilotDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
