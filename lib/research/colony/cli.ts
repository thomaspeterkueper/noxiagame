// lib/research/colony/cli.ts
// Command line entry for the research run. See docs/research/colony-run.md.
//
//   npm run research:colony -- --years 1 --people 31
//   npm run research:colony -- --days 90 --snapshot experiments/colony/tharsis.snapshot.json --scenario my.scenario.json --out out/run1

import { daysToCsv, runColony, syntheticColony, type ColonySnapshot, type ScenarioEvent } from './colonyRun'

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
  console.log('Options: --years N | --days N | --hours N, --people N, --settlements N, --snapshot file.json, --scenario file.json, --out path-prefix')
  process.exit(0)
}
const hours = options.hours ? Number(options.hours) : options.days ? Number(options.days) * 24 : Number(options.years ?? 1) * 365 * 24
if (!Number.isFinite(hours) || hours < 1) throw new Error('duration must be a positive number')

const snapshot: ColonySnapshot = options.snapshot
  ? JSON.parse(fs.readFileSync(options.snapshot, 'utf8'))
  : syntheticColony({ people: Number(options.people ?? 31), settlements: Number(options.settlements ?? 1) })
const scenario: ScenarioEvent[] = options.scenario ? JSON.parse(fs.readFileSync(options.scenario, 'utf8')) : []

const started = Date.now()
const result = runColony(snapshot, { ticks: Math.round(hours), scenario })
const seconds = (Date.now() - started) / 1000

const first = result.days[0]
const last = result.days[result.days.length - 1]
console.log(`Colony run: ${result.people} people, ${result.days.length} game days in ${seconds.toFixed(1)} s (source: ${options.snapshot ?? 'synthetic'}, scenario events: ${scenario.length})`)
console.table([first, result.days[Math.floor(result.days.length / 2)], last].map((row) => ({
  day: row.day, sleepH: row.sleepHours, workH: row.workHours, rest: row.restAvg, encounters: row.encounters,
  joy: row.joyAvg, mood: row.moodAvg, fear: row.fearAvg, anger: row.angerAvg, ties: row.relationships, close: row.closeTies, closeMax: row.closeTiesMaxPerPerson, trust: row.trustAvg, affinity: row.affinityAvg,
})))

if (options.out) {
  fs.mkdirSync(path.dirname(options.out), { recursive: true })
  fs.writeFileSync(`${options.out}.days.csv`, daysToCsv(result.days))
  fs.writeFileSync(`${options.out}.final.json`, JSON.stringify(result.final, null, 2))
  console.log(`Wrote ${options.out}.days.csv and ${options.out}.final.json`)
}
