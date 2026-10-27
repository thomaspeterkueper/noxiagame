// lib/game/npcTrade.ts
// Erstellt:     12.10.2026
// Aktualisiert: 12.10.2026 — Erde als Quelle zugelassen; Frachtdauer aus der Entfernung (frachtTicks)
// Vorher:       12.10.2026 — Handelsfirma: Lieferung planen (kaufen, wo es billig ist; verschiffen;
//               verkaufen, wo es teuer ist) und Verkauf angekommener Ware
// Version:      1.1.0
//
// REINE FUNKTIONEN: kein DB-Zugriff, kein Zufall, keine Uhr.
//
// Regeln:
//  - Ware wird am Quellort zum Kaufpreis gekauft und bezahlt. Sie verlässt dort das Lager.
//  - Der Transport kostet Fracht und dauert. Unterwegs liegt die Ware in keinem Lager.
//  - Am Zielort wird sie zum dortigen Ankaufspreis verkauft und geht in dessen Lager.
//  - Geliefert wird nur, was der Zielort aufnehmen kann, und nur, was der Quellort
//    über seine eigene Versorgung hinaus abgeben kann.
//  - Es wird nichts erzwungen: ohne ausreichende Marge findet keine Lieferung statt.
//
// Alle Zahlen sind vorläufige Modellparameter.

export interface HandelsParameter {
  losT:               number    // t je Lieferung (eine Schiffsladung)
  mindestRendite:     number    // Gewinn / eingesetztes Kapital, ab dem geliefert wird
  frachtCrProEnergie: number    // Frachttarif je Energieeinheit der Strecke und Ladung
  deckungTicks:       number    // so viele Ticks Eigenverbrauch bleiben am Quellort liegen
  verkaufProTick:     number    // t je Gut, Ort und Tick
  gesperrteQuellen:   string[]  // Orte, an denen nicht eingekauft wird
  gueter:             string[]
}

export const HANDEL_STANDARD: HandelsParameter = {
  losT: 50,
  mindestRendite: 0.15,
  frachtCrProEnergie: 25,
  deckungTicks: 48,
  verkaufProTick: 20,
  // Die Erde ist als Quelle zugelassen (Entscheidung 12.10.2026). Begrenzt wird der
  // Zustrom durch Fracht, Lagergrenzen am Ziel und die dortige Preisreaktion.
  gesperrteQuellen: [],
  gueter: ['water', 'energy', 'metal', 'food'],
}

export interface HandelsMarkt {
  resource:     string
  location:     string
  buy_price:    number
  sell_price:   number
  stock?:       number
  capacity?:    number
  consumption?: number
}

// Frachtdauer. Zeitfaktor 60: ein Tick (1 h Echtzeit) sind 60 h Spielzeit = 2,5 Tage.
// Erde–Mond (3 Einheiten) dauert rund 3 Tage, also gut einen Tick → 0,4 Ticks je Einheit.
// Erde–Mars (rund 125–170 Einheiten) ergibt damit 50–68 Ticks, also 125–170 Spieltage.
// Gilt nur für Fracht; die Flugdauer der Spielerschiffe bleibt unberührt.
export const FRACHT_TICKS_JE_EINHEIT = 0.4

export function frachtTicks(distanz: number): number {
  return Math.max(1, Math.ceil(distanz * FRACHT_TICKS_JE_EINHEIT))
}

export interface Route { energy: number; ticks: number }

export interface Lieferung {
  resource:    string
  from:        string
  to:          string
  menge:       number
  kaufpreis:   number   // je t am Quellort
  fracht:      number   // gesamt
  stueckkosten: number  // (Kauf + Fracht) je t – Untergrenze für den Verkauf
  ankunftTick: number
  gewinnErwartet: number
  grund:       string
}

