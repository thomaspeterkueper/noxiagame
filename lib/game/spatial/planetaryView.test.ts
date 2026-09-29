import assert from 'node:assert/strict'
import { createPlanetaryViewAnchor, localMetersToPlanetaryView, planetaryMetricToChunkCell, planetaryViewToLocalMeters } from './planetaryView'

for(const body of ['earth','moon','mars','phobos','deimos'] as const){
  const origin={latDeg:body==='earth'?50.1109:body==='mars'?14:0,lonDeg:body==='earth'?8.6821:body==='mars'?-102:0,elevationM:0}
  const view=createPlanetaryViewAnchor(body,origin)
  const local=planetaryViewToLocalMeters(origin,view)
  assert.ok(Math.abs(local.eastM)<1e-6)
  assert.ok(Math.abs(local.northM)<1e-6)
  const roundTrip=localMetersToPlanetaryView({eastM:0,northM:0},view)
  assert.ok(Math.abs(roundTrip.latDeg-origin.latDeg)<1e-6)
  assert.ok(Math.abs(roundTrip.lonDeg-origin.lonDeg)<1e-6)
  assert.deepEqual(planetaryMetricToChunkCell({eastM:1_250,northM:-250},view.chunkSizeM,view.cellSizeM),{chunk:{x:1,y:-1},localX:25,localY:75})
  assert.match(view.id,new RegExp(`^${body}-view-`))
}
console.log('Planetary view invariants passed')
