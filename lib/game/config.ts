// ============================================================
// NOXIA – Spielkonfiguration Alpha 0.1
// ============================================================

// Ressourcenverbrauch pro 100 Einwohner pro Tick
export const CONSUMPTION_PER_100 = {
  water:  1.0,
  energy: 0.5,
  metal:  0.2,
} as const

// Basisproduktion pro Gebäude pro Tick
export const BUILDING_PRODUCTION = {
  mine:    { resource: 'metal',  amount: 5 },
  solar:   { resource: 'energy', amount: 4 },
  habitat: { resource: null,     amount: 0 },
} as const

// Gebäudekosten in Credits
export const BUILDING_COSTS = {
  mine:    500,
  solar:   400,
  habitat: 800,
} as const

// Bevölkerungswachstum pro Tick
export const GROWTH_RATE   = 0.0100  // +1% wenn versorgt
export const DECLINE_RATE  = 0.0200  // -2% wenn nicht versorgt

// Preisanpassung pro Tick
// Preis steigt wenn Lager knapp, sinkt wenn Lager voll
export const PRICE_PRESSURE_HIGH  = 1.05  // +5% wenn stock < LOW_THRESHOLD
export const PRICE_PRESSURE_LOW   = 0.96  // -4% wenn stock > HIGH_THRESHOLD
export const STOCK_LOW_THRESHOLD  = 50    // unter 50 → Preis steigt
export const STOCK_HIGH_THRESHOLD = 400   // über 400 → Preis sinkt

// Preisgrenzen (verhindert extreme Ausschläge)
export const PRICE_MIN = 10
export const PRICE_MAX = 500

// ────────────────────────────────────────────────────────────
// Transaktionsbasierter Preisimpuls (Spot-Handel, /api/game/trade)
// ────────────────────────────────────────────────────────────
// Jede gehandelte Tonne verschiebt den lokalen Preis LINEAR:
//   Kauf:     buy_price  × (1 + PRICE_IMPULSE_PER_TON × menge)   → teurer
//   Verkauf:  sell_price × (1 − PRICE_IMPULSE_PER_TON × menge)   → billiger
// Schließt die Intra-Tick-Arbitrage: die Route entwertet sich beim Befahren.
// Geclamped auf PRICE_MIN/MAX.
//
// Gerichtet (Kauf hebt nur buy, Verkauf senkt nur sell) → die Spanne wächst
// stets, der Constraint sell_price < buy_price bleibt durch den Impuls allein
// immer erhalten. Nur der Tick zieht die Preise wieder zusammen.
//
// Kalibrierung (linear): 100 t bei 0,003 ⇒ +30 % (Mond-Wasser 120 → 156).
// Hochdrehen = Route killt sich schneller, runter = Arbitrage hält länger.
export const PRICE_IMPULSE_PER_TON = 0.003   // 0,3 % je Tonne

// Auftrags-Generator
export const ORDER_MIN_AMOUNT  = 10
export const ORDER_MAX_AMOUNT  = 30
export const ORDER_REWARD_MULT = 1.3   // Belohnung = Marktpreis × 1.3
export const ORDER_EXPIRE_HOURS = 24

// Punkt 5: Auftragsgröße = Defizit/Tick × Deckungsfenster.
// Der Auftrag deckt so viele Ticks des tatsächlichen Mangels (consumption −
// production). Koppelt die Größe ehrlich an den Bedarf der Kolonie: große
// Kolonien fordern große Lieferungen, kleine kleine. N=4 macht den größten
// realistischen Auftrag etwa frachtergroß (~100t). ORDER_MIN_AMOUNT bleibt
// Untergrenze (kleine Defizite lohnen sonst keine Fahrt). Kein Deckel nach
// oben — wächst eine Kolonie, soll der Auftrag groß sein (Anreiz Schwerfrachter).
export const ORDER_COVERAGE_TICKS = 4

// Cron Secret Header
export const CRON_SECRET_HEADER = 'x-cron-secret'

// Startkapital neuer Spieler
export const STARTING_CREDITS = 5000

// Frachter-Laderaum
export const SHIP_CARGO_MAX = 100

