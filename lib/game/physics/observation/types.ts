// Physical observation contracts: ground truth remains distinct from propagated/apparent observation.
export type SpectralBand = 'visible' | 'red' | 'green' | 'blue'

export interface AtmosphericState {
  pressureHpa: number
  temperatureC: number
}

export interface GeometricDirection {
  altitudeDeg: number
  azimuthDeg: number
}

export interface PhysicalObservation {
  geometric: GeometricDirection
  apparent: GeometricDirection
  refractionDeg: number
  medium: 'vacuum' | 'atmosphere'
  spectralBand: SpectralBand
  model: string
}
