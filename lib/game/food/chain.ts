// Lebensmittelkette als Fachmodell (NOXIA-FOOD-0002).
//
// Ortsunabhängig: Seelenberg ist Testgebiet, nicht Definition. Dieselben Verfahren laufen
// in Sundern, Frankfurt, auf dem Mars oder in Stationen – ein Ort wählt nur, welche
// Verfahren seine Umgebung erlaubt (`environments`).
//
// Reine Funktionen ohne eigenen Zustand. Bestand, Lager, Fracht und Tick gehören dem Core
// (location_resources, logistics_inventories, transport_jobs); dieses Modul beschreibt nur,
// was ein Verfahren braucht und liefert, wie lange Güter halten und wie sich Engpässe
// fortpflanzen. Transport ist hier nur eine Lieferzeit – die Route rechnet das Erdmodell.
//
// Alle Zahlen sind vorläufige Modellparameter (Größenordnung realer Verfahren).
// Kanonische Werte kommen über den Knowledge Graph (Request im Entscheidungsdokument).

export type Unit = 'kg' | 'MWh'

export type Good =
  | 'grain' | 'flour' | 'bran' | 'bread' | 'potatoes' | 'vegetables'
  | 'salt' | 'yeast' | 'seed' | 'water' | 'energy' | 'food'

export type StorageClass = 'dry' | 'cool' | 'tank' | 'grid'

export type GoodSpec = {
  good: Good
  label: string
  unit: Unit
  /** Mittlere Haltbarkeit in Spieltagen bei passender Lagerung; null = verdirbt nicht. */
  shelfLifeDays: number | null
  storage: StorageClass
  /** Nährwert je kg, wenn das Gut direkt gegessen wird; 0 = kein Lebensmittel für Haushalte. */
  kcalPerKg: number
}

export const GOODS: Record<Good, GoodSpec> = {
  grain:      { good: 'grain',      label: 'Getreide',     unit: 'kg',  shelfLifeDays: 365,  storage: 'dry',  kcalPerKg: 0 },
  flour:      { good: 'flour',      label: 'Mehl',         unit: 'kg',  shelfLifeDays: 180,  storage: 'dry',  kcalPerKg: 0 },
  bran:       { good: 'bran',       label: 'Kleie',        unit: 'kg',  shelfLifeDays: 90,   storage: 'dry',  kcalPerKg: 0 },
  bread:      { good: 'bread',      label: 'Brot',         unit: 'kg',  shelfLifeDays: 4,    storage: 'dry',  kcalPerKg: 2500 },
  potatoes:   { good: 'potatoes',   label: 'Kartoffeln',   unit: 'kg',  shelfLifeDays: 150,  storage: 'cool', kcalPerKg: 770 },
  vegetables: { good: 'vegetables', label: 'Gemüse',       unit: 'kg',  shelfLifeDays: 10,   storage: 'cool', kcalPerKg: 300 },
  salt:       { good: 'salt',       label: 'Salz',         unit: 'kg',  shelfLifeDays: null, storage: 'dry',  kcalPerKg: 0 },
  yeast:      { good: 'yeast',      label: 'Hefe',         unit: 'kg',  shelfLifeDays: 14,   storage: 'cool', kcalPerKg: 0 },
  seed:       { good: 'seed',       label: 'Saatgut',      unit: 'kg',  shelfLifeDays: 365,  storage: 'dry',  kcalPerKg: 0 },
  water:      { good: 'water',      label: 'Wasser',       unit: 'kg',  shelfLifeDays: null, storage: 'tank', kcalPerKg: 0 },
  energy:     { good: 'energy',     label: 'Strom',        unit: 'MWh', shelfLifeDays: null, storage: 'grid', kcalPerKg: 0 },
  // Bestehendes Core-Gut (NOXIA-FOOD-0001): verzehrfertige Grundnahrung, Ration.
  food:       { good: 'food',       label: 'Grundnahrung', unit: 'kg',  shelfLifeDays: 365,  storage: 'dry',  kcalPerKg: 2000 },
}

