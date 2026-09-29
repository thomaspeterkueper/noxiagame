import assert from 'node:assert/strict'
import { createPlanetaryViewAnchor, localMetersToPlanetaryView, planetaryMetricToChunkCell, planetaryViewToLocalMeters } from './planetaryView'

for(const body of ['earth','moon','mars','venus','titan','phobos','deimos'] as const){
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

const venus=createPlanetaryViewAnchor('venus',{latDeg:0,lonDeg:0,elevationM:0})
const titan=createPlanetaryViewAnchor('titan',{latDeg:0,lonDeg:0,elevationM:0})
const venusOneKm=localMetersToPlanetaryView({eastM:1000,northM:0},venus)
const titanOneKm=localMetersToPlanetaryView({eastM:1000,northM:0},titan)
assert.ok(venusOneKm.lonDeg>0)
assert.ok(titanOneKm.lonDeg>venusOneKm.lonDeg,'same metric offset must span more longitude on smaller Titan')
assert.deepEqual(planetaryMetricToChunkCell({eastM:1250,northM:-250},venus.chunkSizeM,venus.cellSizeM),planetaryMetricToChunkCell({eastM:1250,northM:-250},titan.chunkSizeM,titan.cellSizeM))