export interface HandelsLage {
  treasury: number
  tick:     number
  // Offene Positionen je "ort|gut": unterwegs dorthin oder dort noch unverkauft.
  offen:    Record<string, number>
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Beste lohnende Lieferung dieses Ticks – höchstens eine. */
export function planeLieferung(
  lage: HandelsLage,
  maerkte: HandelsMarkt[],
  route: (from: string, to: string) => Route | null,
  p: HandelsParameter = HANDEL_STANDARD,
): Lieferung | null {
  let beste: Lieferung | null = null
  for (const gut of p.gueter) {
    const m = maerkte.filter(x => x.resource === gut)
    for (const a of m) {
      if (p.gesperrteQuellen.includes(a.location)) continue
      if (typeof a.stock !== 'number' || !(a.buy_price > 0)) continue
      const abgebbar = a.stock - (a.consumption ?? 0) * p.deckungTicks
      if (abgebbar < 1) continue
      for (const b of m) {
        if (b.location === a.location) continue
        if (b.sell_price <= a.buy_price) continue
        if (typeof b.stock !== 'number' || typeof b.capacity !== 'number') continue
        // Eine offene Position je Zielort und Gut: erst verkaufen, dann nachliefern.
        if ((lage.offen[`${b.location}|${gut}`] ?? 0) > 0) continue
        const r = route(a.location, b.location)
        if (!r) continue
        const fracht = Math.round(r.energy * p.frachtCrProEnergie)
        const menge = Math.floor(Math.min(
          p.losT,
          abgebbar,
          b.capacity - b.stock,
          (lage.treasury - fracht) / a.buy_price,
        ))
        if (menge < 1) continue
        const kapital = menge * a.buy_price + fracht
        const gewinn = menge * b.sell_price - kapital
        if (gewinn / kapital < p.mindestRendite) continue
        const kandidat: Lieferung = {
          resource: gut, from: a.location, to: b.location, menge,
          kaufpreis: a.buy_price, fracht,
          stueckkosten: kapital / menge,
          ankunftTick: lage.tick + Math.max(1, Math.ceil(r.ticks)),
          gewinnErwartet: gewinn,
          grund: `${menge} t ${gut} ${a.location}→${b.location}: Kauf ${a.buy_price}, Verkauf ${b.sell_price}, Fracht ${fracht}, erwarteter Gewinn ${Math.round(gewinn)}`,
        }
        if (
          !beste || kandidat.gewinnErwartet > beste.gewinnErwartet ||
          (kandidat.gewinnErwartet === beste.gewinnErwartet &&
            (cmp(kandidat.resource, beste.resource) || cmp(kandidat.from, beste.from) || cmp(kandidat.to, beste.to)) < 0)
        ) beste = kandidat
      }
    }
  }
  return beste
}

export interface Lagerposten {
  location:     string
  resource:     string
  menge:        number   // angekommen und noch nicht verkauft
  stueckkosten: number   // gewichteter Einstand inkl. Fracht
}

export interface Verkauf { location: string; resource: string; menge: number; minPreis: number; grund: string }

/** Verkauft angekommene Ware am Zielort – nicht unter Einstand, nicht über die Lagergrenze. */
export function planeVerkaeufe(posten: Lagerposten[], maerkte: HandelsMarkt[], p: HandelsParameter = HANDEL_STANDARD): Verkauf[] {
  const out: Verkauf[] = []
  for (const l of [...posten].sort((x, y) => cmp(x.location, y.location) || cmp(x.resource, y.resource))) {
    if (l.menge < 1) continue
    const markt = maerkte.find(x => x.location === l.location && x.resource === l.resource)
    if (!markt || markt.sell_price < l.stueckkosten) continue
    const frei = typeof markt.capacity === 'number' && typeof markt.stock === 'number' ? markt.capacity - markt.stock : Infinity
    const menge = Math.floor(Math.min(l.menge, p.verkaufProTick, frei))
    if (menge < 1) continue
    out.push({ location: l.location, resource: l.resource, menge, minPreis: l.stueckkosten,
      grund: `${menge} t ${l.resource} @ ${l.location}: Preis ${markt.sell_price} ≥ Einstand ${Math.round(l.stueckkosten)}` })
  }
  return out
}

export interface SendungZeile { resource: string; amount: number; from: string; to: string; arrive_tick: number; unit_cost: number }

/** Leitet aus Sendungen und eigenen Verkäufen ab: Lagerposten an Zielorten und offene Positionen. */
export function handelsStand(sendungen: SendungZeile[], verkauft: Record<string, number>, tick: number) {
  const angekommen: Record<string, { menge: number; wert: number }> = {}
  const unterwegs: Record<string, number> = {}
  for (const s of sendungen) {
    const k = `${s.to}|${s.resource}`
    if (s.arrive_tick <= tick) {
      const e = (angekommen[k] ??= { menge: 0, wert: 0 })
      e.menge += s.amount; e.wert += s.amount * s.unit_cost
    } else unterwegs[k] = (unterwegs[k] ?? 0) + s.amount
  }
  const posten: Lagerposten[] = []
  const offen: Record<string, number> = { ...unterwegs }
  for (const [k, e] of Object.entries(angekommen)) {
    const rest = e.menge - (verkauft[k] ?? 0)
    if (rest <= 0) continue
    const [location, resource] = k.split('|')
    posten.push({ location, resource, menge: rest, stueckkosten: e.wert / e.menge })
    offen[k] = (offen[k] ?? 0) + rest
  }
  return { posten, offen }
}
