// lib/game/npcBrain.test.ts
// Erstellt:     14.06.2026
// Aktualisiert: 20.06.2026
//
// Lokaler Demo-/Test-Runner für den deterministischen NPC-Brain (Phase A → C).
// Kein Test-Framework nötig — npx tsx lib/game/npcBrain.test.ts
//
// Abdeckung:
//   Phase A: buy (Akkumulator, Preisdeckel, Tiebreak, Stock-Limit)
//   Phase C: produce (Gebäude), sell (Überschuss, sell_floor), build (Treasury)

import { entscheideNpc, NpcKontext, NpcWelt } from './npcBrain'

// ── Hilfen ────────────────────────────────────────────────────────────────────
function ctx(
  actor: NpcKontext['actor'],
  bestand: Record<string, number>,
  treasury = 0,
  gebaeude: NpcKontext['gebaeude'] = [],
): NpcKontext {
  return { actor, bestand, treasury, gebaeude }
}

function zeige(titel: string, kontext: NpcKontext, welt: NpcWelt) {
  const aktionen = entscheideNpc(kontext, welt)
  console.log(`\n── ${titel} ─────────────────────────────────────`)
  console.log(`   Bestand: ${JSON.stringify(kontext.bestand)}  Treasury: ${kontext.treasury}`)
  console.log(`   Gebäude: ${kontext.gebaeude.map(g => `${g.entity_id}@${g.location}`).join(', ') || '–'}`)
  if (aktionen.length === 0) {
    console.log('   → keine Aktion')
  } else {
    for (const a of aktionen) {
      if (a.typ === 'buy')     console.log(`   → BUY     ${a.menge}t ${a.resource} @ ${a.location} (max ${a.maxPreis})`)
      if (a.typ === 'produce') console.log(`   → PRODUCE ${a.menge}t ${a.resource} @ ${a.location}`)
      if (a.typ === 'sell')    console.log(`   → SELL    ${a.menge}t ${a.resource} @ ${a.location} (min ${a.minPreis})`)
      if (a.typ === 'build')   console.log(`   → BUILD   ${a.building} @ ${a.location} (Kosten ${a.cost})`)
      console.log(`      ${a.grund}`)
    }
  }
  return aktionen
}

let fails = 0
function pruefe(bedingung: boolean, was: string) {
  if (!bedingung) { fails++; console.log(`   ✘ FAIL: ${was}`) }
}

// HeliosCorp (Phase A — reiner Akkumulator, keine Gebäude, kein produce/sell/build)
const HELIOS = {
  id: 'helios',
  decision_weights: {
    preferred_goods: ['metal', 'energy'],
    buy_threshold:   0.65,
    stockpile_factor: 2.5,
  },
}

// Goibniu (Phase C — Produzent)
const GOIBNIU = {
  id: 'a0000000-0000-4000-8000-000000000001',
  decision_weights: {
    role:          'producer' as const,
    sells:         ['metal'],
    sell_floor:    25,
    reserve:       40,
    sell_per_tick: 20,
    expand: { building: 'mine', location: 'moon', cost: 1500, treasury_min: 8000 },
  },
}

// ── Phase A: Akkumulator (HeliosCorp) ────────────────────────────────────────

// 1) Kauft beide Güter, Mengendeckel 20t
{
  const k = ctx(HELIOS, { metal: 120, energy: 0 })
  const w: NpcWelt = { tick: 1, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 280, sell_price: 240 },
    { resource: 'metal',  location: 'mars',   buy_price: 400, sell_price: 360 },
    { resource: 'energy', location: 'moon',   buy_price: 200, sell_price: 160 },
  ]}
  const a = zeige('1) Buy – Akkumulation', k, w)
  pruefe(a.some(x => x.typ === 'buy' && x.resource === 'metal'  && x.location === 'phobos'), 'Metall @ phobos')
  pruefe(a.some(x => x.typ === 'buy' && x.resource === 'energy' && x.location === 'moon'),   'Energie @ moon')
}