/** Tagesbedarf einer Person (Erwachsene, mittlere Aktivität). */
export const KCAL_PER_PERSON_DAY = 2200

export type Environment = 'earth_open' | 'earth_indoor' | 'habitat'

export type Flow = { good: Good; amount: number }

export type Process = {
  code: string
  label: string
  facility: 'field' | 'mill' | 'bakery' | 'hydroponics' | 'cellar'
  environments: Environment[]
  /** Je Durchgang (Charge). Strom und Wasser stehen als Güter in den Eingängen. */
  inputs: Flow[]
  outputs: Flow[]
  durationMinutes: number
  labor: { skillCode: string; personHours: number }
  /** Nur in diesen Monaten (1–12) möglich, z. B. Ernte; fehlt = ganzjährig. */
  months?: number[]
}

export const PROCESSES: Record<string, Process> = {
  // Erde, Feld: 1 ha Weizen, Ernte einmal im Jahr.
  wheat_harvest: {
    code: 'wheat_harvest', label: 'Weizenernte (1 ha)', facility: 'field', environments: ['earth_open'],
    inputs: [{ good: 'seed', amount: 180 }, { good: 'energy', amount: 0.3 }],
    outputs: [{ good: 'grain', amount: 7500 }],
    durationMinutes: 6 * 60, labor: { skillCode: 'farming', personHours: 10 }, months: [7, 8],
  },
  potato_harvest: {
    code: 'potato_harvest', label: 'Kartoffelernte (1 ha)', facility: 'field', environments: ['earth_open'],
    inputs: [{ good: 'potatoes', amount: 2500 }, { good: 'energy', amount: 0.5 }],
    outputs: [{ good: 'potatoes', amount: 40000 }],
    durationMinutes: 10 * 60, labor: { skillCode: 'farming', personHours: 30 }, months: [9, 10],
  },
  // Mühle: Ausmahlgrad 75 %, Rest Kleie (Futter).
  milling: {
    code: 'milling', label: 'Mahlen (1 t Getreide)', facility: 'mill', environments: ['earth_open', 'earth_indoor', 'habitat'],
    inputs: [{ good: 'grain', amount: 1000 }, { good: 'energy', amount: 0.04 }],
    outputs: [{ good: 'flour', amount: 750 }, { good: 'bran', amount: 250 }],
    durationMinutes: 120, labor: { skillCode: 'milling', personHours: 2 },
  },
  // Bäckerei: 100 kg Mehl → 150 kg Brot (Teigausbeute ~165 %, Backverlust ~10 %).
  baking: {
    code: 'baking', label: 'Backen (100 kg Mehl)', facility: 'bakery', environments: ['earth_open', 'earth_indoor', 'habitat'],
    inputs: [{ good: 'flour', amount: 100 }, { good: 'water', amount: 62 }, { good: 'salt', amount: 2 }, { good: 'yeast', amount: 2 }, { good: 'energy', amount: 0.05 }],
    outputs: [{ good: 'bread', amount: 150 }],
    durationMinutes: 240, labor: { skillCode: 'baking', personHours: 8 },
  },
  // Habitat: Hydroponik-Modul, Tagesertrag Blattgemüse; Wasser fast vollständig im Kreislauf.
  hydroponic_greens: {
    code: 'hydroponic_greens', label: 'Hydroponik (Tagesertrag eines Moduls)', facility: 'hydroponics', environments: ['earth_indoor', 'habitat'],
    inputs: [{ good: 'water', amount: 20 }, { good: 'energy', amount: 0.15 }],
    outputs: [{ good: 'vegetables', amount: 10 }],
    durationMinutes: 24 * 60, labor: { skillCode: 'gardening', personHours: 1 },
  },
}

export type Stock = Partial<Record<Good, number>>

// ── Einheiten (Entscheidung Thomas, 27.10.2026) ─────────────────────────────────────────
// Fachmodell und Oberfläche rechnen in kg (große Mengen als t angezeigt), persistente
// Warenbuchungen in ganzzahligen Gramm – Salz, Hefe und Teilchargen ohne Rundungsfehler.
// Strom bleibt MWh (NOXIA-ENERGY-0001).

