import type { AtmosphericState, GeometricDirection, PhysicalObservation, SpectralBand } from './types.ts'

export const ATMOSPHERIC_REFRACTION_KG_MODEL_ID = 'MOD:L2:bennett-atmosphaerische-refraktion' as const

const DEG = Math.PI / 180

// Bennett-style near-horizon approximation, scaled by local pressure/temperature.
// Valid as a gameplay/learning approximation near the optical horizon; not a ray tracer.
export function atmosphericRefractionDeg(
  geometricAltitudeDeg: number,
  atmosphere: AtmosphericState,
): number {
  if (atmosphere.pressureHpa <= 0 || geometricAltitudeDeg < -1 || geometricAltitudeDeg > 90) return 0
  const h = Math.max(-0.99, geometricAltitudeDeg)
  const standardArcMin =
    1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG)
  const pressureScale = atmosphere.pressureHpa / 1010
  const temperatureScale = 283 / (273 + atmosphere.temperatureC)
  return Math.max(0, (standardArcMin / 60) * pressureScale * temperatureScale)
}

export function observeThroughAtmosphere(opts: {
  geometric: GeometricDirection
  atmosphere?: AtmosphericState | null
  spectralBand?: SpectralBand
}): PhysicalObservation {
  const band = opts.spectralBand ?? 'visible'
  if (!opts.atmosphere || opts.atmosphere.pressureHpa <= 0) {
    return {
      geometric: { ...opts.geometric },
      apparent: { ...opts.geometric },
      refractionDeg: 0,
      medium: 'vacuum',
      spectralBand: band,
      model: 'none',
    }
  }
  const refractionDeg = atmosphericRefractionDeg(opts.geometric.altitudeDeg, opts.atmosphere)
  return {
    geometric: { ...opts.geometric },
    apparent: {
      altitudeDeg: opts.geometric.altitudeDeg + refractionDeg,
      azimuthDeg: opts.geometric.azimuthDeg,
    },
    refractionDeg,
    medium: 'atmosphere',
    spectralBand: band,
    model: ATMOSPHERIC_REFRACTION_KG_MODEL_ID,
  }
}
