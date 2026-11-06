import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const route = readFileSync(new URL('../app/api/game/build/route.ts', import.meta.url), 'utf8')

test('sale rejects unsupported modes before reading or deleting the entity', () => {
  const saleStart = route.indexOf("if (action === 'sell') {")
  assert.ok(saleStart >= 0, 'sale handler exists')
  const sale = route.slice(saleStart)
  const guard = sale.indexOf("requestedMode !== 'normal' && requestedMode !== 'instant'")
  const entityRead = sale.indexOf("from('tile_entities')")
  assert.ok(guard >= 0, 'unknown modes must be rejected')
  assert.ok(entityRead > guard, 'validate mode before touching entities')
  assert.match(sale.slice(0, entityRead), /status: 400/)
  assert.match(sale.slice(0, entityRead), /const mode: SaleMode = requestedMode/)
})

test('sale mode is never cast from unchecked query parameters', () => {
  assert.doesNotMatch(route, /searchParams\.get\('mode'\)[^\n]*as SaleMode/)
})