export const GRAMS_PER_KG = 1000

/** kg → ganzzahlige Gramm für die Buchung im Core. */
export function toGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG)
}

export function kgFromGrams(grams: number): number {
  return grams / GRAMS_PER_KG
}

/** Anzeige: unter 1 kg in g, bis 1 t in kg, darüber in t (deutsche Schreibweise). */
export function formatMass(kg: number): string {
  const n = (v: number, digits: number) => v.toLocaleString('de-DE', { maximumFractionDigits: digits })
  const abs = Math.abs(kg)
  if (abs < 1) return `${n(kg * GRAMS_PER_KG, 0)} g`
  if (abs < 1000) return `${n(kg, abs < 10 ? 2 : 1)} kg`
  return `${n(kg / 1000, 2)} t`
}

const amount = (s: Stock, g: Good) => s[g] ?? 0

/** Verfahren, die eine Umgebung erlaubt – derselbe Katalog für jeden Ort. */
export function processesFor(environment: Environment): Process[] {
  return Object.values(PROCESSES).filter(p => p.environments.includes(environment))
}

export type RunResult = {
  batches: number
  stock: Stock
  /** Was die Menge begrenzt hat; null = gewünschte Menge vollständig gelaufen. */
  limitedBy: Good | 'labor' | 'season' | null
}

/**
 * Lässt ein Verfahren höchstens `wantedBatches`-mal laufen – aber nur, soweit alle Eingänge
 * im Bestand liegen und Arbeitszeit reicht. Kein Gut entsteht ohne seine Eingänge.
 */
export function runProcess(stock: Stock, process: Process, wantedBatches: number, laborHours = Infinity, month?: number): RunResult {
  if (process.months && month != null && !process.months.includes(month)) {
    return { batches: 0, stock: { ...stock }, limitedBy: 'season' }
  }
  let batches = Math.max(0, Math.floor(wantedBatches))
  let limitedBy: RunResult['limitedBy'] = null
  for (const input of process.inputs) {
    const possible = Math.floor(amount(stock, input.good) / input.amount + 1e-9)
    if (possible < batches) { batches = possible; limitedBy = input.good }
  }
  const byLabor = process.labor.personHours > 0 ? Math.floor(laborHours / process.labor.personHours + 1e-9) : Infinity
  if (byLabor < batches) { batches = byLabor; limitedBy = 'labor' }

  const next: Stock = { ...stock }
  for (const input of process.inputs) next[input.good] = amount(next, input.good) - input.amount * batches
  for (const output of process.outputs) next[output.good] = amount(next, output.good) + output.amount * batches
  return { batches, stock: next, limitedBy }
}

/** Eingänge für eine gewünschte Menge eines Ausgangsguts (Mengenverhältnis einer Stufe). */
export function inputsFor(process: Process, good: Good, quantity: number): Flow[] {
  const out = process.outputs.find(o => o.good === good)
  if (!out) throw new Error(`${process.code} produces no ${good}`)
  const batches = quantity / out.amount
  return process.inputs.map(i => ({ good: i.good, amount: i.amount * batches }))
}

/**
 * Vorleistungen bis zum Rohstoff: wie viel Getreide, Strom, Wasser … braucht eine Menge Brot?
 * `route` nennt für jedes Zwischengut das Verfahren, das es herstellt.
 */
export function upstreamRequirements(good: Good, quantity: number, route: Partial<Record<Good, Process>>): Stock {
  const total: Stock = {}
  const visit = (g: Good, q: number) => {
    const process = route[g]
    if (!process) { total[g] = amount(total, g) + q; return }
    for (const input of inputsFor(process, g, q)) visit(input.good, input.amount)
  }
  visit(good, quantity)
  return total
}

