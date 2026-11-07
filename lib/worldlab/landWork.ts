// lib/worldlab/landWork.ts
// Bewirtschaftung eigener Flurstücke (NOXIA-MAT-0001, Thomas 28.10.2026: „Kann man eigentlich
// Wald roden und das Rohholz verkaufen? Wie ist es mit Getreideanbau, Tierzucht? Steinbruch?“).
// Reine Funktionen: Kennzahlen und Zustand aus den Zeilen der Datenbank (earth_parcel_forest,
// earth_parcel_field, earth_parcel_herd, earth_parcel_quarry). Die Datenbank bucht, dieses
// Modul rechnet, was gerade geht – dieselben Regeln wie in den SQL-Funktionen
// (Migration 20261106080100_fields_pasture_quarry.sql).
// Ein Spieljahr = 30 echte Tage (Lebenslauf-Uhr 12×, NOXIA-TIME-0001), ein Spielmonat = 2,5 Tage.
// Alle Mengen und Preise sind vorläufig (Request 20261028-0042 an den Knowledge Graph).

import { GAME_YEAR_DAYS, REGROW_DAYS } from './landUse'

const DAY_MS = 86_400_000

export type CropId = 'wheat' | 'potatoes'

export interface Crop {
  id: CropId
  label: string
  /** Gut im Inventar (`resource_type`) */
  resource: 'grain' | 'potatoes'
  goodLabel: string
  /** Ertrag je ha und Ernte (t) */
  tPerHa: number
  /** Von der Saat bis zur Reife (echte Tage) */
  growDays: number
  /** Saatgut/Pflanzgut und Bestellung je ha (Cr, an die Gemeinde) */
  feePerHa: number
  /** Ankauf durch die Gemeinde je t (Cr) */
  buyPrice: number
}

/** Weizen: 7,5 t/ha, neun Spielmonate; Kartoffeln: 40 t/ha, knapp fünf Spielmonate. */
export const CROPS: Readonly<Record<CropId, Crop>> = {
  wheat: { id: 'wheat', label: 'Weizen', resource: 'grain', goodLabel: 'Getreide', tPerHa: 7.5, growDays: 22, feePerHa: 35, buyPrice: 11 },
  potatoes: { id: 'potatoes', label: 'Kartoffeln', resource: 'potatoes', goodLabel: 'Kartoffeln', tPerHa: 40, growDays: 12, feePerHa: 130, buyPrice: 5 },
}

export const FIELD = {
  /** So lange nach der Reife volle Ernte, danach nur noch die Hälfte */
  lateDays: 5,
  /** Danach ist die Ernte verdorben und das Feld wieder frei */
  spoilDays: 15,
} as const

export const CATTLE = {
  /** Rinder je ha Weide */
  perHa: 2,
  /** Jungrind von der Gemeinde (Cr) */
  buyPrice: 25,
  /** Schlachtreifes Rind an die Gemeinde (Cr) */
  sellPrice: 70,
  /** Bis zur Schlachtreife: ein Spieljahr */
  matureDays: GAME_YEAR_DAYS,
} as const

export const QUARRY = {
  /** Abbau je ha und echtem Tag (t) – rund 1.200 t je ha im Spieljahr */
  tPerHaDay: 40,
  /** Höchstens so viele Tage sammeln sich an (vier Spielmonate) */
  maxDays: 10,
  /** Gewinnbarer Vorrat je ha (t), danach ist der Bruch erschöpft */
  reservePerHa: 50_000,
  /** Sprengen, Laden, Maschinen: Anteil des Werts als Kosten (an die Gemeinde) */
  feeShare: 0.6,
  /** Ankauf von Bruchstein je t */
  stoneBuyPrice: 1,
  /** Lohnbrechen Bruchstein → Schotter 1 : 1, Gebühr je angefangene 2 t */
  crushFeePer2t: 1,
} as const

const days = (fromIso: string | null | undefined, now: number) => fromIso ? Math.max(0, (now - Date.parse(fromIso)) / DAY_MS) : 0
const hectares = (areaM2: number) => Math.round(Math.max(0, areaM2) / 100) / 100

// ── Wald ────────────────────────────────────────────────────────────────────────────

export interface ForestRow { stock_m3: number | string; growth_m3_year: number | string; last_harvest_at: string | null; cleared_at: string | null; replanted_at: string | null; updated_at?: string | null }

