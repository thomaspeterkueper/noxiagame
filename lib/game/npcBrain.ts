// lib/game/npcBrain.ts
// Erstellt:     14.06.2026
// Aktualisiert: 20.06.2026
//
// Deterministischer NPC-Brain (Phase A → C).
//
// REINE FUNKTION: gleiche Eingaben → gleiche Ausgaben. Kein Math.random,
// kein Date.now, kein DB-Zugriff, kein Schreiben. Der Brain liest NUR
// decision_weights — NICHT personality. personality bleibt strikt der
// Dialog-/KI-Schicht vorbehalten; so bleibt die Wirtschaft auditierbar.
//
// Phase C ergänzt 'produce', 'sell', 'build':
//   produce  – Gebäude-Output pro Tick (immer, unabhängig vom Preis)
//   sell     – Überschuss über reserve verkaufen (nur wenn Preis ≥ sell_floor)
//   build    – Expansion wenn Treasury ≥ treasury_min
//
// Aktionsreihenfolge: produce → sell → build → buy
// Der Brain entscheidet NUR. Persistenz ist Aufgabe von runNpcTick.

import { PRICE_MAX, BUILDABLE_ITEMS } from './config'
import { MARKET_RESOURCES } from './resources'

// ── NPC-spezifische Stellschrauben ───────────────────────────────────────────
export const NPC_BASIS_LAGER   = 100  // t — Basis-Zielbestand je Gut, skaliert mit stockpile_factor
export const NPC_KAUF_PRO_TICK = 20   // t — Kaufdeckel je Gut und Tick

const MARKT_GUETER = new Set<string>(MARKET_RESOURCES)

// ── Schnittstellen ────────────────────────────────────────────────────────────

export interface NpcDecisionWeights {
  // Phase A (Akkumulator-Käufer, HeliosCorp-Modus)
  preferred_goods?:  string[]
  buy_threshold?:    number    // 0..1 → Preisobergrenze als Anteil von PRICE_MAX
  stockpile_factor?: number    // Zielbestand = NPC_BASIS_LAGER × stockpile_factor

  // Phase C (Produzent-Modus: Goibniu / Belenus / Boann)
  role?:           'producer' | 'trader'
  sells?:          string[]     // Güter die dieser NPC aktiv verkauft
  sell_floor?:     number       // Mindestpreis (absolute Credits) unter dem nicht verkauft wird
  reserve?:        number       // t — Pflichtreserve, nicht verkaufen
  sell_per_tick?:  number       // t — Verkaufsdeckel je Gut und Tick
  expand?: {
    building:     string        // BUILDABLE_ITEMS-Schlüssel
    location:     string        // Ort-Slug
    cost:         number        // Credits (aus decision_weights, nicht config — NPC kann anders kalkulieren)
    treasury_min: number        // ab dieser Kasse wird expandiert
  }
}

export interface NpcGebaeude {
  entity_id:   string  // 'mine' | 'solar' | 'ice_drill' | ...
  location_id: string
  location:    string  // Slug
  tile_col:    number  // Kachel-Spalte — eindeutiger Ledger-Schlüssel (ref = "slug:col")
}

export interface NpcKontext {
  actor:    { id: string; decision_weights: NpcDecisionWeights | null }
  bestand:  Record<string, number>  // Netto-Lagerstand (Käufe + Produktion − Verkäufe)
  treasury: number                  // Σ credit_delta aus npc_ledger
  gebaeude: NpcGebaeude[]           // eigene tile_entities
}

export interface MarktPreis {
  resource:   string
  location:   string
  buy_price:  number
  sell_price: number
  stock?:     number
}

export interface NpcWelt {
  tick:   number
  preise: MarktPreis[]
}

export type NpcAktion =
  | {
      typ:       'buy'
      resource:  string
      location:  string
      menge:     number
      maxPreis:  number
      grund:     string
    }
  | {
      typ:       'produce'
      resource:  string
      location:  string   // wo das Gebäude steht
      menge:     number   // Output pro Tick (aus BUILDABLE_ITEMS)
      ref:       string   // "${location}:${tile_col}" — Ledger-Idempotenz-Schlüssel
      grund:     string
    }
  | {
      typ:        'sell'
      resource:   string
      location:   string
      menge:      number
      minPreis:   number  // sell_floor — Ausführung prüft lokalen sell_price ≥ minPreis
      grund:      string
    }
  | {
      typ:      'build'
      building: string   // BUILDABLE_ITEMS-Schlüssel
      location: string   // Slug
      cost:     number
      grund:    string
    }