/**
 * Verderb eines Tages: Anteil 1/Haltbarkeit des Bestands geht verloren (Bestand, nicht Chargen –
 * passend zum Core, der Mengen je Ort führt). Gibt Bestand und Verluste zurück.
 */
export function spoilDay(stock: Stock): { stock: Stock; lost: Stock } {
  const next: Stock = { ...stock }
  const lost: Stock = {}
  for (const [g, q] of Object.entries(stock) as [Good, number][]) {
    const life = GOODS[g].shelfLifeDays
    if (!life || q <= 0) continue
    const loss = q / life
    next[g] = q - loss
    lost[g] = loss
  }
  return { stock: next, lost }
}

/** Kalorien eines Bestands, nur Güter, die Haushalte direkt essen. */
export function kcalOf(stock: Stock): number {
  return (Object.entries(stock) as [Good, number][]).reduce((sum, [g, q]) => sum + GOODS[g].kcalPerKg * Math.max(0, q), 0)
}

// ── Kette über Tage: Feld/Speicher → Mühle → Bäckerei → Laden → Haushalte ─────────────────

export type ChainConfig = {
  persons: number
  /** Anteil des Kalorienbedarfs, der über Brot gedeckt wird (Rest aus anderen Quellen). */
  breadShareOfKcal: number
  /** Lieferzeit in Tagen je Strecke (Ergebnis der Routenplanung des Ortes). */
  leadDays: { grainToMill: number; flourToBakery: number; breadToShop: number }
  /** Nachbestellen, sobald der Bestand unter so viele Tage Bedarf fällt. */
  reorderCoverDays: number
  /** So viele Tage Bedarf werden je Bestellung angefordert. */
  orderCoverDays: number
  bakeryLaborHoursPerDay: number
  millLaborHoursPerDay: number
  /** Brotbedarf der Gastronomie am Ort (Lokale, Kantine, Hotel) – dieselbe Ware, derselbe Laden. */
  hospitalityBreadKgPerDay?: number
  /** Wer bei Knappheit zuerst bekommt: Haushalte (Grundversorgung) oder anteilig alle. */
  allocation?: 'households_first' | 'proportional'
}

export type Disruption = { link: keyof ChainConfig['leadDays']; fromDay: number; toDay: number; extraDays: number }

export type ChainNodes = { granary: Stock; mill: Stock; bakery: Stock; shop: Stock }

export type DayLog = {
  day: number
  breadNeededKg: number
  breadEatenKg: number
  /** Fehlmenge der Haushalte. */
  shortfallKg: number
  hospitalityNeededKg: number
  hospitalityServedKg: number
  hospitalityShortfallKg: number
  shopBread: number
  bakeryFlour: number
  orders: string[]
  bakeryLimitedBy: RunResult['limitedBy']
  spoiledBreadKg: number
}

type Shipment = { link: keyof ChainConfig['leadDays']; good: Good; amount: number; arrives: number }

export function breadDemandKgPerDay(config: ChainConfig): number {
  return config.persons * KCAL_PER_PERSON_DAY * config.breadShareOfKcal / GOODS.bread.kcalPerKg
}

/**
 * Deterministische Tagessimulation einer Kette. Jede Menge ist zu jedem Zeitpunkt an genau
 * einem Ort: in einem Knoten, unterwegs (`inTransit`) oder verbraucht/verdorben.
 */
