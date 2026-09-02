import type { ImportedEarthFeature } from './earthFeatureSource'
import type { SpaceportCandidate } from './spaceportSuitability'
import type { SpaceportShortlistCandidate } from './spaceportShortlist'

export type SpaceportAreaAnalysis = {
  label: 'A' | 'B' | 'C'
  center: { lat: number; lon: number }
  analysisRadiusM: number
  usableAreaHa: number
  usableShare: number
  connectedSuitableCells: number
  maxConnectedSpanM: number
  expansionScore: number
  corridorScore: number
  accessScore: number
  areaScore: number
  verdict: 'strong' | 'conditional' | 'weak'
  notes: string[]
}

function distanceM(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const latM=(b.lat-a.lat)*111_320
 const lonM=(b.lon-a.lon)*111_320*Math.cos(((a.lat+b.lat)*Math.PI)/360)
 return Math.hypot(latM,lonM)
}

function featurePoints(feature:ImportedEarthFeature){return feature.geometry.kind==='point'?[feature.geometry.coordinates]:feature.geometry.coordinates}
function nearestFeatureDistance(point:{lat:number;lon:number},features:ImportedEarthFeature[],types:string[]){
 let best=Infinity
 for(const feature of features){if(!types.includes(feature.featureType))continue;for(const p of featurePoints(feature))best=Math.min(best,distanceM(point,p))}
 return best
}

/** Area-level planning pass around each shortlist point.
 * This uses the measured DEM sample field and current OSM geometry. It is intentionally
 * conservative: it estimates contiguous buildable terrain but does not claim cadastral,
 * environmental-law or launch-safety approval.
 */
export function analyseSpaceportAreas(shortlist:SpaceportShortlistCandidate[],ranked:SpaceportCandidate[],features:ImportedEarthFeature[],radiusM=1000):SpaceportAreaAnalysis[]{
 return shortlist.map(site=>{
  const local=ranked.filter(c=>distanceM(site,c)<=radiusM)
  const suitable=local.filter(c=>c.slopePercent<=5&&c.terrainScore>=55&&(c.exclusionDistanceM===null||c.exclusionDistanceM>=300))
  const sampleSpacing=500
  const cellAreaHa=(sampleSpacing*sampleSpacing)/10_000
  const usableAreaHa=Math.round(suitable.length*cellAreaHa*10)/10
  const usableShare=local.length?Math.round((suitable.length/local.length)*100)/100:0
  let maxConnectedSpanM=0
  for(let i=0;i<suitable.length;i++)for(let j=i+1;j<suitable.length;j++)maxConnectedSpanM=Math.max(maxConnectedSpanM,distanceM(suitable[i],suitable[j]))
  const road=nearestFeatureDistance(site,features,['road'])
  const rail=nearestFeatureDistance(site,features,['rail'])
  const sensitive=nearestFeatureDistance(site,features,['building','settlement','water','waterway','forest'])
  const expansionScore=Math.max(0,Math.min(100,usableShare*75+Math.min(25,usableAreaHa/4)))
  const corridorScore=Math.max(0,Math.min(100,(maxConnectedSpanM/1800)*100))
  const accessScore=Math.max(0,Math.min(100,100-Math.min(60,road/35)-Math.min(40,rail/100)))
  const areaScore=Math.round(site.score*.35+expansionScore*.3+corridorScore*.2+accessScore*.15)
  const notes:string[]=[]
  if(usableAreaHa>=100)notes.push('große zusammenhängende Ausbaureserve im 1-km-Prüfradius')
  else if(usableAreaHa>=50)notes.push('mittlere Ausbaureserve')
  else notes.push('begrenzte ebene Ausbaufläche')
  if(maxConnectedSpanM>=1500)notes.push('Korridorpotenzial über mindestens 1,5 km')
  else notes.push('kein belastbarer langer Korridor im aktuellen Raster')
  if(road<1200)notes.push('Straßenerschließung günstig')
  if(rail<2500)notes.push('Bahnanschluss im erweiterten Umfeld')
  if(sensitive<500)notes.push('sensible Realweltnutzung bleibt ein Planungsrisiko')
  return {label:site.shortlistLabel,center:{lat:site.lat,lon:site.lon},analysisRadiusM:radiusM,usableAreaHa,usableShare,connectedSuitableCells:suitable.length,maxConnectedSpanM:Math.round(maxConnectedSpanM),expansionScore:Math.round(expansionScore),corridorScore:Math.round(corridorScore),accessScore:Math.round(accessScore),areaScore,verdict:areaScore>=70?'strong':areaScore>=50?'conditional':'weak',notes}
 }).sort((a,b)=>b.areaScore-a.areaScore)
}
