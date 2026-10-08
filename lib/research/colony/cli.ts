// lib/research/colony/cli.ts
// Command line entry for the research run. See docs/research/colony-run.md.
//
//   npm run research:colony -- --years 1 --people 31
//   npm run research:colony -- --days 90 --snapshot experiments/colony/tharsis.snapshot.json --scenario my.scenario.json --out out/run1

import { daysToCsv, runColony, syntheticColony, type ColonySnapshot, type ScenarioEvent } from './colonyRun'
import { syntheticMarket, type MarketSetup } from './colonyMarket'

// Kept untyped so the runner compiles without Node type definitions, like the other test scripts.
declare const require: any
declare const process: any
const fs = require('fs')
const path = require('path')

function args(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const next = argv[i + 1]
    out[argv[i].slice(2)] = next && !next.startsWith('--') ? argv[++i] : 'true'
  }
  return out
}

const options = args(process.argv.slice(2))
if (options.help) {
  console.log('Options: --years N | --days N | --hours N, --people N, --settlements N, --snapshot file.json, --scenario file.json, --out path-prefix, --no-friction, --no-relocation, --market [file.json]')
  process.exit(0)
}
const hours = options.hours ? Number(options.hours) : options.days ? Number(options.days) * 24 : Number(options.years ?? 1) * 365 * 24
if (!Number.isFinite(hours) || hours < 1) throw new Error('duration must be a positive number')

const snapshot: ColonySnapshot = options.snapshot
  ? JSON.parse(fs.readFileSync(options.snapshot, 'utf8'))
  : syntheticColony({ people: Number(options.people ?? 31), settlements: Number(options.settlements ?? 1) })
const scenario: ScenarioEvent[] = options.scenario ? JSON.parse(fs.readFileSync(options.scenario, 'utf8')) : []

const market: MarketSetup | undefined = !options.market ? undefined : options.market === 'true' ? syntheticMarket(snapshot) : JSON.parse(fs.readFileSync(options.market, 'utf8'))

const started = Date.now()
const result = runColony(snapshot, { ticks: Math.round(hours), scenario, friction: options['no-friction'] !== 'true', relocation: options['no-relocation'] !== 'true', market })
const seconds = (Date.now() - started) / 1000

const first = result.days[0]
const last = result.days[result.days.length - 1]
console.log(`Colony run: ${result.people} people, ${result.days.length} game days in ${seconds.toFixed(1)} s (source: ${options.snapshot ?? 'synthetic'}, scenario events: ${scenario.length})`)
const pick = [first, result.days[Math.floor(result.days.length / 2)], last]
console.table(pick.map((row) => ({
  day: row.day, sleepH: row.sleepHours, workH: row.workHours, rest: row.restAvg, social: row.socialAvg, variety: row.varietyAvg,
  joy: row.joyAvg, anger: row.angerAvg, mood: row.moodAvg,
})))
console.table(pick.map((row) => ({
  day: row.day, encounters: row.encounters, conflicts: row.conflicts, assists: row.assists, visits: row.visits, moves: row.moves,
  ties: row.relationships, close: row.closeTies, strained: row.strainedTies, trust: row.trustAvg, affinity: row.affinityAvg,
})))
console.table(pick.map((row) => ({
  day: row.day, spielraum: row.spielraumAvg, action: row.spielraumActionAvg, relational: row.spielraumRelationalAvg, place: row.spielraumPlaceAvg,
  min: row.spielraumMin, narrowShare: row.spielraumNarrowShare, gini: row.spielraumGini,
})))
const total = (key: 'encounters' | 'conflicts' | 'assists' | 'visits' | 'moves') => result.days.reduce((sum, row) => sum + row[key], 0)
console.log(`Totals: ${total('encounters')} encounters, ${total('conflicts')} conflicts, ${total('assists')} acts of help, ${total('visits')} visits, ${total('moves')} moves. Residents: ${JSON.stringify(result.final.residents)}. Spielraum by settlement: ${JSON.stringify(result.final.spielraumBySettlement)}`)

if (result.market) {
  const rows = result.market.days
  console.table([rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].map((row) => ({
    day: row.day, wealth: row.wealthAvg, wealthGini: row.wealthGini, wage: row.wageAvg, unemployed: row.unemployed, unpaid: row.unpaid,
    homeless: row.homeless, hotel: row.hotelGuests, owners: row.owners, renters: row.renters, rent: row.rentAvg, open: row.openPlacesAvg, shutIn: row.noOpenPlaces,
  })))
  const sumOf = (key: 'evictions' | 'quits' | 'applications' | 'refusals' | 'declined' | 'housingMoves' | 'jobChanges') => rows.reduce((sum, row) => sum + row[key], 0)
  console.log(`Market: ${sumOf('applications')} applications, ${sumOf('refusals')} refused, ${sumOf('declined')} offers declined, ${sumOf('housingMoves')} housing moves, ${sumOf('jobChanges')} job changes, ${sumOf('evictions')} evictions, ${sumOf('quits')} quits over unpaid wages.`)
  console.log(`Access: ${JSON.stringify(result.market.summary)}`)
  console.table(result.market.power.slice(0, 6))
  console.log(`Owner income: ${JSON.stringify(result.market.final.ownerIncome)}. Employer balances: ${JSON.stringify(result.market.final.employerBalance)}`)
}

if (options.out) {
  fs.mkdirSync(path.dirname(options.out), { recursive: true })
  fs.writeFileSync(`${options.out}.days.csv`, daysToCsv(result.days))
  fs.writeFileSync(`${options.out}.final.json`, JSON.stringify(result.final, null, 2))
  fs.writeFileSync(`${options.out}.moves.json`, JSON.stringify(result.moves, null, 2))
  fs.writeFileSync(`${options.out}.spielraum.json`, JSON.stringify(result.spielraumBySettlement))
  if (result.market) {
    fs.writeFileSync(`${options.out}.market.json`, JSON.stringify({ days: result.market.days, summary: result.market.summary, power: result.market.power, final: result.market.final }, null, 2))
    fs.writeFileSync(`${options.out}.access.json`, JSON.stringify(result.market.records))
  }
  console.log(`Wrote ${options.out}.days.csv, .final.json, .moves.json and .spielraum.json`)
}
