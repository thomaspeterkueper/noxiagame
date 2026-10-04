import { createServiceClient } from '@/lib/supabase/service'

type GeoPoint={lat:number;lon:number}
type OverpassElement={type?:'node'|'way'|'relation';id?:number;tags?:Record<string,string>;geometry?:GeoPoint[];members?:Array<{geometry?:GeoPoint[]}>}
type PreparedFeature={feature_type:string;geometry:{kind:'line'|'polygon';coordinates:GeoPoint[]};properties:Record<string,unknown>}

const PROFILE='local-scene-v1'
const ENDPOINTS=['https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter']

function bounds(lat:number,lon:number,radiusKm:number){const latDelta=radiusKm/111.32;const cosLat=Math.max(.05,Math.abs(Math.cos(lat*Math.PI/180)));const lonDelta=radiusKm/(111.32*cosLat);return{south:lat-latDelta,west:lon-lonDelta,north:lat+latDelta,east:lon+lonDelta}}
function simplify(points:GeoPoint[],max=56){if(points.length<=max)return points;const step=points.length/max;return Array.from({length:max},(_,index)=>points[Math.floor(index*step)])}
function polygon(points:GeoPoint[]){if(points.length<3)return false;const a=points[0],b=points[points.length-1];return Math.abs(a.lat-b.lat)<1e-8&&Math.abs(a.lon-b.lon)<1e-8}
function featureType(tags:Record<string,string>){if(tags.building)return'building';if(/^(footway|path|pedestrian|steps|cycleway|service|residential|living_street|unclassified)$/.test(tags.highway??''))return'road';if(/^(stream|ditch|drain)$/.test(tags.waterway??''))return'waterway';return null}
function toFeatures(elements:OverpassElement[]){
  const out:PreparedFeature[]=[]
  for(const element of elements){
    if(element.id==null)continue
    const tags=element.tags??{}
    const type=featureType(tags)
    if(!type)continue
    const geometries=element.type==='relation'?(element.members??[]).map(member=>member.geometry??[]):[element.geometry??[]]
    for(const [index,raw] of geometries.entries()){
      const points=raw.filter(point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon))
      if(points.length<2)continue
      const isPolygon=type==='building'&&polygon(points)
      const coords=simplify(points,isPolygon?64:48)
      if(isPolygon&&coords.length>=3){const first=coords[0],last=coords[coords.length-1];if(Math.abs(first.lat-last.lat)>1e-8||Math.abs(first.lon-last.lon)>1e-8)coords.push(first)}
      const sourceId='osm:'+String(element.type)+':'+String(element.id)+(element.type==='relation'?':member:'+String(index):'')
      out.push({
        feature_type:type,
        geometry:{kind:isPolygon?'polygon':'line',coordinates:coords},
        properties:{...tags,noxia_source:'OpenStreetMap',noxia_source_id:sourceId,noxia_provenance:'observed',noxia_enrichment:PROFILE,visual_seed:sourceId,visual_class:type==='building'?(tags.building??'building'):(tags.highway??tags.waterway??type)},
      })
    }
  }
  return out
}
function query(lat:number,lon:number,radiusKm:number){
  const b=bounds(lat,lon,radiusKm)
  const box=[b.south,b.west,b.north,b.east].join(',')
  return '[out:json][timeout:12];(way[building]('+box+');relation[building]('+box+');way[highway~"footway|path|pedestrian|steps|cycleway|service|residential|living_street|unclassified"]('+box+');way[waterway~"stream|ditch|drain"]('+box+'););out geom;'
}

export async function enrichEarthLocalScene(input:{slug:string;lat:number;lon:number;radiusKm?:number}){
  const supabase=createServiceClient()
  const radiusKm=Math.min(.5,Math.max(.2,input.radiusKm??.34))
  const {data:region,error:regionError}=await supabase.from('celestial_regions').select('id,slug,enrichment_version').eq('slug',input.slug).maybeSingle()
  if(regionError)throw regionError
  if(!region)throw new Error('Earth place not found')

  const {data:existing,error:existingError}=await supabase.from('region_features').select('id').eq('region_id',region.id).contains('properties',{noxia_enrichment:PROFILE})
  if(existingError)throw existingError
  if((existing??[]).length>0)return{ok:true,status:'ready' as const,total:existing!.length,cached:true}

  const failures:string[]=[]
  let prepared:PreparedFeature[]|null=null
  let source=''
  const overpassQuery=query(input.lat,input.lon,radiusKm)
  for(const endpoint of ENDPOINTS){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000)
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'NOXIA/0.1 earth-local-enrichment'},body:new URLSearchParams({data:overpassQuery}),signal:controller.signal,cache:'no-store'})
      if(!response.ok){failures.push(new URL(endpoint).host+': HTTP '+response.status);continue}
      const payload=await response.json() as {elements?:OverpassElement[]}
      prepared=toFeatures(payload.elements??[])
      source='overpass:'+new URL(endpoint).host+':'+PROFILE
      break
    }catch(error){failures.push(new URL(endpoint).host+': '+(error instanceof Error?error.message:String(error)))}finally{clearTimeout(timer)}
  }
  if(!prepared)throw new Error('Local enrichment failed: '+failures.join('; '))
  if(prepared.length){for(let index=0;index<prepared.length;index+=300){const {error}=await supabase.from('region_features').insert(prepared.slice(index,index+300).map(feature=>({...feature,region_id:region.id})));if(error)throw error}}
  const {error:updateError}=await supabase.from('celestial_regions').update({enrichment_version:Math.max(2,Number(region.enrichment_version??0)),source_checked_at:new Date().toISOString()}).eq('id',region.id)
  if(updateError)throw updateError
  return{ok:true,status:'ready' as const,total:prepared.length,cached:false,source}
}