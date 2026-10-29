// lib/game/jobs/crewSignon.ts
// Erstellt:     29.10.2026
// Aktualisiert: 29.10.2026 — Mitflug auf Handelsschiffen: Texte und Wissen für Raumhafen und Agentur
// Version:      1.0.0
//
// Rein, ohne DB. Spielerwunsch „Raumhafen“ (entschieden von Thomas, 29.10.2026).
// Server: app/api/game/crew, Migration 20261029120000_crew_signon_trade_ships.sql.

export type CrewRoute = { destination: string; name: string; departures: number; lastDepartTick: number; hours: number; wage: number }
export type CrewSignon = {
  status: 'waiting' | 'aboard' | 'arrived' | 'cancelled'
  destination: string
  destinationName?: string
  arrive_tick?: number | null
  wage_credits?: number | null
  paid_credits?: number | null
}
export type CrewState = { location: string | null; locationName: string | null; hasShip: boolean; inTransit: boolean; tick: number; routes: CrewRoute[]; signon: CrewSignon | null }

/** Wie lange die letzte Fracht her ist, in Worten. */
export function sinceText(hours: number): string {
  if (hours < 1) return 'gerade eben'
  if (hours < 24) return `vor ${Math.round(hours)} Std.`
  const days = Math.round(hours / 24)
  return days === 1 ? 'vor einem Tag' : `vor ${days} Tagen`
}

export function durationText(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))} Std.`
  const days = Math.round(hours / 24 * 10) / 10
  return `${String(days).replace('.', ',')} Tage`
}

/** Eine Zeile zum Stand des Spielers. */
export function crewStatusLine(state: CrewState): string | null {
  const s = state.signon
  if (!s) return null
  const where = s.destinationName ?? s.destination
  if (s.status === 'waiting') return `Du stehst auf der Heuerliste nach ${where}. Du gehst an Bord, sobald die nächste Fracht dorthin ausläuft – bleib dafür am Ort.`
  if (s.status === 'aboard') {
    const left = s.arrive_tick != null ? Math.max(0, s.arrive_tick - state.tick) : null
    return `Du fliegst als Crew nach ${where}${left != null ? `, Ankunft in etwa ${durationText(left)}` : ''}. Heuer bei Ankunft: ${s.wage_credits ?? '?'} Cr.`
  }
  if (s.status === 'arrived') return `Letzter Mitflug nach ${where}: ${s.paid_credits ?? 0} Cr Heuer erhalten.`
  return null
}

/** Was Personal am Raumhafen und in der Agentur darüber weiß – nur aus echten Daten. */
export function crewKnowledge(state: CrewState | null): string[] {
  if (!state) return []
  if (state.routes.length === 0) return ['Von hier fährt zurzeit keine Fracht ab; anheuern kann man hier nicht']
  const lines = state.routes.map(r =>
    `Fracht nach ${r.name}: ${r.departures} Abfahrten bisher, zuletzt ${sinceText(Math.max(0, state.tick - r.lastDepartTick))}, Flug etwa ${durationText(r.hours)}, Heuer ${r.wage} Cr`)
  return [
    'Wer kein eigenes Schiff hat, kann beim Frachtführer Epona Fracht als Crew anheuern: Man kommt auf die Heuerliste und geht an Bord, sobald die nächste Fracht zum Ziel ausläuft; die Heuer gibt es bei der Ankunft',
    'Wann die nächste Fracht ausläuft, weiß niemand vorher – das entscheidet die Handelsfirma nach Bedarf',
    ...lines,
  ]
}
