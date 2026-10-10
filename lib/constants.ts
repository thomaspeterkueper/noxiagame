// constants.ts
// Aktualisiert: 10.10.2026 — eine Quelle für Name und Symbol des Guts `energy`
//               (NOXIA-ENERGY-0001: wird mit dem Stromnetz zu „Treibstoff“)
// Vorher:       04.07.2026 — Header ergänzt; Shared-Konstanten
// Version:      0.2.0
// lib/constants.ts

// Das handelbare Gut mit dem technischen Bezeichner `energy` ist nach
// NOXIA-ENERGY-0001 Treibstoff in Tonnen, kein Strom. Die Umbenennung für
// Spieler erfolgt zusammen mit dem Stromnetz (dann erzeugen Solarfelder keine
// Tonnen mehr). Bis dahin bleibt der alte Name – geändert wird nur hier.
export const ENERGY_GOOD_LABEL = 'Energie'
export const ENERGY_GOOD_ICON = '⚡'

export const RESOURCE_LABEL: Record<string, string> = {
  water: 'Wasser',
  energy: ENERGY_GOOD_LABEL,
  metal: 'Metall',
}

export const RESOURCE_ICON: Record<string, string> = {
  water: '💧',
  energy: ENERGY_GOOD_ICON,
  metal: '⛏️',
}

export const LOC_ICON: Record<string, string> = {
  moon: '🌙',
  mars: '🔴',
  phobos: '🪨',
}

export const LOC_NAME: Record<string, string> = {
  moon: 'Mond',
  mars: 'Mars',
  phobos: 'Phobos',
}