export function simulateBreadChain(config: ChainConfig, start: ChainNodes, days: number, disruptions: Disruption[] = []) {
  const nodes: ChainNodes = { granary: { ...start.granary }, mill: { ...start.mill }, bakery: { ...start.bakery }, shop: { ...start.shop } }
  const inTransit: Shipment[] = []
  const log: DayLog[] = []
  const householdDemand = breadDemandKgPerDay(config)
  const hospitalityDemand = Math.max(0, config.hospitalityBreadKgPerDay ?? 0)
  const demand = householdDemand + hospitalityDemand
  const flourPerDay = demand / 1.5
  const grainPerDay = flourPerDay / 0.75
  // Ganze Chargen: Bestellmengen decken mindestens eine Charge.
  const pending = { bread: false, flour: false, grain: false }

  const lead = (link: Shipment['link'], day: number) =>
    config.leadDays[link] + disruptions.filter(d => d.link === link && day >= d.fromDay && day <= d.toDay).reduce((s, d) => s + d.extraDays, 0)
  const ship = (link: Shipment['link'], from: Stock, good: Good, wanted: number, day: number): number => {
    const sent = Math.min(amount(from, good), wanted)
    if (sent <= 0) return 0
    from[good] = amount(from, good) - sent
    inTransit.push({ link, good, amount: sent, arrives: day + lead(link, day) })
    return sent
  }

  const receive = (day: number) => {
    for (const s of inTransit.filter(s => s.arrives <= day)) {
      const target = s.link === 'grainToMill' ? nodes.mill : s.link === 'flourToBakery' ? nodes.bakery : nodes.shop
      target[s.good] = amount(target, s.good) + s.amount
      if (s.good === 'bread') pending.bread = false
      if (s.good === 'flour') pending.flour = false
      if (s.good === 'grain') pending.grain = false
    }
    for (let i = inTransit.length - 1; i >= 0; i--) if (inTransit[i].arrives <= day) inTransit.splice(i, 1)
  }

  for (let day = 1; day <= days; day++) {
    const orders: string[] = []
    // 1. Ankünfte
    receive(day)

    // 2. Produktion (nur mit Eingängen; Wasser, Salz, Hefe, Strom als ausreichend vorhanden angenommen)
    const supplies = { water: 1e9, salt: 1e9, yeast: 1e9, energy: 1e9 }
    // Nachfragegesteuert: die Mühle mahlt nur bis zu ihrem Zielbestand, die Bäckerei backt den Tagesbedarf.
    const millTarget = flourPerDay * config.orderCoverDays * 2
    const millWanted = Math.ceil(Math.max(0, millTarget - amount(nodes.mill, 'flour')) / 750)
    const millRun = runProcess({ ...nodes.mill, ...supplies }, PROCESSES.milling, millWanted, config.millLaborHoursPerDay)
    nodes.mill = { ...nodes.mill, grain: millRun.stock.grain, flour: millRun.stock.flour, bran: millRun.stock.bran }
    const breadUnderway = inTransit.filter(t => t.good === 'bread').reduce((sum, t) => sum + t.amount, 0)
    const breadWanted = Math.max(0, demand - amount(nodes.shop, 'bread') - amount(nodes.bakery, 'bread') - breadUnderway)
    const bakeRun = runProcess({ ...nodes.bakery, ...supplies }, PROCESSES.baking, Math.ceil(breadWanted / 150), config.bakeryLaborHoursPerDay)
    nodes.bakery = { ...nodes.bakery, flour: bakeRun.stock.flour, bread: bakeRun.stock.bread }

    // 3. Brot geht täglich frisch in den Laden
    if (amount(nodes.bakery, 'bread') > 0) ship('breadToShop', nodes.bakery, 'bread', amount(nodes.bakery, 'bread'), day)
    receive(day) // was am selben Tag ankommt (Lieferzeit 0), steht noch heute im Laden

    // 4. Verbrauch: Haushalte und Gastronomie aus demselben Bestand
    const available = amount(nodes.shop, 'bread')
    const split = allocateBread(available, householdDemand, hospitalityDemand, config.allocation ?? 'households_first')
    const eaten = split.households + split.hospitality
    nodes.shop.bread = available - eaten

    // 5. Verderb (nur Brot ist kurzlebig genug, um innerhalb von Wochen zu zählen)
    const spoiled = amount(nodes.shop, 'bread') / (GOODS.bread.shelfLifeDays ?? Infinity)
    nodes.shop.bread = amount(nodes.shop, 'bread') - spoiled

    // 6. Rückkopplung: Nachbestellung entlang der Kette
    if (amount(nodes.bakery, 'flour') < flourPerDay * config.reorderCoverDays && !pending.flour) {
      if (ship('flourToBakery', nodes.mill, 'flour', Math.max(flourPerDay * config.orderCoverDays, PROCESSES.baking.inputs[0].amount), day) > 0) { pending.flour = true; orders.push('Mehl an Bäckerei') }
      else orders.push('Mehl fehlt in der Mühle')
    }
    if (amount(nodes.mill, 'grain') < Math.max(grainPerDay * config.reorderCoverDays, PROCESSES.milling.inputs[0].amount) && !pending.grain) {
      if (ship('grainToMill', nodes.granary, 'grain', Math.max(grainPerDay * config.orderCoverDays, PROCESSES.milling.inputs[0].amount), day) > 0) { pending.grain = true; orders.push('Getreide an Mühle') }
      else orders.push('Getreide fehlt im Speicher')
    }

    log.push({
      day, breadNeededKg: householdDemand, breadEatenKg: eaten, shortfallKg: householdDemand - split.households,
      hospitalityNeededKg: hospitalityDemand, hospitalityServedKg: split.hospitality, hospitalityShortfallKg: hospitalityDemand - split.hospitality,
      shopBread: amount(nodes.shop, 'bread'), bakeryFlour: amount(nodes.bakery, 'flour'),
      orders, bakeryLimitedBy: bakeRun.limitedBy, spoiledBreadKg: spoiled,
    })
  }
  return { log, nodes, inTransit }
}

