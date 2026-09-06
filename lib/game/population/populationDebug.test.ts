import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const api = readFileSync(resolve(here, '../../../app/api/game/population-debug/route.ts'), 'utf8')
const page = readFileSync(resolve(here, '../../../app/debug/population/page.tsx'), 'utf8')

if (!api.includes("supabase.auth.getUser")) throw new Error('population debug API must require authentication')
if (!api.includes("location.governor_profile_id !== user.id")) throw new Error('population debug API must restrict internal state to the location governor')
if (!api.includes(".eq('simulation_tier', 'active')")) throw new Error('inspector must remain bounded to active individual simulation')
for (const table of ['person_needs', 'person_assignments', 'person_knowledge', 'population_events']) {
  if (!api.includes(`from('${table}')`)) throw new Error(`inspector missing ${table}`)
}
if (api.includes("from('simulation_events')")) throw new Error('population inspector must not conflate population events with generalized world events')
if (!page.includes('persönliches Wissen')) throw new Error('UI must identify knowledge as person-local')
if (!page.includes('Keine World-Truth-/Observation-Vermischung')) throw new Error('UI must preserve epistemic boundary')

console.log('✔ Living Population inspector keeps person state, knowledge and population events observable and separate')
