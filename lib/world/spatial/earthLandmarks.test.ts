import { strict as assert } from 'node:assert'
import {
  EARTH_LANDMARKS,
  getCrossUniverseEarthLandmarks,
  getEarthLandmark,
  getEarthLandmarksByTag,
} from './earthLandmarks'

const ids = EARTH_LANDMARKS.map(landmark => landmark.id)
assert.equal(new Set(ids).size, ids.length, 'landmark ids must be unique')

for (const landmark of EARTH_LANDMARKS) {
  assert.ok(landmark.name.trim().length > 0)
  assert.equal(landmark.locator.kind, 'address')
  assert.ok(landmark.locator.value.trim().length > 0)
  assert.ok(landmark.presentDayRole.trim().length > 0)
  assert.ok(landmark.noxiaRole.trim().length > 0)
  assert.ok(landmark.sourceProjects.length > 0)

  if (landmark.externalUrl) {
    const url = new URL(landmark.externalUrl)
    assert.equal(url.protocol, 'https:')
    assert.ok(landmark.externalLinkLabel)
  }
}

const ssf = getEarthLandmark('earth-de-sundern-ssf-hq')
assert.ok(ssf)
assert.ok(ssf.tags.includes('canonical-foundation'))
assert.equal(ssf.externalUrl, 'https://solarsciencefoundation.vercel.app/')

const crossUniverse = getCrossUniverseEarthLandmarks()
assert.deepEqual(
  crossUniverse.map(landmark => landmark.id).sort(),
  [
    'earth-ch-vuiteboeuf',
    'earth-kr-seoul',
    'earth-it-palermo',
    'earth-gr-delphi',
    'earth-gb-stonehenge',
    'earth-cn-huashan',
    'earth-de-frankfurt-bornheim',
    'earth-cy-cyprus',
    'earth-gr-rhodes',
    'earth-ly-tripolitania',
    'earth-de-frankfurt-schwanheimer-duene',
    'earth-de-frankfurt-sachsenhausen',
    'earth-de-frankfurt-staedel',
    'earth-de-hamburg-altona',
    'earth-de-menden-hexenteich',
    'earth-de-frankfurt-camaleo-artlounge',
    'earth-de-frankfurt-senckenberg',
    'earth-de-north-sea-book-village',
    'earth-eg-alexandria',
    'earth-eg-cairo',
    'earth-kr-seoul',
    'earth-de-frankfurt-sachsenhausen',
    'earth-de-frankfurt-staedel',
    'earth-de-hamburg-altona',
    'earth-de-menden-hexenteich',
    'earth-tn-carthage-tunis',
    'earth-ly-cyrene',
    'earth-it-pantelleria',
    'earth-es-cadiz',
    'earth-gr-phaistos',
    'earth-in-dwarka',
    'earth-mt-hal-saflieni',
    'earth-pe-chavin-de-huantar',
    'earth-tr-istanbul-bosphorus',
  ].sort(),
)

assert.ok(getEarthLandmarksByTag('spaceflight').length >= 3)
assert.ok(getEarthLandmarksByTag('culture').some(landmark => landmark.id === 'earth-de-frankfurt-camaleo-artlounge'))
assert.equal(getEarthLandmark('earth-de-frankfurt-senckenberg')?.locality, 'Frankfurt am Main')
assert.equal(getEarthLandmark('earth-pe-chavin-de-huantar')?.countryCode, 'PE')
assert.equal(getEarthLandmark('earth-eg-cairo')?.countryCode, 'EG')
assert.equal(getEarthLandmark('earth-kr-seoul')?.countryCode, 'KR')
assert.equal(getEarthLandmark('earth-it-palermo')?.countryCode, 'IT')
assert.equal(getEarthLandmark('earth-gr-delphi')?.countryCode, 'GR')
assert.equal(getEarthLandmark('earth-gb-stonehenge')?.countryCode, 'GB')
assert.equal(getEarthLandmark('earth-cn-huashan')?.countryCode, 'CN')
assert.equal(getEarthLandmark('earth-de-frankfurt-bornheim')?.locality, 'Frankfurt am Main')
assert.equal(getEarthLandmark('earth-cy-cyprus')?.countryCode, 'CY')
assert.equal(getEarthLandmark('earth-gr-rhodes')?.countryCode, 'GR')
assert.equal(getEarthLandmark('earth-ly-tripolitania')?.countryCode, 'LY')
assert.equal(getEarthLandmark('earth-de-frankfurt-schwanheimer-duene')?.locality, 'Frankfurt am Main')
assert.equal(getEarthLandmark('earth-de-frankfurt-staedel')?.locator.value, 'Schaumainkai 63, 60596 Frankfurt am Main, Germany')
assert.equal(getEarthLandmark('earth-de-menden-hexenteich')?.locality, 'Menden (Sauerland)')
assert.equal(getEarthLandmark('earth-kr-seoul')?.countryCode, 'KR')
assert.equal(getEarthLandmark('earth-de-frankfurt-staedel')?.locality, 'Frankfurt am Main')
assert.equal(getEarthLandmark('earth-de-hamburg-altona')?.locality, 'Hamburg')
assert.equal(getEarthLandmark('earth-de-menden-hexenteich')?.locator.value, 'Menden (Sauerland), Germany')
assert.equal(getEarthLandmark('earth-tn-carthage-tunis')?.countryCode, 'TN')
assert.equal(getEarthLandmark('earth-ly-cyrene')?.countryCode, 'LY')
assert.equal(getEarthLandmark('earth-it-pantelleria')?.countryCode, 'IT')
assert.equal(getEarthLandmark('earth-es-cadiz')?.countryCode, 'ES')
assert.ok(getEarthLandmark('earth-mt-hal-saflieni')?.tags.includes('archaeology'))
assert.ok(getEarthLandmarksByTag('real-science').some(landmark => landmark.id === 'earth-de-darmstadt-esoc'))
assert.equal(getEarthLandmark('does-not-exist'), undefined)

console.log('earth landmark registry tests passed')
