// lib/worldlab/viewOptions.ts
// Was die Weltkarte beschriftet (Kritik vom 28.10.2026: man soll Dinge an- und
// ausschalten können – Straßennamen, bekannte Gebäude aus OpenStreetMap –, so dass
// am Ende nur Gebäude mit einer Funktion im Spiel Bezeichnungen tragen; ebenso in
// der „Gehe zu“-Liste).
//
// Eine Funktion haben: NOXIA-Gebäude (immer beschriftet) und Orte aus OSM mit
// begehbarem Raum im Spiel (Kirche, Bibliothek, ArtLounge, Gemeindezentrum,
// Begegnungsstätte – `landmarkRoomKind`). Alles andere aus OSM (Läden, Lokale,
// Denkmäler …) ist nur Beschriftung und lässt sich ausblenden.

import { landmarkRoomKind } from '@/lib/game/landmarks/interiors'

export interface ViewOptions {
  /** Straßennamen entlang der Straßen */
  streetNames: boolean
  /** Läden, Lokale und Wahrzeichen aus OpenStreetMap ohne Funktion im Spiel */
  osmPlaces: boolean
}

// Vorgabe (Thomas, 28.10.2026): OSM-Orte zu Beginn aus („aus zu Beginn ist besser“), Straßennamen an
// („lassen wir die Straßennamen zu Anfang“) – die Karte startet aufgeräumt, aber mit Orientierung.
export const DEFAULT_VIEW: ViewOptions = { streetNames: true, osmPlaces: false }
const KEY = 'noxia-world-view-v1'

/** Hat ein Ort aus OSM eine Funktion im Spiel (begehbarer Raum)? */
export function placeHasFunction(kind: string, tags?: Record<string, string>): boolean {
  return landmarkRoomKind(kind, tags) !== null
}

/** Soll ein Ort aus OSM gezeigt werden (Schild, Name, Zielliste)? */
export function showPlace(view: ViewOptions, place: { kind: string; tags?: Record<string, string>; poi?: boolean }): boolean {
  if (view.osmPlaces) return true
  return !place.poi && placeHasFunction(place.kind, place.tags)
}

/** Gespeicherte Wahl dieses Browsers (fehlt oder unlesbar: Vorgabe). */
export function loadView(): ViewOptions {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    const parsed = raw ? JSON.parse(raw) as Partial<ViewOptions> : {}
    return { streetNames: parsed.streetNames ?? DEFAULT_VIEW.streetNames, osmPlaces: parsed.osmPlaces ?? DEFAULT_VIEW.osmPlaces }
  } catch { return { ...DEFAULT_VIEW } }
}
export function saveView(view: ViewOptions) {
  try { window.localStorage.setItem(KEY, JSON.stringify(view)) } catch { /* ohne Speicher */ }
}
