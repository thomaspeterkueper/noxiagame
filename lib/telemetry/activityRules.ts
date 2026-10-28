// lib/telemetry/activityRules.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Reine Regeln für die Verhaltensaufzeichnung der Testphase (Wunsch Thomas)
// Version:      1.0.0
//
// Rein, ohne DOM und ohne DB. Von Client (Aufzeichnung) und Server (Annahme)
// gemeinsam genutzt, damit beide dieselben Grenzen ziehen.

export const ACTIVITY_KINDS = [
  'session_start', // Sitzung beginnt: Bildschirm, Sprache, Zeitzone, Gerät
  'heartbeat',     // jede Minute, in der der Spieler aktiv war
  'view',          // Seite, Ort oder Ansicht gewechselt
  'click',         // Klick auf etwas Bedienbares
  'dead_click',    // Klick auf etwas, das nicht bedienbar aussieht
  'rage_click',    // mehrere schnelle Klicks an derselben Stelle
  'action',        // Spielaktion an den Server (alles außer GET)
  'api_error',     // Serveranfrage fehlgeschlagen
  'js_error',      // Fehler im Browser
  'position',      // Standort der Spielfigur in einer begehbaren Ansicht
] as const
export type ActivityKind = typeof ACTIVITY_KINDS[number]

export const MAX_EVENTS_PER_BATCH = 100
export const MAX_LABEL_CHARS = 80

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(value)
}

/** Kurze, einzeilige Beschriftung; IDs werden ersetzt. */
export function cleanLabel(value: unknown, max = MAX_LABEL_CHARS): string {
  return String(value ?? '')
    .replace(UUID_RE, ':id')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** API-Pfad ohne Abfrageteil und ohne IDs: /api/game/ships?action=buy → /api/game/ships */
export function normalizeApiPath(url: string): string {
  let path = url
  try { path = new URL(url, 'https://noxia.local').pathname } catch { path = url.split('?')[0] }
  return cleanLabel(path.replace(/\/\d{3,}(?=\/|$)/g, '/:n'), 120)
}

/** Aktion des API-Aufrufs, wenn sie im Abfrageteil steht (?action=buy). */
export function apiActionParam(url: string): string | null {
  try {
    const action = new URL(url, 'https://noxia.local').searchParams.get('action')
    return action ? cleanLabel(action, 40) : null
  } catch { return null }
}

export interface ClickSample { t: number; x: number; y: number }

/** Drei Klicks binnen einer Sekunde im Umkreis von 30 px gelten als Wutklick. */
export function isRageClick(history: ReadonlyArray<ClickSample>, now: ClickSample): boolean {
  const near = history.filter(c => now.t - c.t <= 1000 && Math.hypot(c.x - now.x, c.y - now.y) <= 30)
  return near.length >= 2
}

/** Position auf 2 m gerundet: genug für Laufwege, kein Bewegungsprotokoll im Zentimeterbereich. */
export function roundPosition(value: number): number {
  return Math.round(value / 2) * 2
}

/** Ob eine neue Position gemeldet wird: alle 5 s höchstens, und nur nach mindestens 3 m Weg. */
export function shouldReportPosition(
  last: { t: number; x: number; y: number; scope: string } | null,
  next: { t: number; x: number; y: number; scope: string },
): boolean {
  if (!last || last.scope !== next.scope) return true
  if (next.t - last.t < 5000) return false
  return Math.hypot(next.x - last.x, next.y - last.y) >= 3
}
