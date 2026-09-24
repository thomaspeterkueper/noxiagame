import type { TerrainSuitabilityCell } from './siteSuitability'
import type { SpaceportShortlistCandidate } from './spaceportShortlist'
import { SELMECKE_REFERENCE_SITE } from './earthReferenceSites'

type MetricPoint = { eastM: number; northM: number }

export type CorridorProfileSample = {
  distanceM: number
  elevationM: number
  surfaceSlopePercent: number
}

export type SpaceportCorridorAnalysis = {
  label: 'A' | 'B' | 'C'
  straightLineDistanceM: number
  sourceResolutionM: number
  sampledCells: number
  startElevationM: number | null
  endElevationM: number | null
  elevationDeltaM: number | null
  surfaceReliefM: number | null
  maxObservedSurfaceSlopePercent: number | null
  maxProfileGradePercent: number | null
  tunnelShare: null
  portalCandidates: []
  engineeringStatus: 'screening-only'
  profile: CorridorProfileSample[]
  notes: string[]
}

function toMetric(origin:{lat:number;lon:number},point:{lat:number;lon:number}):MetricPoint{
  return {
    eastM:(point.lon-origin.lon)*111_320*Math.cos(((origin.lat+point.lat)*Math.PI)/360),
    northM:(point.lat-origin.lat)*111_320,
  }
}

function nearestCell(point:MetricPoint,cells:Array<TerrainSuitabilityCell&MetricPoint>,limitM:number){
  let nearest:TerrainSuitabilityCell|null=null,best=Infinity
  for(const cell of cells){const distance=Math.hypot(cell.eastM-point.eastM,cell.northM-point.northM);if(distance<best){best=distance;nearest=cell}}
  return best<=limitM?nearest:null
}

/**
 * Coarse surface-corridor screening between Selmecke and each shortlisted site.
 * The result deliberately does not infer subsurface geology, tunnel share or portals.
 */
export function analyseSpaceportCorridors(
  shortlist:SpaceportShortlistCandidate[],
  terrainCells:TerrainSuitabilityCell[],
  sourceResolutionM:number,
):SpaceportCorridorAnalysis[]{
  const origin=SELMECKE_REFERENCE_SITE.point
  const metricCells=terrainCells.map(cell=>({...cell,...toMetric(origin,cell)}))
  const corridorHalfWidthM=Math.max(250,sourceResolutionM*.75)
  const endpointLimitM=Math.max(500,sourceResolutionM*1.5)

  return shortlist.map(site=>{
    const end=toMetric(origin,site)
    const length=Math.hypot(end.eastM,end.northM)
    const ux=length?end.eastM/length:0,uy=length?end.northM/length:0
    const samples=metricCells.flatMap(cell=>{
      const along=cell.eastM*ux+cell.northM*uy
      const lateral=Math.abs(cell.eastM*uy-cell.northM*ux)
      if(along<0||along>length||lateral>corridorHalfWidthM)return[]
      return[{cell,along}]
    }).sort((a,b)=>a.along-b.along)

    const startCell=nearestCell({eastM:0,northM:0},metricCells,endpointLimitM)
    const endCell=nearestCell(end,metricCells,endpointLimitM)
    const profile=samples.map(({cell,along})=>({distanceM:Math.round(along),elevationM:cell.elevationM,surfaceSlopePercent:cell.slopePercent}))
    const elevations=profile.map(sample=>sample.elevationM)
    let maxProfileGradePercent:number|null=null
    for(let index=1;index<profile.length;index++){
      const distance=profile[index].distanceM-profile[index-1].distanceM
      if(distance<=0)continue
      const grade=Math.abs(profile[index].elevationM-profile[index-1].elevationM)/distance*100
      maxProfileGradePercent=Math.max(maxProfileGradePercent??0,grade)
    }
    const startElevationM=startCell?.elevationM??null
    const endElevationM=endCell?.elevationM??null
    const elevationDeltaM=startElevationM!=null&&endElevationM!=null?Math.round((endElevationM-startElevationM)*10)/10:null
    const surfaceReliefM=elevations.length?Math.round((Math.max(...elevations)-Math.min(...elevations))*10)/10:null
    const maxObservedSurfaceSlopePercent=profile.length?Math.round(Math.max(...profile.map(sample=>sample.surfaceSlopePercent))*10)/10:null

    return {
      label:site.shortlistLabel,
      straightLineDistanceM:Math.round(length),
      sourceResolutionM,
      sampledCells:profile.length,
      startElevationM,
      endElevationM,
      elevationDeltaM,
      surfaceReliefM,
      maxObservedSurfaceSlopePercent,
      maxProfileGradePercent:maxProfileGradePercent==null?null:Math.round(maxProfileGradePercent*10)/10,
      tunnelShare:null,
      portalCandidates:[],
      engineeringStatus:'screening-only' as const,
      profile,
      notes:[
        'geradliniger Geländekorridor; noch keine optimierte Trasse',
        `Oberflächenprofil aus etwa ${sourceResolutionM} m DEM-Raster`,
        'Tunnelanteil und Portale benötigen Detail-DEM, Geologie und Trassierungsparameter',
      ],
    }
  })
}
