import assert from 'node:assert/strict'
import { SELMECKE_REFERENCE_SITE } from './earthReferenceSites'
import { analyseSpaceportAreas } from './spaceportAreaAnalysis'
import type { SpaceportCandidate } from './spaceportSuitability'
import type { SpaceportShortlistCandidate } from './spaceportShortlist'

function candidate(latOffset: number, score = 80): SpaceportCandidate {
  return {
    lat: SELMECKE_REFERENCE_SITE.point.lat + latOffset,
    lon: SELMECKE_REFERENCE_SITE.point.lon,
    elevationM: 320,
    slopePercent: 2,
    reliefM: 4,
    terrainScore: 75,
    state: 'buildable',
    reason: null,
    score,
    roadDistanceM: null,
    railDistanceM: null,
    exclusionDistanceM: 600,
    exclusionType: null,
    reasons: [],
  } as SpaceportCandidate
}

function shortlist(site: SpaceportCandidate): SpaceportShortlistCandidate {
  return {
    ...site,
    shortlistRank: 1,
    shortlistLabel: 'A',
    shortlistReason: 'contract test',
  }
}

const site = candidate(0)
const connected = candidate(500 / 111_320)
const fit = analyseSpaceportAreas([shortlist(site)], [site, connected], [])[0]

assert.equal(fit.compactShuttleFit, true)
assert.equal(fit.usableAreaHa, 50)
assert(fit.maxConnectedSpanM >= 499)
assert.equal(fit.selmeckeDistanceM, 0)
assert(fit.notes.some(note => note.includes('1–2-Pad-Shuttlebetrieb')))
assert(fit.notes.some(note => note.includes('Tunneltrasse separat zu prüfen')))

const unresolved = analyseSpaceportAreas([shortlist(site)], [site], [])[0]
assert.equal(unresolved.compactShuttleFit, false)
assert(unresolved.notes.some(note => note.includes('genauere Flächenprüfung')))

console.log('spaceport area analysis tests passed')