/**
 * Vorrat wächst mit dem Zuwachs bis zum Vorrat eines ausgewachsenen Waldes (`fullStockM3`),
 * auch nach Aufforstung von null an. Nachhaltig schlagen: der Zuwachs seit dem letzten
 * Einschlag (bzw. Kauf/Aufforstung), höchstens zwei Spieljahre und nie mehr als der Vorrat.
 */
export function forestState(row: ForestRow | null, start: { stockM3: number; growthM3Year: number; areaHa: number }, boughtAt: string | null, now = Date.now()) {
  const growth = Number(row?.growth_m3_year ?? start.growthM3Year)
  const grownYears = days(row?.updated_at ?? null, now) / GAME_YEAR_DAYS
  const stock = row ? Math.min(start.stockM3, Number(row.stock_m3) + growth * grownYears) : start.stockM3
  const cleared = Boolean(row?.cleared_at), replanted = Boolean(row?.replanted_at)
  const regrowsAt = cleared && replanted ? new Date(Date.parse(row!.replanted_at!) + REGROW_DAYS * DAY_MS).toISOString() : null
  const blocked = cleared && (!replanted || (regrowsAt !== null && Date.parse(regrowsAt) > now))
  const since = row?.last_harvest_at ?? row?.replanted_at ?? boughtAt
  const years = Math.min(2, days(since, now) / GAME_YEAR_DAYS)
  return {
    stockM3: Math.round(stock), growthM3Year: growth,
    harvestableM3: blocked ? 0 : Math.floor(Math.min(stock, growth * years)),
    cleared, replanted, regrowsAt,
    replantFee: Math.max(10, Math.round(start.areaHa * 40)),
    /** Aussehen auf der Karte */
    look: (cleared && !replanted ? 'clearing' : blocked ? 'young' : null) as 'clearing' | 'young' | null,
  }
}

// ── Feld ────────────────────────────────────────────────────────────────────────────

export interface FieldRow { crop: string | null; sown_at: string | null; ripe_at: string | null; harvested_at: string | null }

export type FieldStatus = 'empty' | 'growing' | 'ripe' | 'late' | 'spoiled' | 'harvested'

/** Ertrag eines Feldes (ganze t, wie im Inventar). */
export const cropYield = (crop: Crop, areaHa: number) => Math.floor(areaHa * crop.tPerHa)
export const sowFee = (crop: Crop, areaHa: number) => Math.max(5, Math.round(areaHa * crop.feePerHa))

export function fieldState(row: FieldRow | null, areaM2: number, now = Date.now()) {
  const areaHa = hectares(areaM2)
  const crop = row?.crop && row.crop in CROPS ? CROPS[row.crop as CropId] : null
  let status: FieldStatus = 'empty'
  if (crop && row?.sown_at && row.ripe_at) {
    const ripe = Date.parse(row.ripe_at)
    if (row.harvested_at && Date.parse(row.harvested_at) >= Date.parse(row.sown_at)) status = 'harvested'
    else if (now < ripe) status = 'growing'
    else if (now <= ripe + FIELD.lateDays * DAY_MS) status = 'ripe'
    else if (now <= ripe + FIELD.spoilDays * DAY_MS) status = 'late'
    else status = 'spoiled'
  }
  const expectedT = crop ? Math.floor(cropYield(crop, areaHa) * (status === 'late' ? 0.5 : 1)) : 0
  const progress = crop && row?.sown_at && row.ripe_at ? Math.min(1, Math.max(0, (now - Date.parse(row.sown_at)) / (Date.parse(row.ripe_at) - Date.parse(row.sown_at)))) : 0
  return {
    areaHa, status, crop: crop?.id ?? null, cropLabel: crop?.label ?? null, goodLabel: crop?.goodLabel ?? null,
    sownAt: row?.sown_at ?? null, ripeAt: row?.ripe_at ?? null, progress, expectedT,
    canSow: status === 'empty' || status === 'harvested' || status === 'spoiled',
    canHarvest: status === 'ripe' || status === 'late',
    options: (Object.values(CROPS)).map(item => ({ crop: item.id, label: item.label, fee: sowFee(item, areaHa), growDays: item.growDays, yieldT: cropYield(item, areaHa), value: cropYield(item, areaHa) * item.buyPrice }))
      .filter(item => item.yieldT >= 1),
    look: (status === 'growing' ? 'sown' : status === 'ripe' || status === 'late' ? 'ripe' : status === 'harvested' || status === 'spoiled' ? 'stubble' : null) as 'sown' | 'ripe' | 'stubble' | null,
  }
}

