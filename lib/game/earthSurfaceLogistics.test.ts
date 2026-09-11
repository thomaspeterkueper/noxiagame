import {
  assessEarthLastMileAccess,
  assessEarthOffroad,
  assessEarthRoadTraversal,
  classifyEarthOffroadGround,
  classifyEarthRoad,
  EARTH_LAST_MILE_FALLBACK_M,
} from './earthSurfaceLogistics'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const cargoRover = { role: 'cargo-rover' as const, safeLongitudinalSlopeDeg: 12 }
const heavyHauler = { role: 'heavy-hauler' as const, safeLongitudinalSlopeDeg: 10 }

const primary = classifyEarthRoad({ highway: 'primary', surface: 'asphalt' }, 'cargo-rover')
assert(primary.routeClass === 'paved-road', 'paved primary road must classify as paved road')
assert(primary.suitability === 'preferred', 'paved road must be preferred for cargo rover')

const service = classifyEarthRoad({ highway: 'service', surface: 'asphalt' }, 'heavy-hauler')
assert(service.routeClass === 'service-road', 'service road must remain a separate route class')
assert(service.suitability === 'allowed', 'heavy hauler may use service road without making it preferred')

const track = classifyEarthRoad({ highway: 'track', surface: 'gravel' }, 'cargo-rover')
assert(track.routeClass === 'track' && track.suitability === 'allowed', 'OSM track must remain routable with a penalty')

const footway = classifyEarthRoad({ highway: 'footway' }, 'cargo-rover')
assert(footway.suitability === 'blocked' && footway.reason === 'pedestrian-only', 'pedestrian paths must not become vehicle roads')

const privateRoad = classifyEarthRoad({ highway: 'service', access: 'private' }, 'cargo-rover')
assert(privateRoad.suitability === 'blocked' && privateRoad.reason === 'access-restricted', 'explicit private access must not be silently routed')

const pavedTraversal = assessEarthRoadTraversal(primary, cargoRover, 3)
const trackTraversal = assessEarthRoadTraversal(track, cargoRover, 3)
assert(pavedTraversal.passable && trackTraversal.passable, 'gentle observed roads must remain passable')
assert(trackTraversal.speedMultiplier < pavedTraversal.speedMultiplier, 'track must be slower than paved road')
assert(trackTraversal.energyMultiplier > pavedTraversal.energyMultiplier, 'track must cost more relative energy than paved road')
assert(trackTraversal.wearMultiplier > pavedTraversal.wearMultiplier, 'track must impose more relative wear than paved road')

assert(classifyEarthOffroadGround({ slopeDeg: 2, natural: 'water' }) === 'water', 'water must be an offroad exclusion')
assert(classifyEarthOffroadGround({ slopeDeg: 2, landuse: 'forest' }) === 'vegetated', 'forest must be recognized as vegetated ground')
assert(classifyEarthOffroadGround({ slopeDeg: 2, landuse: 'meadow' }) === 'open', 'meadow must be recognized as open ground')

const openOffroad = assessEarthOffroad({ slopeDeg: 4, landuse: 'meadow' }, cargoRover)
const forestOffroad = assessEarthOffroad({ slopeDeg: 4, landuse: 'forest' }, cargoRover)
assert(openOffroad.passable && forestOffroad.passable, 'gentle open/vegetated terrain may be offroad fallback')
assert(forestOffroad.speedMultiplier < openOffroad.speedMultiplier, 'vegetated terrain must be slower than open ground')
assert(forestOffroad.energyMultiplier > openOffroad.energyMultiplier, 'vegetated terrain must increase relative energy burden')

const waterOffroad = assessEarthOffroad({ slopeDeg: 1, natural: 'water' }, cargoRover)
assert(!waterOffroad.passable && waterOffroad.reason === 'ground-blocked', 'water must block generic offroad traversal')

const unresolvedOffroad = assessEarthOffroad({ slopeDeg: null }, cargoRover)
assert(!unresolvedOffroad.passable && unresolvedOffroad.reason === 'unresolved', 'missing terrain observations must remain unresolved')

const steepOffroad = assessEarthOffroad({ slopeDeg: 8, landuse: 'meadow' }, cargoRover)
assert(!steepOffroad.passable && steepOffroad.reason === 'slope-limit', 'Earth policy must apply the Engineering/Core slope envelope')

const cargoLastMile = assessEarthLastMileAccess(60, 'cargo-rover', true)
assert(cargoLastMile.allowed && cargoLastMile.mode === 'short-offroad-link', 'short unmapped cargo-rover access may use offroad fallback')
assert(EARTH_LAST_MILE_FALLBACK_M['cargo-rover'] > EARTH_LAST_MILE_FALLBACK_M['heavy-hauler'], 'heavy hauler must demand tighter observed road access')
const heavyLastMile = assessEarthLastMileAccess(60, 'heavy-hauler', true)
assert(!heavyLastMile.allowed, 'same unmapped access may remain unresolved for heavy hauler')

const heavyTrack = assessEarthRoadTraversal(track, heavyHauler, 2)
assert(heavyTrack.passable, 'gentle track remains usable when supplied heavy-hauler envelope allows it')

console.log('earth surface logistics tests passed')
