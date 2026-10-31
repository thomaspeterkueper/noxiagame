/**
 * ChronoTravel v1: reine Domänenfunktionen, keine parallele Weltzeit oder NPC-Persistenz.
 * Eine historische Rekonstruktion ist eine Simulation, keine reale Zeitreise.
 */
export type Confidence = 'documented' | 'inferred' | 'speculative'
export type ExperienceMode = 'historical_explorer' | 'living_history' | 'alternative_history'
export type TravelStatus = 'reserved' | 'cancelled' | 'completed'

export type Evidence = {
  sourceRef: string
  confidence: Confidence
  note: string
}
export type HistoricalScene = {
  id: string
  placeId: string
  label: string
  yearCE: number
  anchor: { lat: number; lon: number }
  evidence: Evidence[]
  /** Nur ein Szenenmanifest, kein separater Weltzustand. */
  reconstructionVersion: string
}
export type Offer = {
  id: string
  sceneId: string
  mode: ExperienceMode
  durationMinutes: number
  priceCredits: number
  capacity: number
}
export type Reservation = {
  id: string
  offerId: string
  actorId: string
  guests: number
  startsAt: string
  status: TravelStatus
}
export type Validation = { ok: true } | { ok: false; reason: string }

export function validateScene(scene: HistoricalScene): Validation {
  if (!scene.id || !scene.placeId || !scene.label || !scene.reconstructionVersion) return { ok: false, reason: 'missing_identity' }
  if (!Number.isInteger(scene.yearCE) || scene.yearCE === 0) return { ok: false, reason: 'invalid_year' }
  if (!Number.isFinite(scene.anchor.lat) || !Number.isFinite(scene.anchor.lon) ||
      Math.abs(scene.anchor.lat) > 90 || Math.abs(scene.anchor.lon) > 180) return { ok: false, reason: 'invalid_coordinates' }
  if (!scene.evidence.length || scene.evidence.some(e => !e.sourceRef.trim() || !e.note.trim())) return { ok: false, reason: 'missing_evidence' }
  return { ok: true }
}

export function validateReservation(
  request: Reservation,
  offers: readonly Offer[],
  reservations: readonly Reservation[],
  scenes: readonly HistoricalScene[],
): Validation {
  const offer = offers.find(o => o.id === request.offerId)
  if (!offer) return { ok: false, reason: 'unknown_offer' }
  const scene = scenes.find(s => s.id === offer.sceneId)
  if (!scene || !validateScene(scene).ok) return { ok: false, reason: 'invalid_scene' }
  if (!request.id || !request.actorId || !Number.isInteger(request.guests) || request.guests < 1)
    return { ok: false, reason: 'invalid_guest' }
  if (request.status !== 'reserved') return { ok: false, reason: 'invalid_initial_status' }
  if (!Number.isFinite(Date.parse(request.startsAt))) return { ok: false, reason: 'invalid_start' }
  if (!Number.isInteger(offer.capacity) || offer.capacity < 1 ||
      !Number.isFinite(offer.priceCredits) || offer.priceCredits < 0 ||
      !Number.isInteger(offer.durationMinutes) || offer.durationMinutes < 1)
    return { ok: false, reason: 'invalid_offer' }
  if (reservations.some(r => r.id === request.id)) return { ok: false, reason: 'duplicate_reservation' }
  const used = reservations.filter(r =>
    r.offerId === request.offerId && r.startsAt === request.startsAt && r.status === 'reserved'
  ).reduce((sum, r) => sum + r.guests, 0)
  if (used + request.guests > offer.capacity) return { ok: false, reason: 'capacity_exceeded' }
  return { ok: true }
}

export function quoteCredits(offer: Offer, guests: number): number {
  if (!Number.isInteger(guests) || guests < 1 || !Number.isFinite(offer.priceCredits) || offer.priceCredits < 0)
    throw new Error('invalid_quote')
  return offer.priceCredits * guests
}

export function evidenceOverview(scene: HistoricalScene): Record<Confidence, number> {
  return scene.evidence.reduce((counts, item) => {
    counts[item.confidence] += 1
    return counts
  }, { documented: 0, inferred: 0, speculative: 0 })
}

/** Ergebnis ist ein Lernereignis-Vorschlag; nur das vorhandene NPC-Memory-System persistiert ihn. */
export function visitMemoryEvent(reservation: Reservation, scene: HistoricalScene) {
  if (reservation.status !== 'completed') throw new Error('visit_not_completed')
  return {
    actorId: reservation.actorId,
    category: 'historical_vr_visit' as const,
    placeId: scene.placeId,
    sceneId: scene.id,
    historicalYearCE: scene.yearCE,
    reservationId: reservation.id,
    simulated: true as const,
  }
}
