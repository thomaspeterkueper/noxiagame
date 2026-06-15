// lib/game/npcBrain.test.ts
// Erstellt:     14.06.2026
// Aktualisiert: 14.06.2026
//
// Lokaler Demo-/Test-Runner für den deterministischen NPC-Brain.
// Kein Test-Framework nötig — `node` nach esbuild-Bundle, oder `npx tsx`.
// Zeigt das Verhalten gegen synthetische Weltzustände und prüft die
// Kern-Invarianten (Akkumulation, Preisdeckel, Determinismus).

import { entscheideNpc, NpcKontext, NpcWelt } from './npcBrain'

// HeliosCorp exakt wie im actors-Seed (Migration 012):
const HELIOS = {
  id: 'helios',
  decision_weights: {
    preferred_goods: ['metal', 'energy'],
    buy_threshold:   0.65,   // → Preisdeckel 0.65 × 500 = 325
    stockpile_factor: 2.5,   // → Zielbestand 100 × 2.5 = 250 t je Gut
  },
}

function zeige(titel: string, kontext: NpcKontext, welt: NpcWelt) {
  const aktionen = entscheideNpc(kontext, welt)
  console.log(`\n── ${titel} ─────────────────────────────────────`)
  console.log(`   Bestand: ${JSON.stringify(kontext.bestand)}`)
  if (aktionen.length === 0) {
    console.log('   → keine Aktion')
  } else {
    for (const a of aktionen) {
      console.log(`   → ${a.typ.toUpperCase()} ${a.menge}t ${a.resource} @ ${a.location} (max ${a.maxPreis}) | ${a.grund}`)
    }
  }
  return aktionen
}

let fails = 0
function pruefe(bedingung: boolean, was: string) {
  if (!bedingung) { fails++; console.log(`   ✘ FAIL: ${was}`) }
}

// ── Szenario 1: Akkumulation — kauft beide Güter, gedeckelt auf 20t ──────────
{
  const k: NpcKontext = { actor: HELIOS, bestand: { metal: 120, energy: 0 } }
  const welt: NpcWelt = { tick: 1, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 280, sell_price: 240 },
    { resource: 'metal',  location: 'mars',   buy_price: 400, sell_price: 360 },  // über Deckel
    { resource: 'energy', location: 'moon',   buy_price: 200, sell_price: 160 },
  ]}
  const a = zeige('1) Akkumulation', k, welt)
  pruefe(a.length === 2, 'kauft beide Güter')
  pruefe(a.some(x => x.resource === 'metal'  && x.location === 'phobos' && x.menge === 20), 'Metall @ phobos, 20t (Deckel)')
  pruefe(a.some(x => x.resource === 'energy' && x.location === 'moon'   && x.menge === 20), 'Energie @ moon, 20t (Deckel)')
}

// ── Szenario 2: Preisdeckel — alle Metall-Märkte zu teuer → Boden hält ──────
{
  const k: NpcKontext = { actor: HELIOS, bestand: { metal: 120, energy: 0 } }
  const welt: NpcWelt = { tick: 2, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 350, sell_price: 300 },  // > 325
    { resource: 'metal',  location: 'mars',   buy_price: 400, sell_price: 360 },  // > 325
    { resource: 'energy', location: 'moon',   buy_price: 200, sell_price: 160 },
  ]}
  const a = zeige('2) Preisdeckel hält', k, welt)
  pruefe(!a.some(x => x.resource === 'metal'), 'kein Metall-Kauf (alles über Deckel)')
  pruefe(a.some(x => x.resource === 'energy'), 'Energie wird trotzdem gekauft')
}

// ── Szenario 3: Zielbestand erreicht → keine Aktion ─────────────────────────
{
  const k: NpcKontext = { actor: HELIOS, bestand: { metal: 250, energy: 250 } }
  const welt: NpcWelt = { tick: 3, preise: [
    { resource: 'metal',  location: 'phobos', buy_price: 100, sell_price: 80 },
    { resource: 'energy', location: 'moon',   buy_price: 100, sell_price: 80 },
  ]}
  const a = zeige('3) Zielbestand erreicht', k, welt)
  pruefe(a.length === 0, 'keine Aktion bei vollem Lager')
}

// ── Szenario 4: Gleichstand-Tiebreak deterministisch (mars < phobos) ────────
{
  const k: NpcKontext = { actor: HELIOS, bestand: { metal: 0 } }
  const welt: NpcWelt = { tick: 4, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 300, sell_price: 260 },
    { resource: 'metal', location: 'mars',   buy_price: 300, sell_price: 260 },  // gleicher Preis
  ]}
  const a = zeige('4) Tiebreak', k, welt)
  pruefe(a[0]?.location === 'mars', 'Gleichstand → alphabetisch (mars vor phobos)')
  // Determinismus: zweimal identisch
  const b = entscheideNpc(k, welt)
  pruefe(JSON.stringify(a) === JSON.stringify(b), 'zweimal identische Ausgabe')
}

// ── Szenario 5: Stock-Limit deckelt unter NPC_KAUF_PRO_TICK ─────────────────
{
  const k: NpcKontext = { actor: HELIOS, bestand: { metal: 0 } }
  const welt: NpcWelt = { tick: 5, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 280, sell_price: 240, stock: 8 },
  ]}
  const a = zeige('5) Stock-Limit', k, welt)
  pruefe(a[0]?.menge === 8, 'Menge = verfügbarer Stock (8t), nicht 20t')
}

// ── Szenario 6: kein decision_weights → leer (sicher) ───────────────────────
{
  const k: NpcKontext = { actor: { id: 'leer', decision_weights: null }, bestand: {} }
  const welt: NpcWelt = { tick: 6, preise: [
    { resource: 'metal', location: 'phobos', buy_price: 50, sell_price: 40 },
  ]}
  const a = zeige('6) Ohne Gewichte', k, welt)
  pruefe(a.length === 0, 'ohne decision_weights keine Aktion')
}

console.log(`\n${fails === 0 ? '✓ alle Invarianten erfüllt' : `✘ ${fails} Fehlschläge`}`)
