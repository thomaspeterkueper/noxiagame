// lib/game/hospitality/venueServices.ts
// Dienstleistungen eines Hauses neben der Karte – zuerst die Toilette
// (Thomas, 28.10.2026): „Der Betreiber eines Lokals oder auch Ladens sollte die
// Möglichkeit haben, selbst Preise und Dienstleistungen anzupassen; standardmäßig
// gilt die Toilette als frei für jeden.“
// Gespeichert werden Abweichungen je Haus erst, wenn es dafür Daten gibt
// (Request R-18 an Bevölkerung und Ökonomie); bis dahin gilt der Standard.
// Reine Regeln.

import type { VenuePoint } from './venues'

export interface ToiletRule {
  /** Gibt es eine Toilette für Besucher? */
  available: boolean
  /** Preis je Benutzung in Credits; 0 = frei. */
  priceCredits: number
  /** Nur für Gäste, die bei diesem Besuch etwas bestellt haben. */
  guestsOnly: boolean
}

export interface VenueServiceRules { toilet: ToiletRule }

export const DEFAULT_VENUE_SERVICES: VenueServiceRules = {
  toilet: { available: true, priceCredits: 0, guestsOnly: false },
}

/** Die WC-Tür an der Eingangswand, rechts – in allen Lokalarten und Größen frei (geprüft im Test). */
export const VENUE_WC_DOOR: VenuePoint = { x: 560, y: 418 }

/** Hausregeln aus Daten (falls es welche gibt), sonst der Standard. */
export function venueServiceRules(data: unknown): VenueServiceRules {
  const t = (data && typeof data === 'object' ? (data as { toilet?: Partial<ToiletRule> }).toilet : null) ?? null
  if (!t) return DEFAULT_VENUE_SERVICES
  const price = Number(t.priceCredits)
  return {
    toilet: {
      available: t.available !== false,
      priceCredits: Number.isFinite(price) && price > 0 ? Math.round(price) : 0,
      guestsOnly: t.guestsOnly === true,
    },
  }
}

/** Was jemand im Haus über die Toilette weiß. Das Personal kennt die Hausregel. */
export function toiletFact(rule: ToiletRule, staff: boolean): string {
  if (!rule.available) return staff ? 'Eine Toilette für Besucher gibt es hier nicht; das hat der Betreiber so entschieden' : 'Eine Toilette für Besucher siehst du hier nicht'
  const where = 'Tür „WC“ an der Eingangswand rechts'
  if (!staff) return `Es gibt eine Toilette: ${where}`
  if (rule.guestsOnly && rule.priceCredits > 0) return `Toilette (${where}): nur für Gäste, die hier etwas bestellt haben, ${rule.priceCredits} Credits je Benutzung`
  if (rule.guestsOnly) return `Toilette (${where}): nur für Gäste, die hier etwas bestellt haben`
  if (rule.priceCredits > 0) return `Toilette (${where}): für jeden, ${rule.priceCredits} Credits je Benutzung`
  return `Toilette (${where}): frei für jeden, auch ohne Bestellung`
}

/** Fragt jemand nach der Toilette? Dann muss die Regel in die Fakten, auch wenn die Liste voll ist. */
export function mentionsToilet(text: string | null | undefined): boolean {
  return Boolean(text && /\b(toilett\w*|wc|klo\w*|pinkel\w*|bad|waschraum|örtchen|austreten|muss mal)\b/i.test(text))
}

export type ToiletAccess = { ok: true; text: string } | { ok: false; text: string }

/** Darf der Spieler jetzt auf die Toilette? Bezahlt wird erst, wenn es Hauspreise gibt (R-18). */
export function toiletAccess(rule: ToiletRule, input: { hasOrdered: boolean }): ToiletAccess {
  if (!rule.available) return { ok: false, text: 'Hier gibt es keine Toilette für Besucher.' }
  if (rule.guestsOnly && !input.hasOrdered) return { ok: false, text: 'Die Toilette ist nur für Gäste – erst etwas bestellen.' }
  if (rule.priceCredits > 0) return { ok: false, text: `Die Toilette kostet ${rule.priceCredits} Credits; bezahlen kann man das noch nicht.` }
  return { ok: true, text: 'Du warst kurz auf der Toilette.' }
}
