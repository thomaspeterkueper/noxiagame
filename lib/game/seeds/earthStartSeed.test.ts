// lib/game/seeds/earthStartSeed.test.ts
// Erstellt: 01.09.2026
// Frameworkfreier Akzeptanztest: `npx tsx lib/game/seeds/earthStartSeed.test.ts`

import { FACILITY_MODULES } from '../facilities/catalog'
import {
  EARTH_GRID_COLS,
  EARTH_GRID_ROWS,
  EARTH_INITIAL_EXPANSION_RESERVE,
  EARTH_START_FACILITIES,
  EARTH_START_MODULES,
  earthStartShipCapacity,
  validateEarthStartSeed,
} from './earthStartSeed'

let failures = 0
function check(ok: boolean, message: string): void {
  if (!ok) {
    failures++
    console.log(`✘ ${message}`)
  }
}

console.log('── Earth modular start seed ─────────────────────────────────────')

const structuralIssues = validateEarthStartSeed()
for (const issue of structuralIssues) {
  failures++
  console.log(`✘ ${issue}`)
}
if (structuralIssues.length === 0) console.log('✓ bounds, collisions and facility membership')

check(EARTH_GRID_ROWS === 24 && EARTH_GRID_COLS === 32, 'Earth grid must remain 32×24')
check(EARTH_START_FACILITIES.every(f => f.ownerClass === 'STATE' && f.publicAccess), 'all Earth start facilities are public STATE infrastructure')
check(EARTH_START_MODULES.every(m => m.ownerClass === 'STATE' && m.publicAccess), 'all Earth start modules are public STATE infrastructure')
check(EARTH_INITIAL_EXPANSION_RESERVE.length > 0, 'initial expansion space must be explicit')

for (const module of EARTH_START_MODULES) {
  check(Boolean(FACILITY_MODULES[module.definitionId]), `${module.id}: unknown module definition ${module.definitionId}`)
}

const spaceport = EARTH_START_FACILITIES.find(f => f.id === 'earth_public_spaceport')
check(Boolean(spaceport), 'public Earth spaceport exists')
check((spaceport?.moduleIds.length ?? 0) > 1, 'Earth spaceport is a multi-module facility, not one landing-pad building')

const padModules = EARTH_START_MODULES.filter(m => {
  const definition = FACILITY_MODULES[m.definitionId]
  return definition?.facilityType === 'spaceport' && ['pad', 'cargo', 'passenger'].includes(definition.role)
})
check(padModules.length >= 3, 'Earth starts with several shared pad modules')

const capacity = earthStartShipCapacity()
check(capacity.parking >= 6, 'Earth public spaceport has useful multiplayer parking capacity')
check(capacity.activeOperations >= 2, 'Earth public spaceport can operate more than one pad')

const miniPad = FACILITY_MODULES.spaceport_pad_mini
check(miniPad.capacity?.shipParking === 2, 'mini-pad default is two ship positions')
check(miniPad.capacity?.activeShipOperations === 1, 'mini-pad has one active launch/landing operation')
check((miniPad.capacity?.storageUnits ?? 0) > 0, 'mini-pad contains integrated mini-storage')

if (failures > 0) {
  console.log(`\n✘ ${failures} Earth seed check(s) failed.`)
  process.exit(1)
}

console.log('✓ Earth modular start seed accepted')
console.log(`  ${EARTH_START_FACILITIES.length} facilities · ${EARTH_START_MODULES.length} modules · ${capacity.parking} shared ship parking positions`)