// ── Weide ───────────────────────────────────────────────────────────────────────────

export interface Cohort { n: number; since: string }
export interface HerdRow { cohorts: Cohort[] | null }

export const pastureCapacity = (areaM2: number) => Math.floor(hectares(areaM2) * CATTLE.perHa)

export function herdState(row: HerdRow | null, areaM2: number, now = Date.now()) {
  const cohorts = (row?.cohorts ?? []).filter(item => Number(item?.n) > 0)
  const count = cohorts.reduce((sum, item) => sum + Number(item.n), 0)
  const mature = cohorts.filter(item => days(item.since, now) >= CATTLE.matureDays).reduce((sum, item) => sum + Number(item.n), 0)
  const next = cohorts.filter(item => days(item.since, now) < CATTLE.matureDays).map(item => Date.parse(item.since) + CATTLE.matureDays * DAY_MS).sort((a, b) => a - b)[0]
  const capacity = pastureCapacity(areaM2)
  return {
    count, mature, capacity, free: Math.max(0, capacity - count),
    nextMatureAt: next ? new Date(next).toISOString() : null,
    buyPrice: CATTLE.buyPrice, sellPrice: CATTLE.sellPrice,
  }
}

// ── Steinbruch ──────────────────────────────────────────────────────────────────────

export interface QuarryRow { reserve_t: number | string; last_extract_at: string | null }

export const quarryFee = (amountT: number) => Math.ceil(amountT * QUARRY.stoneBuyPrice * QUARRY.feeShare)
export const crushFee = (amountT: number) => Math.ceil(amountT / 2) * QUARRY.crushFeePer2t

export function quarryState(row: QuarryRow | null, areaM2: number, boughtAt: string | null, now = Date.now()) {
  const areaHa = hectares(areaM2)
  const reserveT = row ? Math.max(0, Number(row.reserve_t)) : Math.round(areaHa * QUARRY.reservePerHa)
  const since = row?.last_extract_at ?? boughtAt
  const extractableT = Math.floor(Math.min(reserveT, QUARRY.tPerHaDay * areaHa * Math.min(QUARRY.maxDays, days(since, now))))
  return { areaHa, reserveT, extractableT, fee: quarryFee(extractableT), ratePerDay: Math.round(QUARRY.tPerHaDay * areaHa), exhausted: reserveT < 1 }
}

/** Startvorrat eines Steinbruchs (t) */
export const quarryReserve = (areaM2: number) => Math.round(hectares(areaM2) * QUARRY.reservePerHa)

/** Ankaufspreise der Gemeinde je Einheit (Cr), über Holz hinaus */
export const FARM_BUY_PRICES: Readonly<Record<string, number>> = {
  grain: CROPS.wheat.buyPrice,
  potatoes: CROPS.potatoes.buyPrice,
  stone: QUARRY.stoneBuyPrice,
  gravel: 1,
}

/** Aussehen eines Flurstücks auf der Karte (für die Engine) */
export type ParcelLook = 'clearing' | 'young' | 'sown' | 'ripe' | 'stubble' | 'pasture'

/**
 * Aussehen bewirtschafteter Flurstücke auf der Karte: Kahlschlag ohne Aufforstung → Lichtung,
 * Jungwald bis zum nächsten Einschlag, Feld je nach Stand, Weide mit der Zahl der Tiere.
 */
export function parcelLooks(
  forests: Array<{ parcel_id: string; cleared_at: string | null; replanted_at: string | null }>,
  fields: Array<{ parcel_id: string } & FieldRow>,
  herds: Array<{ parcel_id: string; cohorts: Cohort[] | null }>,
  now = Date.now(),
) {
  const out = new Map<string, { look: ParcelLook; crop?: string; animals?: number }>()
  for (const row of forests) {
    if (!row.cleared_at) continue
    if (!row.replanted_at) out.set(row.parcel_id, { look: 'clearing' })
    else if (Date.parse(row.replanted_at) + REGROW_DAYS * DAY_MS > now) out.set(row.parcel_id, { look: 'young' })
  }
  for (const row of fields) {
    const state = fieldState(row, 0, now)
    if (state.look) out.set(row.parcel_id, { look: state.look, crop: state.crop ?? undefined })
  }
  for (const row of herds) {
    const animals = (row.cohorts ?? []).reduce((sum, item) => sum + Math.max(0, Number(item?.n) || 0), 0)
    if (animals > 0) out.set(row.parcel_id, { look: 'pasture', animals })
  }
  return out
}
