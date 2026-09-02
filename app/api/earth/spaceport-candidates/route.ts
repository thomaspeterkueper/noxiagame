import { NextRequest, NextResponse } from 'next/server'
import { openMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES, type GeoBounds } from '@/lib/world/spatial/earthFeatureSource'
import { EARTH_SAUERLAND_REGION } from '@/lib/world/spatial/regions'
import { analyseTerrainSuitability } from '@/lib/world/spatial/siteSuitability'
import { rankSpaceportCandidates } from '@/lib/world/spatial/spaceportSuitability'
import { createSpaceportShortlist } from '@/lib/world/spatial/spaceportShortlist'
import { analyseSpaceportAreas } from '@/lib/world/spatial/spaceportAreaAnalysis'
import { SAUERLAND_2086_SCENARIO, applySauerland2086Scenario } from '@/lib/world/spatial/sauerland2086Scenario'

export const dynamic = 'force-dynamic'
const earthSource = new OverpassEarthFeatureSource()

function boundsAround(radiusKm:number):GeoBounds{
 const {lat,lon}=EARTH_SAUERLAND_REGION.origin
 const latDelta=radiusKm/111.32
 const lonDelta=radiusKm/(111.32*Math.cos(lat*Math.PI/180))
 return {south:lat-latDelta,west:lon-lonDelta,north:lat+latDelta,east:lon+lonDelta}
}

export async function GET(request:NextRequest){
 try{
  const radiusKm=Math.min(6,Math.max(1,Number(request.nextUrl.searchParams.get('radiusKm')??3)))
  const bounds=boundsAround(radiusKm)
  const[elevation,features]=await Promise.all([openMeteoElevationSource.load(bounds,500),earthSource.load({bounds,classes:CURRENT_EARTH_BOOTSTRAP_CLASSES})])
  const terrain=analyseTerrainSuitability(elevation)
  const ranked=rankSpaceportCandidates(terrain.cells,features)
  const shortlist=createSpaceportShortlist(ranked)
  const areaAnalysis=analyseSpaceportAreas(shortlist,ranked,features)
  const scenario2086=areaAnalysis.map(applySauerland2086Scenario).sort((a,b)=>b.futureScore-a.futureScore)
  return NextResponse.json({ok:true,bounds,candidates:ranked.slice(0,8),shortlist,areaAnalysis,recommendedArea:areaAnalysis[0]??null,scenario2086:{definition:SAUERLAND_2086_SCENARIO,areas:scenario2086,recommendedArea:scenario2086[0]??null,status:'speculative scenario layer; not forecast and not present-day ground truth'},evaluatedCells:ranked.length,featureCount:features.length,methodology:{terrain:'elevation, slope and local relief',exclusions:['water','waterway','building','settlement','forest'],access:['road','rail'],shortlist:'up to three candidates separated by at least 1.2 km',area:'1 km radius; usable terrain, expansion reserve, corridor span and access',futureScenario:'2086 scenario changes planning weights and assumed infrastructure, never the measured terrain',status:'planning heuristic; not canonical placement'},attribution:'Terrain: Copernicus DEM via Open-Meteo · Geography: © OpenStreetMap contributors, ODbL'},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}})
 }catch(error){console.error('earth spaceport candidates',error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Candidate analysis unavailable'},{status:502})}
}
