// lib/game/earthVehicles.ts
// Aktualisiert: 06.11.2026 — Fahrzeuge auf der Erde: Modelle, Reichweite, Fahrtkosten (Thomas: „1000 km sollten pro Akku schon mindestens drin sein“)
// Version:      1.0.0
//
// Gemeinsame Zahlen für Client und Server. Die Preise stehen auch in der
// Datenbank (vehicle_model); hier nur zur Anzeige – gebucht wird dort.

import type { GeoPoint } from './earthTrips'

export type VehicleModel = { code: string; label: string; priceCredits: number }
export type Vehicle = {
  id: string
  modelCode: string
  modelLabel: string
  conditionPct: number
  chargePct: number
  odometerM: number
  at: GeoPoint | null
}

export const VEHICLE_MODELS: VehicleModel[] = [
  { code: 'kleinwagen', label: 'Kleinwagen (elektrisch)', priceCredits: 1800 },
  { code: 'kombi', label: 'Kombi (elektrisch)', priceCredits: 3200 },
  { code: 'transporter', label: 'Transporter (elektrisch)', priceCredits: 5400 },
]

/** Straßenweg ist länger als die Luftlinie. */
export const ROAD_FACTOR = 1.3
/** Ein Prozent Akku je 10 km – volle Ladung reicht 1 000 km. */
export const KM_PER_CHARGE_PCT = 10
/** Unter diesem Zustand fährt nichts mehr (vehicle_drive). */
export const BROKEN_BELOW_PCT = 15
/** Ab hier lohnt das Auto gegenüber dem Fußweg. */
export const DRIVE_FROM_M = 400
/** Fahrgeschwindigkeit für die Anzeige der Dauer. */
export const DRIVE_KMH = 70

export function driveDistanceM(from: GeoPoint, to: GeoPoint): number {
  const rad = Math.PI / 180
  const dLat = (to.lat - from.lat) * rad, dLon = (to.lon - from.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))) * ROAD_FACTOR)
}

export function chargeCostPct(distanceM: number): number {
  return Math.ceil(distanceM / (KM_PER_CHARGE_PCT * 1000))
}

export function canDrive(vehicle: Vehicle | null, distanceM: number): { ok: boolean; why?: string } {
  if (!vehicle) return { ok: false, why: 'Kein Fahrzeug.' }
  if (vehicle.conditionPct < BROKEN_BELOW_PCT) return { ok: false, why: 'Fahrzeug kaputt – erst in die Werkstatt.' }
  if (vehicle.chargePct < chargeCostPct(distanceM)) return { ok: false, why: 'Akku reicht nicht – erst laden.' }
  return { ok: true }
}

export function driveLabel(distanceM: number): string {
  const km = distanceM / 1000
  const minutes = Math.max(1, Math.round(km / DRIVE_KMH * 60))
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km · ${minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`} · ${chargeCostPct(distanceM)} % Akku`
}
