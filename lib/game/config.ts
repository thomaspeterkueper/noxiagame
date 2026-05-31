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
export const PRICE_MAX = 50

// Auftrags-Generator
export const ORDER_MIN_AMOUNT  = 10
export const ORDER_MAX_AMOUNT  = 30
export const ORDER_REWARD_MULT = 1.3   // Belohnung = Marktpreis × 1.3
export const ORDER_EXPIRE_HOURS = 24

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
  produces?:        { resource: string; amount: number }
  populationBonus?: number
  description:      string
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
}