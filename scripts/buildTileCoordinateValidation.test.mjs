import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../app/api/game/build/route.ts', import.meta.url), 'utf8')
const match = source.match(/function parseTileInteger\(raw: string \| null\): number \{([\s\S]*?)\n\}/)
assert.ok(match, 'coordinate parser exists')
const parseTileInteger = runInNewContext(`(function (raw) {${match[1]}\n})`)

test('tile parser preserves missing-parameter default and valid integer coordinates', () => {
  for (const [raw, expected] of [[null, 0], ['0', 0], ['12', 12], ['-3', -3], ['023', 23]]) {
    assert.equal(parseTileInteger(raw), expected)
  }
})

test('tile parser rejects partial, fractional, hexadecimal, blank and non-finite inputs', () => {
  for (const raw of ['1oops', '0.5', '-0.5', '0x10', '', ' ', '1e2', '+1', 'Infinity', 'NaN', '9007199254740992', '-9007199254740992', '999999999999999999999999999']) {
    assert.ok(Number.isNaN(parseTileInteger(raw)), `unexpectedly accepted ${JSON.stringify(raw)}`)
  }
})

test('start handler checks all three coordinates as integers before module writes or Core command', () => {
  const start = source.slice(source.indexOf("if (action === 'start') {"), source.indexOf("if (action === 'cancel') {"))
  assert.ok(start.includes("parseTileInteger(searchParams.get('tileRow'))"))
  assert.ok(start.includes("parseTileInteger(searchParams.get('tileCol'))"))
  assert.ok(start.includes("parseTileInteger(searchParams.get('tileLevel'))"))
  for (const key of ['tileLevel', 'tileRow', 'tileCol']) {
    assert.ok(start.includes(`Number.isInteger(${key})`), `missing ${key} integer check`)
  }
  assert.ok(start.indexOf('Number.isInteger(tileCol)') < start.indexOf('const moduleDef = MODULE_COSTS'))
  assert.ok(start.indexOf('Number.isInteger(tileCol)') < start.indexOf('startBuildCommand({'))
})
