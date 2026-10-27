// lib/game/passengerOffers.ts
// Linienflüge ohne eigenes Schiff (Thomas, 27.10.2026: „baue das“): welche
// Ziele vom aktuellen Ort aus angeflogen werden, mit Ticketpreis und Dauer.
// Dasselbe Modell wie beim Abflug auf dem Server (lib/game/core/transit.ts →
// startPlayerPassengerTransit): transferQuote mit Standardtempo, Preis aus
// passengerTicketPrice. Reichweite spielt keine Rolle – die Linie fliegt.

import { hasOrbit } from './orbits'
import { passengerTicketPrice, transferQuote } from './transfer'

export interface PassengerOffer {
  slug: string
  name: string
  ticketPrice: number
  durationSeconds: number
}

export function passengerOffers(input: {
  from: string
  destinations: ReadonlyArray<{ slug: string; name?: string | null }>
  tick: number
  navigationProficiency?: number
}): PassengerOffer[] {
  if (!hasOrbit(input.from)) return []
  const seen = new Set<string>()
  const offers: PassengerOffer[] = []
  for (const destination of input.destinations) {
    if (destination.slug === input.from || seen.has(destination.slug) || !hasOrbit(destination.slug)) continue
    seen.add(destination.slug)
    const quote = transferQuote(input.from, destination.slug, input.tick, { speedMult: 1, navigationProficiency: input.navigationProficiency })
    if (!quote) continue
    offers.push({ slug: destination.slug, name: destination.name?.trim() || destination.slug, ticketPrice: passengerTicketPrice(quote), durationSeconds: quote.durationSeconds })
  }
  return offers.sort((a, b) => a.ticketPrice - b.ticketPrice || a.name.localeCompare(b.name))
}

/** „27 s“, „4 min“, „2 h 10 min“ */
export function flightDurationText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 90) return `${s} s`
  const minutes = Math.round(s / 60)
  if (minutes < 120) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
