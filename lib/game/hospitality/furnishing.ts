// lib/game/hospitality/furnishing.ts
// Einrichten und Hausrecht (Second-Life-Mechanik, Teil 6; Thomas, 04.11.2026: „alles
// nacheinander“). Wem das Lokal gehört, der stellt die Tische um und schmückt den Raum.
// Wer stört, bekommt Hausverbot. Die Wegfindung weicht den verschobenen Tischen von
// selbst aus; Tresen, Tanzfläche, Einlass und Ausgang bleiben frei. Die Figuren sehen,
// wie der Raum aussieht – mehr wissen sie davon nicht. Reine Regeln.

import { VENUE_WIDTH, type VenueFurniture, type VenueLayout, type VenuePoint, type VenueSpot } from './venues'

export type DecorKind = 'pflanze' | 'stehlampe' | 'bild' | 'girlande' | 'teppich' | 'kerzen'
export const DECOR_KINDS: Readonly<Record<DecorKind, { label: string; plural: string }>> = {
  pflanze: { label: 'Pflanze', plural: 'Pflanzen' },
  stehlampe: { label: 'Stehlampe', plural: 'Stehlampen' },
  bild: { label: 'Bild', plural: 'Bilder an der Wand' },
  girlande: { label: 'Girlande', plural: 'Girlanden' },
  teppich: { label: 'Teppich', plural: 'Teppiche' },
  kerzen: { label: 'Kerzen', plural: 'Kerzen' },
}
export const DECOR_MAX = 12

export interface DecorItem { id: string; kind: DecorKind; x: number; y: number }
export interface Furnishing { tables: Record<string, VenuePoint>; decor: DecorItem[] }
export const EMPTY_FURNISHING: Furnishing = { tables: {}, decor: [] }

const GAP = 22 // Stuhl links und rechts samt Abstand
const tableNo = (id: string) => /^table-(\d+)$/.exec(id)?.[1] ?? null
const inGroup = (id: string, n: string) => id === `table-${n}` || id.startsWith(`chair-${n}-`) || id.startsWith(`table-${n}-`)

type Rect = { x: number; y: number; w: number; h: number }
const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
const groupRect = (t: VenueFurniture, at: VenuePoint): Rect => ({ x: at.x - GAP, y: at.y - 4, w: t.w + 2 * GAP, h: t.h + 8 })

/** Tische, die sich umstellen lassen (mit ihren zwei Stühlen). */
export function movableTables(layout: VenueLayout): VenueFurniture[] {
  return layout.furniture.filter(f => f.kind === 'table' && tableNo(f.id))
}

