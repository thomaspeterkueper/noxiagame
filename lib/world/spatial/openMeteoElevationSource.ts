import type { GeoBounds } from './earthFeatureSource'
import type { EarthElevationSource, ElevationGrid, ElevationSample } from './elevationSource'

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation'

/**
 * Lightweight bootstrap adapter for Copernicus DEM GLO-90 via Open-Meteo.
 * Provider details stay behind EarthElevationSource so a native DEM pipeline
 * can replace it later without changing NOXIA world/rendering semantics.
 */
export class OpenMeteoElevationSource implements EarthElevationSource {
  readonly id = 'open-meteo-copernicus-glo90'

  async load(bounds: GeoBounds, targetResolutionM = 500): Promise<ElevationGrid> {
    const midLat = (bounds.south + bounds.north) / 2
    const metresPerLat = 111_320
    const metresPerLon = Math.max(1, metresPerLat * Math.cos(midLat * Math.PI / 180))
    const widthM = Math.max(1, (bounds.east - bounds.west) * metresPerLon)
    const heightM = Math.max(1, (bounds.north - bounds.south) * metresPerLat)
    const cols = Math.max(3, Math.min(18, Math.ceil(widthM / targetResolutionM) + 1))
    const rows = Math.max(3, Math.min(18, Math.ceil(heightM / targetResolutionM) + 1))
    const points: { lat:number; lon:number }[] = []
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) points.push({
      lat: bounds.north - (r/(rows-1))*(bounds.north-bounds.south),
      lon: bounds.west + (c/(cols-1))*(bounds.east-bounds.west),
    })

    const samples: ElevationSample[] = []
    for (let start=0; start<points.length; start+=100) {
      const batch=points.slice(start,start+100)
      const params=new URLSearchParams({
        latitude: batch.map(p=>p.lat.toFixed(6)).join(','),
        longitude: batch.map(p=>p.lon.toFixed(6)).join(','),
      })
      const response=await fetch(`${ENDPOINT}?${params}`,{next:{revalidate:86400}})
      if(!response.ok) throw new Error(`Elevation source failed: ${response.status}`)
      const json=await response.json() as { elevation?: number[] }
      if(!Array.isArray(json.elevation)||json.elevation.length!==batch.length) throw new Error('Elevation source returned an invalid sample set')
      batch.forEach((p,i)=>samples.push({...p,elevationM:Number(json.elevation![i])}))
    }

    return {
      bounds,cols,rows,samples,
      source:{provider:'Open-Meteo',dataset:'Copernicus DEM 2021 GLO-90',resolutionM:90,license:'Copernicus DEM / Open-Meteo attribution required'},
    }
  }
}

export const openMeteoElevationSource = new OpenMeteoElevationSource()
