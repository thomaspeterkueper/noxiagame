// lib/game/npcBrain.ts
// Erstellt:     14.06.2026
// Aktualisiert: 20.07.2026 — Phase C: runNpcTick (Persistenz-Schicht)
// Version:      2.0.0
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

import { PRICE_MAX } from './config'
import { BUILDINGS } from './buildings/index'
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
    const def = BUILDINGS[geb.entity_id]
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

// ── runNpcTick — Persistenz-Schicht ──────────────────────────────────────────
// Wird vom Cron-Job aufgerufen. Brain entscheidet, runNpcTick schreibt.
// Rückgabe: Zusammenfassung der ausgeführten Aktionen.

export interface RunNpcTickResult {
  actorId:  string
  name:     string
  aktionen: Array<{ typ: string; resource?: string; menge?: number; location?: string; grund: string }>
  errors:   string[]
}

export async function runNpcTick(
  supabase: ReturnType<typeof import('../supabase/service').createServiceClient>,
  actorId:  string,
  tick:     number
): Promise<RunNpcTickResult> {
  const errors: string[] = []

  // Actor laden
  const { data: actor } = await supabase
    .from('actors')
    .select('id, display_name, decision_weights')
    .eq('id', actorId)
    .single()
  if (!actor) return { actorId, name: '?', aktionen: [], errors: ['Actor nicht gefunden'] }

  // Bestand aus npc_ledger berechnen
  const { data: ledger } = await supabase
    .from('npc_ledger')
    .select('kind, resource, goods_delta, credit_delta')
    .eq('actor_id', actorId)
  const bestand: Record<string, number> = {}
  let treasury = 0
  for (const e of ledger ?? []) {
    treasury += Number(e.credit_delta ?? 0)
    if (e.resource) bestand[e.resource] = (bestand[e.resource] ?? 0) + Number(e.goods_delta ?? 0)
  }

  // Eigene Gebäude laden
  const { data: gebaeudRows } = await supabase
    .from('tile_entities')
    .select('entity_id, location_id, tile_col, locations(slug)')
    .eq('actor_id', actorId)
    .eq('entity_type', 'building')
  const gebaeude: NpcGebaeude[] = (gebaeudRows ?? []).map((g: any) => ({
    entity_id:   g.entity_id,
    location_id: g.location_id,
    location:    g.locations?.slug ?? '',
    tile_col:    g.tile_col,
  }))

  // Marktpreise laden
  const { data: preisRows } = await supabase
    .from('market_prices')
    .select('resource, buy_price, sell_price, locations(slug), stock:location_resources(stock)')
  const preise: MarktPreis[] = (preisRows ?? []).map((p: any) => ({
    resource:   p.resource,
    location:   p.locations?.slug ?? '',
    buy_price:  Number(p.buy_price),
    sell_price: Number(p.sell_price),
    stock:      p.stock?.[0]?.stock ?? undefined,
  }))

  const kontext: NpcKontext = {
    actor: { id: actor.id, decision_weights: actor.decision_weights as NpcDecisionWeights | null },
    bestand, treasury, gebaeude,
  }
  const welt: NpcWelt = { tick, preise }
  const aktionen = entscheideNpc(kontext, welt)
  const ausgefuehrt: RunNpcTickResult['aktionen'] = []

  for (const a of aktionen) {
    try {
      if (a.typ === 'produce') {
        // Produktion: Stock erhöhen + Ledger
        const { data: loc } = await supabase.from('locations').select('id').eq('slug', a.location).single()
        if (!loc) continue
        await supabase.from('location_resources').upsert(
          { location_id: loc.id, resource: a.resource, stock: 0 },
          { onConflict: 'location_id,resource', ignoreDuplicates: true }
        )
        await supabase.from('location_resources')
          .update({ stock: supabase.rpc('noop') })  // Trigger: stock += menge via separate RPC oder raw
        // Direkt via update mit Postgres expression
        await supabase.rpc('increment_stock', { p_location_id: loc.id, p_resource: a.resource, p_amount: a.menge })
        await supabase.from('npc_ledger').insert({
          actor_id: actorId, tick, kind: 'produce',
          resource: a.resource, goods_delta: a.menge, credit_delta: 0,
          note: a.grund,
        })
        ausgefuehrt.push({ typ: 'produce', resource: a.resource, menge: a.menge, location: a.location, grund: a.grund })

      } else if (a.typ === 'buy') {
        const { data: loc } = await supabase.from('locations').select('id').eq('slug', a.location).single()
        const { data: mp } = await supabase.from('market_prices')
          .select('buy_price').eq('location_id', loc?.id).eq('resource', a.resource).single()
        if (!loc || !mp) continue
        const preis = Number(mp.buy_price)
        if (preis > a.maxPreis) continue
        const kosten = preis * a.menge
        if (treasury - kosten < 0) continue
        // Stock abziehen
        await supabase.rpc('increment_stock', { p_location_id: loc.id, p_resource: a.resource, p_amount: -a.menge })
        await supabase.from('npc_ledger').insert({
          actor_id: actorId, tick, kind: 'buy',
          resource: a.resource, goods_delta: a.menge, credit_delta: -kosten,
          note: a.grund,
        })
        treasury -= kosten
        ausgefuehrt.push({ typ: 'buy', resource: a.resource, menge: a.menge, location: a.location, grund: a.grund })

      } else if (a.typ === 'sell') {
        const { data: loc } = await supabase.from('locations').select('id').eq('slug', a.location).single()
        const { data: mp } = await supabase.from('market_prices')
          .select('sell_price').eq('location_id', loc?.id).eq('resource', a.resource).single()
        if (!loc || !mp) continue
        const preis = Number(mp.sell_price)
        if (preis < a.minPreis) continue
        const einnahmen = preis * a.menge
        await supabase.rpc('increment_stock', { p_location_id: loc.id, p_resource: a.resource, p_amount: a.menge })
        await supabase.from('npc_ledger').insert({
          actor_id: actorId, tick, kind: 'sell',
          resource: a.resource, goods_delta: -a.menge, credit_delta: einnahmen,
          note: a.grund,
        })
        treasury += einnahmen
        ausgefuehrt.push({ typ: 'sell', resource: a.resource, menge: a.menge, location: a.location, grund: a.grund })

      } else if (a.typ === 'build') {
        if (treasury < a.cost) continue
        // Freie Kachel finden
        const { data: loc } = await supabase.from('locations').select('id').eq('slug', a.location).single()
        if (!loc) continue
        const { data: occupied } = await supabase.from('tile_entities')
          .select('tile_row, tile_col').eq('location_id', loc.id).eq('tile_level', 0)
        const occ = new Set((occupied ?? []).map((t: any) => `${t.tile_row},${t.tile_col}`))
        let row = -1, col = -1
        outer: for (let r = 4; r < 20; r++) {
          for (let c = 4; c < 28; c++) {
            if (!occ.has(`${r},${c}`)) { row = r; col = c; break outer }
          }
        }
        if (row < 0) continue
        await supabase.from('tile_entities').insert({
          actor_id: actorId, owner_class: 'CORPORATION', profile_id: null,
          entity_type: 'building', entity_id: a.building,
          location_id: loc.id, tile_level: 0, tile_row: row, tile_col: col,
        })
        await supabase.from('npc_ledger').insert({
          actor_id: actorId, tick, kind: 'build',
          resource: a.building, goods_delta: 0, credit_delta: -a.cost,
          note: a.grund,
        })
        treasury -= a.cost
        ausgefuehrt.push({ typ: 'build', resource: a.building, location: a.location, grund: a.grund })
      }
    } catch (err) {
      errors.push(`${a.typ} ${(a as any).resource ?? ''}: ${String(err)}`)
    }
  }

  return { actorId, name: actor.display_name, aktionen: ausgefuehrt, errors }
}
