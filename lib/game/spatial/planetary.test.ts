import { PLANETARY_REFERENCES, localEnuToPlanetary, planetaryToLocalEnu } from './planetary'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`)
}

for (const body of ['earth', 'moon', 'mars'] as const) {
  const reference = PLANETARY_REFERENCES[body]
  const origin = body === 'earth'
    ? { latDeg: 51, lonDeg: 8, elevationM: 300 }
    : body === 'moon'
      ? { latDeg: -89, lonDeg: 0, elevationM: 0 }
      : { latDeg: 10, lonDeg: 20, elevationM: 0 }

  const local = { eastM: 125, northM: -240, upM: 37 }
  const planetary = localEnuToPlanetary(local, origin, reference)
  const roundTrip = planetaryToLocalEnu(planetary, origin, reference)

  near(roundTrip.eastM, local.eastM, 0.02, `${body} east round trip`)
  near(roundTrip.northM, local.northM, 0.02, `${body} north round trip`)
  near(roundTrip.upM, local.upM, 0.02, `${body} up round trip`)
}

const earth = PLANETARY_REFERENCES.earth
const equatorOrigin = { latDeg: 0, lonDeg: 0, elevationM: 0 }
const eastPoint = { latDeg: 0, lonDeg: 0.001, elevationM: 0 }
const east = planetaryToLocalEnu(eastPoint, equatorOrigin, earth)
near(east.eastM, 111.31949, 0.01, 'WGS84 equatorial east distance for 0.001 degree')

const upPoint = { latDeg: 0, lonDeg: 0, elevationM: 100 }
const up = planetaryToLocalEnu(upPoint, equatorOrigin, earth)
near(up.upM, 100, 0.001, 'WGS84 local up')

console.log('planetary coordinate tests passed')
