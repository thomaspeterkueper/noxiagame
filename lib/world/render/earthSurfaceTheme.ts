export type EarthSurfaceClass = 'tropical_humid' | 'semi_arid' | 'temperate' | 'cold'

type FeatureLike = { featureType?: string; properties?: Record<string, unknown> }

export type EarthSurfaceTheme = {
  surfaceClass: EarthSurfaceClass
  label: string
  background: string
  backgroundAlt: string
  vegetation: string
  sparseVegetation: boolean
}

export function deriveEarthSurfaceTheme(lat: number, features: FeatureLike[] = []): EarthSurfaceTheme {
  const absoluteLat = Math.abs(lat)
  const forest = features.filter(feature => feature.featureType === 'forest').length
  const vegetation = features.filter(feature => feature.featureType === 'vegetation').length
  const water = features.filter(feature => feature.featureType === 'water' || feature.featureType === 'waterway').length
  const total = Math.max(1, features.length)
  const forestShare = forest / total
  const greenShare = (forest + vegetation) / total
  const waterShare = water / total

  if (absoluteLat < 15 && (greenShare > .06 || waterShare > .015)) {
    return {
      surfaceClass: 'tropical_humid',
      label: 'tropisch-feucht · aus Breitenlage und Landcover abgeleitet',
      background: '#78945f',
      backgroundAlt: '#6f8958',
      vegetation: '#496f43',
      sparseVegetation: false,
    }
  }

  if (absoluteLat >= 15 && absoluteLat <= 35 && forestShare < .04) {
    return {
      surfaceClass: 'semi_arid',
      label: 'semiarid / Savanne · aus Breitenlage und Landcover abgeleitet',
      background: '#c7b47a',
      backgroundAlt: '#b9a56e',
      vegetation: '#7d8d55',
      sparseVegetation: true,
    }
  }

  if (absoluteLat >= 60) {
    return {
      surfaceClass: 'cold',
      label: 'kühl/boreal · aus Breitenlage abgeleitet',
      background: '#a9ae91',
      backgroundAlt: '#969d84',
      vegetation: '#64745d',
      sparseVegetation: false,
    }
  }

  return {
    surfaceClass: 'temperate',
    label: 'gemäßigt · aus Breitenlage und Landcover abgeleitet',
    background: '#9caf78',
    backgroundAlt: '#8fa16c',
    vegetation: '#58764e',
    sparseVegetation: false,
  }
}