/** Bereich, in dem Tische stehen dürfen: um die Tische der Vorlage herum, innerhalb der Wände. */
export function tableArea(layout: VenueLayout): Rect {
  const ts = movableTables(layout)
  if (!ts.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x0 = Math.max(40, Math.min(...ts.map(t => t.x - GAP)) - 50), y0 = Math.max(100, Math.min(...ts.map(t => t.y)) - 40)
  const x1 = Math.min(VENUE_WIDTH - 40, Math.max(...ts.map(t => t.x + t.w + GAP)) + 50), y1 = Math.min(430, Math.max(...ts.map(t => t.y + t.h)) + 40)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Darf Tisch `id` (aus der Vorlage `base`) bei `at` stehen, wenn die übrigen nach `f` stehen? */
export function tableMoveAllowed(base: VenueLayout, id: string, at: VenuePoint, f: Furnishing): boolean {
  const n = tableNo(id)
  const t = base.furniture.find(x => x.id === id)
  if (!n || !t) return false
  const me = groupRect(t, at)
  const area = tableArea(base)
  if (me.x < area.x || me.y < area.y || me.x + me.w > area.x + area.w || me.y + me.h > area.y + area.h) return false
  for (const other of base.furniture) {
    if (inGroup(other.id, n)) continue
    const on = tableNo(other.id)
    if (on) { if (hit(me, groupRect(other, f.tables[other.id] ?? other))) return false; continue }
    if (/^chair-\d+-/.test(other.id)) continue // Stühle wandern mit ihrem Tisch
    if (hit(me, other)) return false
  }
  if (base.danceFloor && hit(me, base.danceFloor)) return false
  if (base.entry && hit(me, base.entry.zone)) return false
  const keepFree = [base.exit, base.start, base.servicePoint, ...(base.entry ? [base.entry.payAt] : [])]
  if (keepFree.some(p => hit(me, { x: p.x - 40, y: p.y - 40, w: 80, h: 80 }))) return false
  const otherSpots = base.spots.filter(s => !s.id.startsWith(`table-${n}-`) && !/^table-\d+-/.test(s.id))
  if (otherSpots.some(s => hit(me, { x: s.x - 14, y: s.y - 14, w: 28, h: 28 }))) return false
  return true
}

/** Der Raum mit umgestellten Tischen: Tisch, Stühle und Sitzplätze wandern zusammen. */
export function withFurnishing(base: VenueLayout, f: Furnishing | null | undefined): VenueLayout {
  if (!f || (!Object.keys(f.tables).length && !f.decor.length)) return base
  const shift = new Map<string, VenuePoint>()
  for (const t of movableTables(base)) {
    const at = f.tables[t.id]
    if (at) shift.set(tableNo(t.id)!, { x: at.x - t.x, y: at.y - t.y })
  }
  const move = <T extends { id: string; x: number; y: number }>(item: T): T => {
    const m = /^(?:table|chair)-(\d+)/.exec(item.id)
    const d = m ? shift.get(m[1]) : null
    return d ? { ...item, x: item.x + d.x, y: item.y + d.y } : item
  }
  const facts = furnishingFacts(f)
  return {
    ...base,
    furniture: base.furniture.map(move),
    spots: base.spots.map(s => move(s) as VenueSpot),
    roomFact: facts.length ? `${base.roomFact} ${facts.join(' ')}`.slice(0, 400) : base.roomFact,
  }
}

/** Nur erlaubte Umstellungen und Schmuck; was nicht passt, fällt weg. */
export function cleanFurnishing(raw: unknown, base: VenueLayout): Furnishing {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { tables?: unknown; decor?: unknown }
  const out: Furnishing = { tables: {}, decor: [] }
  const tablesIn = r.tables && typeof r.tables === 'object' ? r.tables as Record<string, unknown> : {}
  for (const t of movableTables(base)) {
    const p = tablesIn[t.id] as Partial<VenuePoint> | undefined
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const at = { x: Math.round(p.x!), y: Math.round(p.y!) }
    if (at.x === t.x && at.y === t.y) continue
    if (tableMoveAllowed(base, t.id, at, out)) out.tables[t.id] = at
  }
  const decorIn = Array.isArray(r.decor) ? r.decor : []
  for (const d of decorIn.slice(0, DECOR_MAX)) {
    const v = (d ?? {}) as Partial<DecorItem>
    if (!v.kind || !(v.kind in DECOR_KINDS) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) continue
    const wall = v.kind === 'bild' || v.kind === 'girlande'
    out.decor.push({
      id: typeof v.id === 'string' && /^[a-z0-9-]{1,24}$/i.test(v.id) ? v.id : `d${out.decor.length + 1}`,
      kind: v.kind,
      x: Math.max(50, Math.min(VENUE_WIDTH - 50, Math.round(v.x!))),
      y: wall ? Math.max(18, Math.min(80, Math.round(v.y!))) : Math.max(100, Math.min(430, Math.round(v.y!))),
    })
  }
  return out
}

/** Was jeder im Raum sieht. */
export function furnishingFacts(f: Furnishing | null | undefined): string[] {
  if (!f) return []
  const count = new Map<DecorKind, number>()
  for (const d of f.decor) count.set(d.kind, (count.get(d.kind) ?? 0) + 1)
  const parts = [...count].map(([k, n]) => n === 1 ? `ein${k === 'pflanze' || k === 'stehlampe' || k === 'girlande' ? 'e' : ''} ${DECOR_KINDS[k].label}` : `${n} ${DECOR_KINDS[k].plural}`)
  const facts: string[] = []
  if (parts.length) facts.push(`Der Raum ist geschmückt: ${parts.join(', ')}.`)
  if (Object.keys(f.tables).length) facts.push('Die Tische sind anders gestellt als früher.')
  return facts
}

// ── Hausrecht ──────────────────────────────────────────────────────────────
export const BAN_HOURS = [24, 24 * 7, 24 * 365 * 10] as const
export const banLabel = (hours: number) => hours <= 24 ? '24 Stunden' : hours <= 24 * 7 ? 'eine Woche' : 'auf Dauer'

export function banText(untilIso: string | null, nowMs: number): string | null {
  if (!untilIso) return null
  const until = Date.parse(untilIso)
  if (!Number.isFinite(until) || until <= nowMs) return null
  if (until - nowMs > 365 * 24 * 3600e3) return 'Du hast hier Hausverbot.'
  const when = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(until))
  return `Du hast hier Hausverbot bis ${when}.`
}
