// lib/game/locationBody.ts
// Erstellt:     27.10.2026
// Aktualisiert: 27.10.2026 — Ort → Himmelskörper aus celestial_body_id; Oberflächenorte melden ihre Bahn an (Mishkan Avi, gegründete Orte)
// Version:      1.0.0
//
// Rein, ohne DB-Zugriff. Ein Ort gehört zu einem Körper (celestial_body_id).
// Statt jeden neuen Ort im Code beim Namen zu kennen, wird aus dem Körper
// abgeleitet, wie er dargestellt wird und wie man ihn erreicht.
// Bestehende Orte mit fester Bahn oder eigener Ansicht (earth, moon, mars,
// phobos, deimos, Stationen) bleiben unverändert.

import { ORBITS, registerOrbitAlias } from './orbits'

/**
 * Körper, für die es eine Bahn in ORBITS gibt. IDs wie CELESTIAL_IDS in
 * celestialBodies.ts – hier wiederholt, weil jene Datei ein Client-Modul ist
 * und diese auch vom Server (Transit) gebraucht wird.
 */
export const BODY_SLUG_BY_ID: Readonly<Record<string, string>> = {
  '10000000-0000-0000-0000-000000000002': 'earth',
  '10000000-0000-0000-0000-000000000003': 'moon',
  '10000000-0000-0000-0000-000000000004': 'mars',
  '10000000-0000-0000-0000-000000000005': 'phobos',
  '10000000-0000-0000-0000-000000000006': 'deimos',
}

export interface LocationBodyInput {
  slug?: string | null
  celestial_body_id?: string | null
  location_type?: string | null
}

/** Körper eines Orts: aus celestial_body_id, sonst (alte Zeilen) aus dem Slug. */
export function resolveLocationBody(location: LocationBodyInput | null | undefined): string | null {
  if (!location) return null
  const fromId = location.celestial_body_id ? BODY_SLUG_BY_ID[location.celestial_body_id] : undefined
  if (fromId) return fromId
  const slug = location.slug ?? ''
  return Object.values(BODY_SLUG_BY_ID).includes(slug) ? slug : null
}

/**
 * Ein weiterer Ort auf der Marsoberfläche (nicht der Tharsis Hub selbst, keine
 * Station): wird mit der gemeinsamen Mars-Oberflächenansicht dargestellt.
 */
export function isMarsSurfaceSite(location: LocationBodyInput | null | undefined): boolean {
  if (!location || !location.slug) return false
  if (location.location_type === 'station') return false
  return resolveLocationBody(location) === 'mars'
}

/** Orte mit eigener Oberflächenansicht – fest (Mond, Mars, Phobos, Deimos) oder über den Körper. */
export function hasDedicatedSurfaceView(slug: string, location?: LocationBodyInput | null): boolean {
  if (['moon', 'mars', 'phobos', 'deimos'].includes(slug)) return true
  return isMarsSurfaceSite(location ?? null)
}

/**
 * Meldet für alle Oberflächenorte ohne eigene Bahn die Bahn ihres Körpers an.
 * Idempotent; darf bei jedem Laden der Ortsliste aufgerufen werden.
 * Stationen werden nicht angemeldet: Sie haben eigene Bahnen oder keine Route.
 */
export function registerLocationBodies(locations: ReadonlyArray<LocationBodyInput> | null | undefined): void {
  for (const location of locations ?? []) {
    const slug = location?.slug
    if (!slug || ORBITS[slug] || location.location_type === 'station') continue
    const body = resolveLocationBody(location)
    if (body && body !== slug) registerOrbitAlias(slug, body)
  }
}
