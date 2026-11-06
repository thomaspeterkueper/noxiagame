// lib/worldlab/bodies.ts
// Weltkarte jenseits der Erde (06.11.2026): was die gemeinsame Zeichenmaschine je
// Himmelskörper wissen muss. Der Körper liefert Projektion, Boden und Sonne; Laufen,
// Personen, Tafeln und Betreten bleiben gemeinsam (`app/world-lab/worldEngine.ts`).
//
// Maße aus `lib/game/spatial/planetary.ts` (eine Quelle für Radien).

import { PLANETARY_REFERENCES } from '@/lib/game/spatial/planetary'
import { bodyProjection, EARTH_PROJECTION, type Projection } from './bodyProjection'
import { marsSunElevationDeg } from './marsSun'
import { sunElevationDeg } from './ambient'
import { GROUND_COLOR } from './blocks'

export type MapBody = 'earth' | 'mars' | 'moon' | 'phobos' | 'deimos'

export interface BodyLook {
  id: MapBody
  /** Name in der Anzeige */
  name: string
  projection: Projection
  /** Grundfarbe des Bodens (Hintergrund der Bühne) */
  ground: number
  /** Sonnenhöhe in Grad an diesem Ort und Zeitpunkt (für Tag und Nacht) */
  sunElevation: (lat: number, lonEast: number, nowMs: number) => number
  /** Draußen nur im Anzug oder Fahrzeug (Thomas, Entscheidung zu anderen Himmelskörpern) */
  suitOutside: boolean
  /** Schwerkraft gegenüber der Erde (für späteres Gehen/Springen) */
  gravity: number
}

const MARS_PROJECTION = bodyProjection(PLANETARY_REFERENCES.mars.equatorialRadiusM)

export const BODY_LOOKS: Partial<Record<MapBody, BodyLook>> = {
  earth: { id: 'earth', name: 'Erde', projection: EARTH_PROJECTION, ground: GROUND_COLOR, sunElevation: sunElevationDeg, suitOutside: false, gravity: 1 },
  // Tharsis: rostbrauner, staubiger Regolith; Farbe gegen die Mars-Gebäudebilder abgestimmt
  mars: { id: 'mars', name: 'Mars', projection: MARS_PROJECTION, ground: 0xb5734a, sunElevation: marsSunElevationDeg, suitOutside: true, gravity: 0.38 },
}

export function bodyLook(body: string | null | undefined): BodyLook | null {
  return (body && BODY_LOOKS[body as MapBody]) || null
}

/** Orte (locations.slug), die die neue Weltkarte schon zeigen kann, und ihr Körper. */
export const WORLD_MAP_LOCATIONS: Record<string, MapBody> = {
  mars: 'mars',
}