// 2) Preisdeckel hält
{
  const k = ctx(HELIOS, { metal: 120, energy: 0 })
  const w: NpcWelt = { tick: 2, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 350, sell_price: 300 },
    { resource: 'metal',  location: 'mars',   buy_price: 400, sell_price: 360 },
    { resource: 'energy', location: 'moon',   buy_price: 200, sell_price: 160 },
  ]}
  const a = zeige('2) Buy – Preisdeckel hält', k, w)
  pruefe(!a.some(x => x.typ === 'buy' && x.resource === 'metal'), 'kein Metall-Kauf über Deckel')
  pruefe( a.some(x => x.typ === 'buy' && x.resource === 'energy'), 'Energie wird trotzdem gekauft')
}

// 3) Zielbestand erreicht → keine Buy-Aktion
{
  const k = ctx(HELIOS, { metal: 250, energy: 250 })
  const w: NpcWelt = { tick: 3, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 100, sell_price: 80 },
    { resource: 'energy', location: 'moon',   buy_price: 100, sell_price: 80 },
  ]}
  const a = zeige('3) Buy – Zielbestand erreicht', k, w)
  pruefe(a.filter(x => x.typ === 'buy').length === 0, 'keine Buy-Aktion bei vollem Lager')
}

// 4) Tiebreak deterministisch (mars < phobos alphabetisch)
{
  const k = ctx(HELIOS, { metal: 0 })
  const w: NpcWelt = { tick: 4, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 300, sell_price: 260 },
    { resource: 'metal', location: 'mars',   buy_price: 300, sell_price: 260 },
  ]}
  const a = zeige('4) Buy – Tiebreak', k, w)
  const buyMetal = a.find(x => x.typ === 'buy' && x.resource === 'metal')
  pruefe(buyMetal?.location === 'mars', 'Gleichstand → alphabetisch mars vor phobos')
  const b = entscheideNpc(k, w)
  pruefe(JSON.stringify(a) === JSON.stringify(b), 'Determinismus: zweimal identisch')
}

// 5) Stock-Limit deckelt unter NPC_KAUF_PRO_TICK
{
  const k = ctx(HELIOS, { metal: 0 })
  const w: NpcWelt = { tick: 5, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 280, sell_price: 240, stock: 8 },
  ]}
  const a = zeige('5) Buy – Stock-Limit', k, w)
  const buy = a.find(x => x.typ === 'buy' && x.resource === 'metal')
  pruefe((buy as any)?.menge === 8, 'Menge = Stock (8t), nicht 20t')
}

// 6) Kein decision_weights → leer
{
  const k = ctx({ id: 'leer', decision_weights: null }, {})
  const w: NpcWelt = { tick: 6, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 50, sell_price: 40 },
  ]}
  const a = zeige('6) Buy – ohne Gewichte', k, w)
  pruefe(a.length === 0, 'keine Aktion ohne decision_weights')
}

// ── Phase C: Produzent (Goibniu) ─────────────────────────────────────────────

