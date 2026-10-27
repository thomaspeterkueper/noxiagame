// lib/game/warehouse/warehouseInterior.ts
// Grundriss und Wissen des Warenhauses für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Lagerhalle mit Preistafel, Tresen der Disposition,
// Regalen und Kisten; Wareneingang und -ausgang seitlich. Reine Regeln.

import { LOGISTICS_STANDARD_INTERIOR } from '../buildings/interiors/templates/logisticsStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, type VenueLayout, type VenueSpot } from '../hospitality/venues'

const crates: VenueSpot[] = [[200, 300], [300, 300], [400, 300]].map(([x, y], i) => ({ id: `crate-seat-${i + 1}`, kind: 'seat', x: x + 20, y: y - 12, roomId: 'storage', label: 'auf einer Kiste', posture: 'sitting' }))

export const WAREHOUSE_LAYOUT: VenueLayout = {
  kind: 'warehouse',
  template: LOGISTICS_STANDARD_INTERIOR,
  noun: 'Warenhaus',
  locative: 'im Warenhaus',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'storage',
  servicePoint: { x: 560, y: 176, label: 'AN DER DISPOSITION', locative: 'am Tresen der Disposition' },
  windows: [{ x: 300, w: 160 }],
  furniture: [
    { id: 'board', kind: 'board', x: 140, y: 46, w: 240, h: 22 },
    { id: 'counter', kind: 'counter', x: 470, y: 104, w: 180, h: 40 },
    { id: 'shelf-1', kind: 'shelf', x: 140, y: 150, w: 16, h: 120 },
    { id: 'shelf-2', kind: 'shelf', x: 700, y: 200, w: 16, h: 200 },
    ...[[200, 300], [300, 300], [400, 300]].map(([x, y], i) => ({ id: `crate-${i + 1}`, kind: 'table' as const, x, y, w: 40, h: 40 })),
    { id: 'crate-4', kind: 'table', x: 520, y: 330, w: 40, h: 40 },
    { id: 'crate-5', kind: 'table', x: 570, y: 330, w: 40, h: 40 },
  ],
  spots: [
    staffSpot('staff-dispo', 560, 92, 'storage', 'am Tresen der Disposition'),
    staffSpot('staff-office', 650, 300, 'office', 'in der Disposition'),
    staffSpot('staff-receiving', 100, 200, 'receiving', 'im Wareneingang'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'storage' },
    ...crates,
  ],
  roomFact: 'Die Lagerhalle hat eine Preistafel, den Tresen der Disposition, Regale und Kisten; der Ausgang liegt beim Eingang',
  guestBackFact: 'Seitlich liegen Wareneingang und Warenausgang; dort fahren die Transporter vor',
  staffBackFact: 'Seitlich liegen Wareneingang und Warenausgang, hinten das Büro der Disposition mit den Aufträgen',
}

export interface MarketPriceRow { resource: string; buyPrice: number; sellPrice: number; stock: number }
export interface WarehouseFacts {
  locationName: string
  prices: MarketPriceRow[]
  openOrders: number
  /** Fracht des Gastes, wenn er ein Schiff hat. */
  cargo?: Record<string, number> | null
}

const RESOURCE_DE: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall', food: 'Lebensmittel' }
const nameOf = (r: string) => RESOURCE_DE[r] ?? r

/** Was die Disposition weiß: die Preise der Tafel, offene Aufträge, die Fracht des Gastes. */
export function warehouseKnowledge(input: WarehouseFacts | null): string[] {
  if (!input) return ['Die Preistafel liegt dir gerade nicht vor; verweise auf die Disposition']
  const rows = input.prices.slice(0, 6)
  const facts = [
    rows.length ? `Preise heute in ${input.locationName}: ${rows.map(r => `${nameOf(r.resource)} Ankauf ${r.sellPrice}, Verkauf ${r.buyPrice} Cr`).join('; ')}` : 'Heute steht nichts auf der Preistafel',
    rows.some(r => r.stock === 0) ? `Ausverkauft: ${rows.filter(r => r.stock === 0).map(r => nameOf(r.resource)).join(', ')}` : 'Alles auf der Tafel ist vorrätig',
    input.openOrders > 0 ? `Es liegen ${input.openOrders} offene Transportaufträge aus` : 'Zurzeit liegen keine Transportaufträge aus',
  ]
  const cargo = input.cargo ? Object.entries(input.cargo).filter(([, v]) => v > 0) : []
  facts.push(cargo.length ? `Dein Gegenüber hat an Bord: ${cargo.map(([k, v]) => `${v} ${nameOf(k)}`).join(', ')}` : 'Dein Gegenüber hat keine Fracht dabei')
  facts.push('Preise anderer Orte kennst du nicht aus dem Kopf; gehandelt wird am Tresen, nicht im Gespräch')
  return facts
}

export const WAREHOUSE_INTRODUCTION = {
  style: 'warehouse',
  stance: 'Du bist praktisch und direkt wie jemand, der den ganzen Tag Kisten zählt. Neuen zeigst du die Preistafel und erklärst, dass man hier billig kauft, was anderswo teuer ist – ohne Versprechen.',
  leads: [
    'Handel heißt: hier kaufen, dort verkaufen; die Tafel zeigt, was hier günstig ist',
    'Ohne eigenes Schiff fährt ein Spediteur die Ware und behält einen Anteil',
    'Transportaufträge bringen festes Geld für eine Fahrt; die Liste liegt an der Disposition',
  ],
}
