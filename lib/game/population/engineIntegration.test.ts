// lib/game/population/engineIntegration.test.ts
// Regression guard: persistence engine must use the state-based decision core.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'engine.ts'), 'utf8')

if (!source.includes("from './decision'")) throw new Error('population engine does not import decision.ts')
if (!source.includes('decideFromState(context)')) throw new Error('background population bypasses deterministic decision context')
if (!source.includes("person_knowledge")) throw new Error('personal knowledge is not loaded for background decisions')
if (!source.includes("person_relationships")) throw new Error('relationships are not loaded for background decisions')
if (!source.includes('if (person.person_key)')) throw new Error('named-person decision ownership is not preserved')

console.log('✔ Population engine integration: state-based decision core is wired')
