// lib/research/colony/liveExportCli.ts
// Read-only live exporter for the colony research run.

import { createServiceClient } from '../../supabase/service'
import { exportLiveColonyMarket } from './liveExport'

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

async function main() {
  const options = args(process.argv.slice(2))
  const supabase = createServiceClient()
  const exported = await exportLiveColonyMarket(supabase)
  const prefix = options.out ?? `experiments/colony/live-${exported.diagnostics.tick}`
  fs.mkdirSync(path.dirname(prefix), { recursive: true })
  fs.writeFileSync(`${prefix}.snapshot.json`, JSON.stringify(exported.snapshot, null, 2))
  fs.writeFileSync(`${prefix}.market.json`, JSON.stringify(exported.market, null, 2))
  fs.writeFileSync(`${prefix}.diagnostics.json`, JSON.stringify(exported.diagnostics, null, 2))
  console.log(JSON.stringify({ prefix, ...exported.diagnostics }, null, 2))
}

main().catch((error: any) => {
  console.error(error?.stack ?? error?.message ?? String(error))
  process.exit(1)
})