// 7) Produce — Mine auf dem Mond erzeugt 5t Metall
{
  const k = ctx(
    GOIBNIU,
    { metal: 50 },
    5000,
    [{ entity_id: 'mine', location_id: 'loc-moon', location: 'moon', tile_col: 11 }],
  )
  const w: NpcWelt = { tick: 7, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('7) Produce – Mine@moon', k, w)
  pruefe(a.some(x => x.typ === 'produce' && x.resource === 'metal' && x.location === 'moon'), 'produce metal @ moon')
  const prod = a.find(x => x.typ === 'produce') as any
  pruefe(prod?.menge === 5, 'Mine produziert 5t/Tick')
  pruefe(prod?.ref === 'moon:11', 'ref = "moon:11" (Ledger-Schlüssel)')
}

// 8) Sell — Überschuss über reserve (40t) verkaufen, wenn Preis ≥ sell_floor (25)
{
  const k = ctx(GOIBNIU, { metal: 90 }, 5000)  // 90 − 40 reserve = 50 Überschuss
  const w: NpcWelt = { tick: 8, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('8) Sell – Überschuss', k, w)
  pruefe(a.some(x => x.typ === 'sell' && x.resource === 'metal'), 'sell metal')
  const sell = a.find(x => x.typ === 'sell') as any
  pruefe(sell?.menge === 20, 'Verkaufsdeckel 20t (sell_per_tick)')
}

// 9) Sell — kein Verkauf wenn Preis unter sell_floor (25)
{
  const k = ctx(GOIBNIU, { metal: 90 }, 5000)
  const w: NpcWelt = { tick: 9, preise: [
    { resource: 'metal', location: 'moon', buy_price: 30, sell_price: 20 },  // sell_price 20 < floor 25
  ]}
  const a = zeige('9) Sell – Preis unter sell_floor', k, w)
  pruefe(!a.some(x => x.typ === 'sell'), 'kein Verkauf unter sell_floor')
}

// 10) Build — Treasury ≥ treasury_min (8000) → expand
{
  const k = ctx(GOIBNIU, { metal: 40 }, 10000)  // 10000 ≥ 8000
  const w: NpcWelt = { tick: 10, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('10) Build – Treasury ausreichend', k, w)
  pruefe(a.some(x => x.typ === 'build' && x.building === 'mine'), 'build mine')
}

// 11) Build — Treasury < treasury_min → kein Build
{
  const k = ctx(GOIBNIU, { metal: 40 }, 3000)  // 3000 < 8000
  const w: NpcWelt = { tick: 11, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('11) Build – Treasury zu niedrig', k, w)
  pruefe(!a.some(x => x.typ === 'build'), 'kein Build wenn Treasury zu niedrig')
}

// 12) Kombiniert — produce + sell + build gleichzeitig
{
  const k = ctx(
    GOIBNIU,
    { metal: 90 },
    10000,
    [{ entity_id: 'mine', location_id: 'loc-moon', location: 'moon', tile_col: 11 }],
  )
  const w: NpcWelt = { tick: 12, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('12) Kombiniert – produce + sell + build', k, w)
  pruefe(a.some(x => x.typ === 'produce'), 'produce vorhanden')
  pruefe(a.some(x => x.typ === 'sell'),    'sell vorhanden')
  pruefe(a.some(x => x.typ === 'build'),   'build vorhanden')
  const typen = a.map(x => x.typ)
  const pIdx = typen.indexOf('produce')
  const sIdx = typen.indexOf('sell')
  const bIdx = typen.indexOf('build')
  pruefe(pIdx < sIdx && sIdx < bIdx, 'Reihenfolge: produce < sell < build')
}

// 13) Zwei Minen — beide produzieren, zwei verschiedene refs
{
  const k = ctx(
    GOIBNIU,
    { metal: 40 },
    5000,
    [
      { entity_id: 'mine', location_id: 'loc-moon', location: 'moon', tile_col: 11 },
      { entity_id: 'mine', location_id: 'loc-moon', location: 'moon', tile_col: 10 },
    ],
  )
  const w: NpcWelt = { tick: 13, preise: [
    { resource: 'metal', location: 'moon', buy_price: 60, sell_price: 40 },
  ]}
  const a = zeige('13) Zwei Minen – beide produzieren', k, w)
  const produces = a.filter(x => x.typ === 'produce')
  pruefe(produces.length === 2, 'zwei produce-Aktionen')
  const refs = produces.map(x => (x as any).ref)
  pruefe(refs.includes('moon:11') && refs.includes('moon:10'), 'refs eindeutig: moon:11 + moon:10')
}

console.log(`\n${fails === 0 ? '✓ alle Invarianten erfüllt' : `✘ ${fails} Fehlschläge`}`)
