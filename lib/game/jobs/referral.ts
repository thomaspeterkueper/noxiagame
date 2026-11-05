// lib/game/jobs/referral.ts
// Direkt vermitteln (Thomas, 29.10.2026: „bei offenen Stellen, die die Agentur
// kennt, können wir ja auch direkt vermitteln“).
// An der Vermittlung wählt der Spieler eine Stelle von der Wand – oder sagt sie
// im Gespräch („als Barkeeper ins Metropol“) –, die Agentur stellt einen
// Vermittlungsschein aus. Im Lokal weiß das Personal davon, die Stelle steht
// oben, und wer direkt von der Agentur hingeht, tritt die Schicht gleich an.
// Es gibt immer nur einen Schein; er gilt zwei echte Stunden. Reine Regeln,
// dazu das Ablegen im Browser (bis der Arbeitsmarkt Scheine führt, R-21).

import type { JobOffer } from './jobAgency'
import type { ShiftRole } from '../hospitality/playerShift'

export const REFERRAL_VALID_MS = 2 * 60 * 60 * 1000

export interface JobReferral {
  buildingId: string
  buildingTypeId: string
  /** Name auf der Karte, z. B. „Bar · Metropol“ – damit das Lokal sich öffnen lässt. */
  buildingName: string
  placeName: string
  placeKind: string
  role: ShiftRole
  roleLabel: string
  gameHours: number
  wage: number
  paid: boolean
  /** Wer vermittelt hat: „VERA“ oder der Name der Vermittlerin. */
  by: string
  issuedAtMs: number
}

export function referralFromOffer(offer: JobOffer, by: string, nowMs: number): JobReferral {
  return {
    buildingId: offer.buildingId, buildingTypeId: offer.typeId, buildingName: offer.buildingName,
    placeName: offer.placeName, placeKind: offer.placeKind, role: offer.role, roleLabel: offer.roleLabel,
    gameHours: offer.gameHours, wage: offer.wage, paid: offer.paid, by, issuedAtMs: nowMs,
  }
}

export function referralValid(ref: JobReferral | null | undefined, nowMs: number): ref is JobReferral {
  return Boolean(ref) && nowMs - ref!.issuedAtMs >= 0 && nowMs - ref!.issuedAtMs < REFERRAL_VALID_MS
}

/** Der Schein für dieses Haus – oder null. */
export function referralFor(ref: JobReferral | null | undefined, buildingId: string, nowMs: number): JobReferral | null {
  return referralValid(ref, nowMs) && ref.buildingId === buildingId ? ref : null
}

/** „Barkeeper im Metropol“ */
export function referralTitle(ref: Pick<JobReferral, 'roleLabel' | 'placeName' | 'placeKind'>): string {
  return `${ref.roleLabel} · ${ref.placeName} (${ref.placeKind})`
}

/** Was die Agentur über den Schein weiß. */
export function agencyReferralFacts(ref: JobReferral | null, nowMs: number): string[] {
  if (!referralValid(ref, nowMs)) return []
  return [`Dein Gegenüber ist schon vermittelt: ${referralTitle(ref)}; der Schein gilt zwei Stunden, antreten muss es dort`]
}

/** Was das Personal im Lokal weiß – nur Personal, Gäste wissen davon nichts. */
export function venueReferralFacts(ref: JobReferral | null, staff: boolean, working: boolean): string[] {
  if (!ref || !staff || working) return []
  return [`Die Agentur für Arbeit hat dein Gegenüber als ${ref.roleLabel} hierher vermittelt; ihr erwartet es, es kann gleich anfangen`]
}

// ── Gesprochen vermitteln (wie Bestellen im Gespräch, spokenOrder.ts) ──────

const ROLE_WORDS: Readonly<Record<ShiftRole, readonly string[]>> = {
  door: ['türsteher', 'tür', 'einlass', 'security', 'sicherheit'],
  bar: ['barkeeper', 'barkeeperin', 'tresen', 'theke', 'ausschank', 'barmann', 'barfrau'],
  dj: ['dj', 'auflegen', 'musik', 'deejay'],
  service: ['bedienung', 'kellner', 'kellnerin', 'servieren', 'service'],
  reception: ['empfang', 'rezeption', 'rezeptionist', 'rezeptionistin'],
  cleaning: ['putzkraft', 'putzen', 'reinigung', 'sauber', 'saubermachen', 'aufräumen'],
}
const NEGATIONS = new Set(['kein', 'keine', 'keinen', 'nicht', 'ohne', 'nie'])

function words(text: string): string[] {
  return text.toLocaleLowerCase('de-DE').replace(/[^\p{L}\s-]+/gu, ' ').split(/[\s-]+/).filter(Boolean)
}
const hit = (token: string, keyword: string) => token === keyword || (keyword.length >= 5 && token.startsWith(keyword))

/**
 * Stellen von der Wand, die in einem Satz gemeint sind – höchstens drei.
 * Genannt sein muss eine Tätigkeit; ein genanntes Haus grenzt ein, sonst gilt
 * die erste passende Stelle der (schon nach Nähe sortierten) Liste.
 * Verneintes („nicht putzen“) zählt nicht.
 */
export function spokenJobChoices(text: string | null | undefined, offers: readonly JobOffer[]): JobOffer[] {
  if (!text || offers.length === 0) return []
  const tokens = words(text)
  const roles: ShiftRole[] = []
  tokens.forEach((token, i) => {
    if (tokens.slice(Math.max(0, i - 2), i).some(w => NEGATIONS.has(w))) return
    for (const [role, keys] of Object.entries(ROLE_WORDS) as [ShiftRole, readonly string[]][]) {
      if (!roles.includes(role) && keys.some(k => hit(token, k))) roles.push(role)
    }
  })
  if (roles.length === 0) return []
  const placeHit = (o: JobOffer) => words(o.placeName).filter(w => w.length >= 4 && !/^\d+$/.test(w)).some(w => tokens.includes(w))
  const named = offers.filter(placeHit)
  const pool = named.length ? named : offers
  const picks: JobOffer[] = []
  for (const role of roles) {
    for (const o of pool.filter(o => o.role === role)) {
      if (picks.length >= 3) break
      if (!picks.some(p => p.buildingId === o.buildingId && p.role === o.role)) picks.push(o)
      if (!named.length) break // ohne Haus nur die nächste Stelle je Tätigkeit
    }
  }
  return picks
}

// ── Ablage im Browser ───────────────────────────────────────────────────────
const KEY = 'noxia.jobReferral'

export function loadReferral(): JobReferral | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return null
    const ref = JSON.parse(raw) as JobReferral
    return typeof ref?.buildingId === 'string' && typeof ref?.role === 'string' ? ref : null
  } catch { return null }
}

export function saveReferral(ref: JobReferral | null): void {
  try {
    if (ref) globalThis.localStorage?.setItem(KEY, JSON.stringify(ref))
    else globalThis.localStorage?.removeItem(KEY)
  } catch { /* ohne Ablage gilt der Schein nur, solange man direkt hingeht */ }
}