// ── Hilfen ────────────────────────────────────────────────────────────────────
function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ── Der Brain ─────────────────────────────────────────────────────────────────
export function entscheideNpc(kontext: NpcKontext, welt: NpcWelt): NpcAktion[] {
  const w = kontext.actor.decision_weights ?? {}
  const aktionen: NpcAktion[] = []

  // ── 1) PRODUCE ──────────────────────────────────────────────────────────────
  // Jedes Gebäude dieses NPCs erzeugt seinen Output — immer, unabhängig vom
  // Preis. Der Output landet im Marktstock des jeweiligen Ortes (runNpcTick
  // schreibt in location_resources.stock und ins npc_ledger).
  for (const geb of kontext.gebaeude) {
    const def = BUILDABLE_ITEMS[geb.entity_id]
    if (!def?.produces) continue
    const { resource, amount } = def.produces
    aktionen.push({
      typ:      'produce',
      resource,
      location: geb.location,
      menge:    amount,
      ref:      `${geb.location}:${geb.tile_col}`,  // eindeutig je Gebäude
      grund:    `${geb.entity_id}@[col ${geb.tile_col}] @ ${geb.location} produziert ${amount} ${resource}/Tick`,
    })
  }

  // ── 2) SELL ─────────────────────────────────────────────────────────────────
  // Nur für Produzenten-NPCs (role = 'producer'). Verkauft Überschuss über
  // reserve in den Marktstock, wenn der lokale sell_price ≥ sell_floor.
  // Die Entscheidung ist preissensibel (nicht unter sell_floor), aber der
  // Markt reagiert trotzdem auf den zusätzlichen Stock — causal bleibt es.
  if (w.role === 'producer' && Array.isArray(w.sells)) {
    const sellFloor    = typeof w.sell_floor    === 'number' ? w.sell_floor    : 0
    const reserve      = typeof w.reserve       === 'number' ? w.reserve       : 0
    const sellPerTick  = typeof w.sell_per_tick === 'number' ? w.sell_per_tick : 20

    for (const gut of w.sells) {
      if (!MARKT_GUETER.has(gut)) continue
      const bestand = kontext.bestand[gut] ?? 0
      const ueberschuss = bestand - reserve
      if (ueberschuss <= 0) continue

      // Besten Markt finden: sell_price ≥ sell_floor, höchster Preis zuerst.
      // Nur Orte, wo der NPC ein passendes Gebäude hat, ODER alle Orte wenn
      // kein Gebäude-Constraint gesetzt (flexibler Händler).
      const markt = welt.preise
        .filter(p => p.resource === gut && p.sell_price >= sellFloor)
        .sort((a, b) => (b.sell_price - a.sell_price) || cmp(a.location, b.location))[0]

      if (!markt) continue  // kein Markt über dem Boden → warten

      const menge = Math.floor(Math.min(ueberschuss, sellPerTick))
      if (menge <= 0) continue

      aktionen.push({
        typ:      'sell',
        resource: gut,
        location: markt.location,
        menge,
        minPreis: sellFloor,
        grund:    `Bestand ${bestand} − Reserve ${reserve} = ${ueberschuss} Überschuss; sell_price ${markt.sell_price} ≥ Boden ${sellFloor} @ ${markt.location}`,
      })
    }
  }

  // ── 3) BUILD (Expansion) ─────────────────────────────────────────────────────
  // Wenn Treasury ≥ treasury_min: einmalig ein Gebäude bauen. NPCs bauen sofort
  // (keine Bauzeit-Ticks), Kosten werden aus der Treasury gebucht. Die Idempotenz
  // hängt am uniq_npc_ledger_event-Index in der DB (kind='build', ref=location).
  // Genau eine build-Aktion pro Tick (nicht mehrere Gebäude auf einmal).
  if (w.expand && kontext.treasury >= w.expand.treasury_min) {
    aktionen.push({
      typ:      'build',
      building: w.expand.building,
      location: w.expand.location,
      cost:     w.expand.cost,
      grund:    `Treasury ${kontext.treasury} ≥ Schwelle ${w.expand.treasury_min}; baue ${w.expand.building} @ ${w.expand.location}`,
    })
  }

  // ── 4) BUY (Akkumulator, Phase A-Logik unverändert) ─────────────────────────
  const preferred = (w.preferred_goods ?? []).filter(g => MARKT_GUETER.has(g))
  if (preferred.length > 0) {
    const stockpileFactor = typeof w.stockpile_factor === 'number' ? w.stockpile_factor : 1
    const threshold       = clamp01(typeof w.buy_threshold === 'number' ? w.buy_threshold : 0)
    const preisDeckel     = threshold * PRICE_MAX

    for (const gut of preferred) {
      const zielbestand = NPC_BASIS_LAGER * stockpileFactor
      const bestand     = kontext.bestand[gut] ?? 0
      const fehlmenge   = zielbestand - bestand
      if (fehlmenge <= 0) continue

      const markt = welt.preise
        .filter(p => p.resource === gut && p.buy_price <= preisDeckel)
        .sort((a, b) => (a.buy_price - b.buy_price) || cmp(a.location, b.location))[0]

      if (!markt) continue

      const verfuegbar = typeof markt.stock === 'number' ? markt.stock : Infinity
      const menge = Math.floor(Math.min(fehlmenge, NPC_KAUF_PRO_TICK, verfuegbar))
      if (menge <= 0) continue

      aktionen.push({
        typ:      'buy',
        resource: gut,
        location: markt.location,
        menge,
        maxPreis: markt.buy_price,
        grund: `Bestand ${bestand}/${zielbestand} ${gut}; Preis ${markt.buy_price} ≤ Deckel ${preisDeckel} @ ${markt.location}`,
      })
    }
  }

  return aktionen
}
