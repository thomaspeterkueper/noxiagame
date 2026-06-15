// lib/game/npcBrain.ts
// Erstellt:     14.06.2026
// Aktualisiert: 14.06.2026
//
// Deterministischer NPC-Brain (Phase A).
//
// REINE FUNKTION: gleiche Eingaben → gleiche Ausgaben. Kein Math.random,
// kein Date.now, kein DB-Zugriff, kein Schreiben. Der Brain liest NUR
// decision_weights — NICHT personality. personality bleibt strikt der
// Dialog-/KI-Schicht vorbehalten; so bleibt die Wirtschaft auditierbar.
//
// Idempotenz, Ausführung und Persistenz sind NICHT Aufgabe des Brains.
// Er entscheidet nur, WAS getan werden sollte. Das WIE (Tick-Hook,
// Idempotenz-Index, Schreiben in market_prices / ein Transaktions-Log)
// kommt erst in Phase B (runNpcTick). Dadurch ist der Brain gegen
// synthetische Weltzustände vollständig testbar, ohne ein Live-System
// anzufassen.
//
// v1 = reiner Akkumulator (nur 'buy'). 'sell'/'build' sind als Aktionstyp
// vorbereitet, aber noch nicht implementiert.

import { PRICE_MAX } from './config'
import { MARKET_RESOURCES } from './resources'

// ── NPC-spezifische Stellschrauben ───────────────────────────────────────────
// Bewusst hier statt in config.ts: das ist NPC-Tuning, kein Welt-Grundgesetz.
// Kann später nach config.ts wandern, wenn mehrere NPCs es teilen.
export const NPC_BASIS_LAGER   = 100  // t — Basis-Zielbestand je Gut, skaliert mit stockpile_factor
export const NPC_KAUF_PRO_TICK = 20   // t — Mengendeckel je Gut und Tick (gradueller Fußabdruck)

// Nur diese Güter sind handelbar; alles andere in preferred_goods wird ignoriert.
const MARKT_GUETER = new Set<string>(MARKET_RESOURCES)

// ── Schnittstelle ─────────────────────────────────────────────────────────────

// Auszug aus actors.decision_weights (jsonb). Alle Felder optional — fehlende
// Werte führen zu konservativem Verhalten (im Zweifel: nichts kaufen).
export interface NpcDecisionWeights {
  preferred_goods?:  string[]  // Güter, mit denen der Akteur handelt (Reihenfolge = Priorität)
  buy_threshold?:    number    // 0..1 → Preisobergrenze als Anteil von PRICE_MAX
  stockpile_factor?: number    // Zielbestand je Gut = NPC_BASIS_LAGER × stockpile_factor
}

export interface NpcKontext {
  actor:   { id: string; decision_weights: NpcDecisionWeights | null }
  bestand: Record<string, number>  // eigener Lagerstand je Gut in t (synthetisch in Tests, in Phase B aus DB)
}

// Ein Marktpreis-Eintrag, wie ihn die world-/price-Daten liefern.
// WICHTIG zur Preis-Semantik: buy_price ist der Preis, zu dem der MARKT verkauft
// — also das, was der NPC beim KAUF zahlt (die „Ask"). sell_price ist, was der
// Markt beim Ankauf zahlt. Der NPC kauft → relevant ist buy_price.
export interface MarktPreis {
  resource:   string
  location:   string   // slug, z.B. 'moon' | 'mars' | 'phobos'
  buy_price:  number
  sell_price: number
  stock?:     number   // verfügbarer Kolonie-Stock; deckelt die Kaufmenge (optional)
}

export interface NpcWelt {
  tick:   number
  preise: MarktPreis[]
}

export type NpcAktion =
  | {
      typ:      'buy'
      resource: string
      location: string
      menge:    number   // ganze Tonnen
      maxPreis: number   // Limit für die spätere Ausführung (= gesehener buy_price)
      grund:    string   // nachvollziehbare Begründung — Rohstoff fürs Transaktions-/Biografie-Log
    }
// später: | { typ: 'sell'; ... } | { typ: 'build'; ... }

// ── Hilfen (rein, deterministisch) ───────────────────────────────────────────
function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}
// Stabiler String-Vergleich für deterministischen Gleichstand-Tiebreak.
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ── Der Brain ─────────────────────────────────────────────────────────────────
//
// Strategie v1 (Akkumulator):
//   Für jedes bevorzugte Gut (in Prioritätsreihenfolge):
//     1. Zielbestand = NPC_BASIS_LAGER × stockpile_factor.
//        Bestand erreicht → kein Kaufinteresse (gibt den Markt frei).
//     2. Preisobergrenze = buy_threshold × PRICE_MAX.
//        Nur Märkte, deren buy_price ≤ Obergrenze liegt, qualifizieren.
//        Kein qualifizierender Markt → der NPC wartet. Das setzt einen
//        weichen Preisboden: er kauft Billiges weg, hört aber auf, sobald
//        es zu teuer wird → das Plateau bildet sich von selbst.
//     3. Günstigster qualifizierender Markt (Gleichstand → location-Slug
//        alphabetisch, rein deterministisch).
//     4. Menge = min(Fehlmenge, NPC_KAUF_PRO_TICK, verfügbarer Stock),
//        abgerundet auf ganze Tonnen → gradueller, sichtbarer Fußabdruck.
//
// Höchstens eine 'buy'-Aktion je Gut und Tick.
export function entscheideNpc(kontext: NpcKontext, welt: NpcWelt): NpcAktion[] {
  const w = kontext.actor.decision_weights ?? {}

  const preferred = (w.preferred_goods ?? []).filter(g => MARKT_GUETER.has(g))
  const stockpileFactor = typeof w.stockpile_factor === 'number' ? w.stockpile_factor : 1
  const threshold       = clamp01(typeof w.buy_threshold === 'number' ? w.buy_threshold : 0)
  const preisDeckel     = threshold * PRICE_MAX   // z.B. 0.65 × 500 = 325

  const aktionen: NpcAktion[] = []

  for (const gut of preferred) {
    const zielbestand = NPC_BASIS_LAGER * stockpileFactor
    const bestand     = kontext.bestand[gut] ?? 0
    const fehlmenge   = zielbestand - bestand
    if (fehlmenge <= 0) continue   // Zielbestand erreicht

    const markt = welt.preise
      .filter(p => p.resource === gut && p.buy_price <= preisDeckel)
      .sort((a, b) => (a.buy_price - b.buy_price) || cmp(a.location, b.location))[0]

    if (!markt) continue   // nirgends günstig genug → Boden hält

    const verfuegbar = typeof markt.stock === 'number' ? markt.stock : Infinity
    const menge = Math.floor(Math.min(fehlmenge, NPC_KAUF_PRO_TICK, verfuegbar))
    if (menge <= 0) continue

    aktionen.push({
      typ:      'buy',
      resource: gut,
      location: markt.location,
      menge,
      maxPreis: markt.buy_price,
      grund: `Bestand ${bestand}/${zielbestand} ${gut}; Preis ${markt.buy_price} \u2264 Deckel ${preisDeckel} @ ${markt.location}`,
    })
  }

  return aktionen
}