// Baubare Objekte mit Kosten und Bauzeit
export const BUILDABLE_ITEMS: Record<string, {
  type:             'building' | 'ship' | 'module'
  name:             string
  cost:             number
  buildTimeTicks:   number   // Bauzeit in Ticks (1 Tick = 1 Cron-Durchlauf)
  produces?:         { resource: string; amount: number }
  populationBonus?:  number
  allowedLocations?: string[]  // undefined = überall baubar
  description:       string
}> = {
  mine: {
    type: 'building', name: 'Mine',
    cost: 1500, buildTimeTicks: 2,
    produces: { resource: 'metal', amount: 5 },
    description: '+5 Metall pro Tick',
  },
  solar: {
    type: 'building', name: 'Solarfeld',
    cost: 1200, buildTimeTicks: 1,
    produces: { resource: 'energy', amount: 4 },
    description: '+4 Energie pro Tick',
  },
  habitat: {
    type: 'building', name: 'Habitat',
    cost: 2000, buildTimeTicks: 3,
    populationBonus: 100,
    description: '+100 max. Bevölkerung',
  },
  scanner: {
    type: 'building', name: 'Scanner',
    cost: 1800, buildTimeTicks: 2,
    description: 'Macht Anomalien der Kolonie sichtbar',
  },
  ice_drill: {
    type: 'building', name: 'Eisbohrung',
    cost: 2500, buildTimeTicks: 3,
    produces: { resource: 'water', amount: 4 },
    allowedLocations: ['moon', 'mars'],
    description: '+4 Wasser/Tick — Shackleton-Eis',
  },
  water_recycler: {
    type: 'building', name: 'Wasserrecycler',
    cost: 2000, buildTimeTicks: 2,
    produces: { resource: 'water', amount: 2 },
    allowedLocations: ['mars'],
    description: '+2 Wasser/Tick — Atmosphären-Kondensation',
  },
  bank: {
    type: 'building', name: 'Bank',
    cost: 3000, buildTimeTicks: 2,
    description: 'Einlagen (+0.5%/Tick) · Kredite bis 50.000 Cr · Kreditlimit wächst mit Handelsvolumen',
  },
}
// Vorbereitete Gebäude — im Bau-Dialog ausgegraut sichtbar, noch nicht baubar.
// Sobald ein Typ eine echte Funktion bekommt, wandert er nach BUILDABLE_ITEMS.
// Siehe SPEC_gebaeude_katalog.md.
export const PLANNED_BUILDINGS: { id: string; name: string; hint: string }[] = [
  { id: 'warehouse',       name: 'Warenhaus',     hint: 'Lagerkapazität' },
  { id: 'tank',            name: 'Silo',          hint: 'Flüssigkeits-/Gasspeicher' },
  { id: 'oxygen_recycler', name: 'O₂-Recycler',   hint: 'Lebenserhaltung' },
  // water_plant → standortspezifisch: ice_drill (Mond), water_recycler (Mars)
  { id: 'smelter',         name: 'Schmelze',      hint: 'Metall → Bauteile' },
  { id: 'admin',           name: 'Verwaltung',    hint: 'Kolonieverwaltung' },
  // school → jetzt baubar (BUILDABLE_ITEMS)
  { id: 'bar',             name: 'Bar',           hint: 'Zufriedenheit' },
  // bank → jetzt baubar (BUILDABLE_ITEMS)
]


// Maximaler Verhandlungsaufschlag über die Basis-Belohnung.
export const ORDER_BONUS_MAX = 0.5   // bis zu +50%

// Berechnet die maximale Belohnung eines Auftrags aus seiner Dringlichkeit.
//   reward    – Basis-Belohnung (trade_orders.reward)
//   expiresAt – ISO-String oder null (trade_orders.expires_at)
//   stock     – aktueller Lagerstand der Zielkolonie für diese Ressource (oder null)
//
// Dringlichkeit steigt bei wenig Restlaufzeit und knappem Lager.
// Ergebnis ist eine ganze Zahl (gerundet).
export function orderMaxReward(
  reward: number,
  expiresAt: string | null,
  stock: number | null,
): number {
  let urgency = 0.25 // Grunddringlichkeit

  if (expiresAt) {
    const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / 3.6e6
    if (hoursLeft < 6) urgency += 0.15
    if (hoursLeft < 2) urgency += 0.10
  }

  if (stock != null && stock < 30) urgency += 0.15

  return Math.round(reward * (1 + Math.min(ORDER_BONUS_MAX, urgency)))
}