/** Verteilung eines knappen Bestands auf Haushalte und Gastronomie. */
export function allocateBread(available: number, households: number, hospitality: number, rule: 'households_first' | 'proportional') {
  const total = households + hospitality
  if (available >= total) return { households, hospitality }
  if (rule === 'households_first') {
    const h = Math.min(available, households)
    return { households: h, hospitality: Math.min(available - h, hospitality) }
  }
  const share = total > 0 ? available / total : 0
  return { households: households * share, hospitality: hospitality * share }
}

// ── Gastronomie: Gerichte als Zutaten aus derselben Ware ─────────────────────────────────
// Lokale, Kantine und Hotel führen kein eigenes Warenlager: ein Gericht verbraucht Zutaten
// aus dem Ortsbestand. Schlüssel sind die bestehenden Codes aus npc_service_catalog und
// hospitality_menu. Zutaten in Gramm je Portion, vorläufig.

export const DISH_INGREDIENTS_G: Record<string, Partial<Record<Good, number>>> = {
  cafe_meal:        { bread: 150, vegetables: 100 },
  food_hall_meal:   { potatoes: 250, vegetables: 150, bread: 100 },
  restaurant_main:  { potatoes: 300, vegetables: 200, bread: 80 },
  bar_snack_drink:  { bread: 80, water: 300 },
  canteen_ration:   { food: 500 },
  canteen_emergency_ration: { food: 300 },
  ration:           { food: 500 },
  water:            { water: 300 },
}

/** Zutaten für eine Menge Portionen je Gericht, in ganzen Gramm. Unbekannte Gerichte werden gemeldet. */
export function dishRequirementsG(portions: Record<string, number>): { grams: Partial<Record<Good, number>>; unknown: string[] } {
  const grams: Partial<Record<Good, number>> = {}
  const unknown: string[] = []
  for (const [code, count] of Object.entries(portions)) {
    const recipe = DISH_INGREDIENTS_G[code]
    if (!recipe) { unknown.push(code); continue }
    for (const [g, perPortion] of Object.entries(recipe) as [Good, number][]) grams[g] = (grams[g] ?? 0) + perPortion * Math.max(0, Math.floor(count))
  }
  return { grams, unknown }
}

/** Summe einer Ware über alle Knoten und Transporte – für die Mengenbilanz. */
export function totalOf(good: Good, nodes: ChainNodes, inTransit: { good: Good; amount: number }[]): number {
  return [nodes.granary, nodes.mill, nodes.bakery, nodes.shop].reduce((s, n) => s + amount(n, good), 0)
    + inTransit.filter(t => t.good === good).reduce((s, t) => s + t.amount, 0)
}
