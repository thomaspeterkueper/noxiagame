import { atmosphericRefractionDeg, observeThroughAtmosphere } from './refraction.ts'

let fails = 0
function check(ok: boolean, label: string): void {
  if (!ok) { fails++; console.log('FAIL:', label) }
}

const vacuum = observeThroughAtmosphere({ geometric: { altitudeDeg: 0, azimuthDeg: 180 } })
check(vacuum.refractionDeg === 0, 'vacuum has no refraction')
check(vacuum.apparent.altitudeDeg === vacuum.geometric.altitudeDeg, 'vacuum preserves altitude')

const standard = { pressureHpa: 1010, temperatureC: 10 }
const horizon = atmosphericRefractionDeg(0, standard)
const tenDeg = atmosphericRefractionDeg(10, standard)
check(horizon > 0.45 && horizon < 0.65, 'standard horizon refraction is about half a degree')
check(horizon > tenDeg, 'refraction increases toward horizon')

const thin = atmosphericRefractionDeg(0, { pressureHpa: 6.5, temperatureC: -20 })
check(thin > 0 && thin < horizon * 0.02, 'Mars-like thin atmosphere produces much smaller refraction')

const observed = observeThroughAtmosphere({
  geometric: { altitudeDeg: 0, azimuthDeg: 123 },
  atmosphere: standard,
})
check(observed.geometric.altitudeDeg === 0, 'ground truth is retained')
check(observed.apparent.altitudeDeg > observed.geometric.altitudeDeg, 'apparent altitude is displaced upward')
check(observed.apparent.azimuthDeg === 123, 'v0.1 leaves azimuth unchanged')

console.log(fails === 0 ? 'Physical observation refraction tests passed' : fails + ' failures')
process.exitCode = fails ? 1 : 0
