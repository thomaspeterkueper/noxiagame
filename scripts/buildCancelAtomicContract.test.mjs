// Regression contract for issue #615. Expected RED until cancellation is atomic.
// Run: node --test scripts/buildCancelAtomicContract.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const route = readFileSync(new URL('../app/api/game/build/route.ts', import.meta.url), 'utf8')
const commands = readFileSync(new URL('../lib/game/core/commands.ts', import.meta.url), 'utf8')

test('cancellation delegates to an atomic Core command', () => {
  assert.match(commands, /export async function cancelBuildCommand\s*\(/)
  assert.match(commands, /\.rpc\(['"]noxia_cancel_build['"]/)
  const cancel = route.match(/if \(action === 'cancel'\) \{([\s\S]*?)\n  \}\n\n  if \(action === 'sellQuote'\)/)?.[1]
  assert.ok(cancel, 'cancel route must remain discoverable until migration')
  assert.match(cancel, /await cancelBuildCommand\(/)
  assert.doesNotMatch(cancel, /\.from\(['"](?:profiles|player_builds)['"]\)\.(?:update|insert|delete)\(/)
})

test('cancellation never calculates refunds from mutable client-side prices', () => {
  const cancel = route.match(/if \(action === 'cancel'\) \{([\s\S]*?)\n  \}\n\n  if \(action === 'sellQuote'\)/)?.[1]
  assert.ok(cancel)
  assert.doesNotMatch(cancel, /defForCancel|localBuildingDef|Math\.floor/)
})
