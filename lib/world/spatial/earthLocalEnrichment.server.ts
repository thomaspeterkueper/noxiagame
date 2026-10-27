// lib/world/spatial/earthLocalEnrichment.server.ts
// Aktualisiert: 26.10.2026 — Profil local-scene-v4: Tierarzt, Tankstelle/Waschanlage, benannte Industrie- und Werkstattgebäude als poi (Grundlage für Betriebe im Spiel); Overpass-Spiegel parallel statt nacheinander abfragen (erste gültige Antwort gewinnt), zusätzlicher Spiegel
// Version:      1.3.0

import { createServiceClient } from '@/lib/supabase/service'
import { earthPlaceSlug } from './earthPlaceIdentity'
import { EARTH_LOCAL_ENRICHMENT_PROFILE } from './earthLocalScene'

type GeoPoint={lat:number;lon:number}
type OverpassElement={type?:'node'|'way'|'relation';id?:number;lat?:number;lon?:number;tags?:Record<string,string>;geometry?:GeoPoint[];members?:Array<{geometry?:GeoPoint[]}>}
type PreparedFeature={feature_type:string;geometry:{kind:'line'|'polygon';coordinates:GeoPoint[]}|{kind:'point';coordinates:GeoPoint};properties:Record<string,unknown>}

const PROFILE=EARTH_LOCAL_ENRICHMENT_PROFILE
/** Marks a region row that only carries the local detail layer, no regional geography. */
export const EARTH_LOCAL_DETAIL_SOURCE='noxia:local-detail'
const ENDPOINTS=['https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const ENDPOINT_TIMEOUT_MS=20000
const LOCAL_HIGHWAYS='footway|path|pedestrian|steps|cycleway|service|residential|living_street|unclassified|track'
const LOCAL_WATERWAYS='river|canal|stream|ditch|drain'
const HIGHWAY_PATTERN=new RegExp('^('+LOCAL_HIGHWAYS+')$')
const WATERWAY_PATTERN=new RegExp('^('+LOCAL_WATERWAYS+')$')

function bounds(lat:number,lon:number,radiusKm:number){const latDelta=radiusKm/111.32;const cosLat=Math.max(.05,Math.abs(Math.cos(lat*Math.PI/180)));const lonDelta=radiusKm/(111.32*cosLat);return{south:lat-latDelta,west:lon-lonDelta,north:lat+latDelta,east:lon+lonDelta}}
function simplify(points:GeoPoint[],max=56){if(points.length<=max)return points;const step=(points.length-1)/(max-1);return Array.from({length:max},(_,index)=>points[Math.round(index*step)])}
function polygon(points:GeoPoint[]){if(points.length<3)return false;const a=points[0],b=points[points.length-1];return Math.abs(a.lat-b.lat)<1e-8&&Math.abs(a.lon-b.lon)<1e-8}
// Benannte Läden und Lokale (Weltkarte, 25.10.2026): Ziele für Spieler und Gespräche.
const POI_AMENITIES='cafe|restaurant|bar|pub|biergarten|fast_food|ice_cream|bank|pharmacy|post_office|doctors|dentist|fuel|car_wash|veterinary|cinema|kindergarten|school'
const POI_AMENITY_PATTERN=new RegExp('^('+POI_AMENITIES+')$')
function poiClass(tags:Record<string,string>){if(!tags.name)return null;if(tags.shop)return'shop';if(POI_AMENITY_PATTERN.test(tags.amenity??''))return tags.amenity;if(tags.tourism==='hotel'||tags.tourism==='guest_house')return tags.tourism;if(tags.craft)return'craft';if(tags.office)return'office';if(tags.industrial||/^(industrial|manufacture|warehouse|factory)$/.test(tags.building??''))return'industrial';return null}
function featureType(tags:Record<string,string>){if(tags.building)return'building';if(HIGHWAY_PATTERN.test(tags.highway??''))return'road';if(WATERWAY_PATTERN.test(tags.waterway??''))return'waterway';return null}
function toFeatures(elements:OverpassElement[]){
  const out:PreparedFeature[]=[]
  for(const element of elements){
    if(element.id==null)continue
    const tags=element.tags??{}
    // Laden oder Lokal: als Punkt (Knoten selbst, sonst Mitte der Fläche); ein Gebäude mit Laden zählt zusätzlich als Gebäude.
    const poi=poiClass(tags)
    if(poi){
      const ring=element.geometry??element.members?.flatMap(member=>member.geometry??[])??[]
      const at=element.type==='node'&&Number.isFinite(element.lat)&&Number.isFinite(element.lon)?{lat:element.lat!,lon:element.lon!}
        :ring.length?{lat:ring.reduce((sum,p)=>sum+p.lat,0)/ring.length,lon:ring.reduce((sum,p)=>sum+p.lon,0)/ring.length}:null
      if(at){
        const sourceId='osm:'+String(element.type)+':'+String(element.id)+':poi'
        out.push({feature_type:'poi',geometry:{kind:'point',coordinates:at},properties:{...tags,noxia_source:'OpenStreetMap',noxia_source_id:sourceId,noxia_provenance:'observed',noxia_enrichment:PROFILE,visual_seed:sourceId,visual_class:poi}})
      }
    }
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
  return '[out:json][timeout:12];(way[building]('+box+');relation[building]('+box+');way[highway~"'+LOCAL_HIGHWAYS+'"]('+box+');way[waterway~"'+LOCAL_WATERWAYS+'"]('+box+');nwr[name][shop]('+box+');nwr[name][amenity~"'+POI_AMENITIES+'"]('+box+');nwr[name][tourism~"hotel|guest_house"]('+box+');nwr[name][industrial]('+box+');way[name][building~"industrial|manufacture|warehouse|factory"]('+box+');nwr[name][craft]('+box+');nwr[name][office]('+box+'););out geom;'
}

export async function enrichEarthLocalScene(input:{slug:string;lat:number;lon:number;radiusKm?:number;/** Ohne wartenden Spieler (stündlicher Lauf): bis 55 s Wartezeit, 50 s Rechenzeit auf dem Server. */patient?:boolean}){
  const supabase=createServiceClient()
  const radiusKm=Math.min(.5,Math.max(.2,input.radiusKm??.34))
  const {data:found,error:regionError}=await supabase.from('celestial_regions').select('id,slug,enrichment_version').eq('slug',input.slug).maybeSingle()
  if(regionError)throw regionError
  let region=found
  if(!region){
    // A regional view (e.g. Home inside the Sauerland snapshot) has no place row
    // of its own. Its local detail is kept in a detail-only row identified by
    // the canonical coordinate slug, never in the shared regional snapshot.
    if(input.slug!==earthPlaceSlug({lat:input.lat,lon:input.lon}))throw new Error('Earth place not found')
    const {data:created,error:createError}=await supabase.from('celestial_regions').upsert({
      body:'earth',
      slug:input.slug,
      label:'Lokaldetail '+input.lat.toFixed(5)+', '+input.lon.toFixed(5),
      center_lat:input.lat,
      center_lon:input.lon,
      radius_km:radiusKm,
      bounds:bounds(input.lat,input.lon,radiusKm),
      source:EARTH_LOCAL_DETAIL_SOURCE,
      imported_at:null,
      source_checked_at:new Date().toISOString(),
    },{onConflict:'slug'}).select('id,slug,enrichment_version').single()
    if(createError||!created)throw createError??new Error('Earth place not found')
    region=created
  }

  const {data:existing,error:existingError}=await supabase.from('region_features').select('id').eq('region_id',region.id).contains('properties',{noxia_enrichment:PROFILE})
  if(existingError)throw existingError
  if((existing??[]).length>0)return{ok:true,status:'ready' as const,total:existing!.length,cached:true}

  // The public Overpass mirrors are frequently overloaded. Ask all of them at
  // once and keep the first valid answer instead of waiting out each timeout.
  const failures:string[]=[]
  let prepared:PreparedFeature[]|null=null
  let source=''
  const overpassQuery=input.patient?query(input.lat,input.lon,radiusKm).replace('[timeout:12]','[timeout:50]'):query(input.lat,input.lon,radiusKm)
  const endpointTimeoutMs=input.patient?55000:ENDPOINT_TIMEOUT_MS
  const controllers=ENDPOINTS.map(()=>new AbortController())
  try{
    const winner=await Promise.any(ENDPOINTS.map(async(endpoint,index)=>{
      const host=new URL(endpoint).host
      const timer=setTimeout(()=>controllers[index].abort(),endpointTimeoutMs)
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'NOXIA/0.1 earth-local-enrichment'},body:new URLSearchParams({data:overpassQuery}),signal:controllers[index].signal,cache:'no-store'})
        if(!response.ok)throw new Error('HTTP '+response.status)
        const payload=await response.json() as {elements?:OverpassElement[];remark?:string}
        // A timed-out query still answers 200 with a remark and no data.
        if(!Array.isArray(payload.elements)||(payload.elements.length===0&&payload.remark))throw new Error(payload.remark??'keine Daten')
        return{host,elements:payload.elements}
      }catch(error){
        failures.push(host+': '+(error instanceof Error?error.message:String(error)))
        throw error
      }finally{clearTimeout(timer)}
    }))
    prepared=toFeatures(winner.elements)
    source='overpass:'+winner.host+':'+PROFILE
  }catch{}
  finally{for(const controller of controllers)controller.abort()}
  if(!prepared)throw new Error('Local enrichment failed: '+failures.join('; '))

  // Rows of an older enrichment profile stay visible until the new snapshot is
  // fully written; a failed import never removes existing detail.
  const {data:outdated,error:outdatedError}=await supabase.from('region_features').select('id').eq('region_id',region.id).not('properties->>noxia_enrichment','is',null)
  if(outdatedError)throw outdatedError
  const outdatedIds=(outdated??[]).map(row=>String(row.id))

  if(prepared.length){
    const insertedIds:string[]=[]
    try{
      for(let index=0;index<prepared.length;index+=300){
        const {data:inserted,error}=await supabase.from('region_features').insert(prepared.slice(index,index+300).map(feature=>({...feature,region_id:region.id}))).select('id')
        if(error)throw error
        insertedIds.push(...(inserted??[]).map(row=>String(row.id)))
      }
    }catch(insertError){
      for(let index=0;index<insertedIds.length;index+=300)await supabase.from('region_features').delete().in('id',insertedIds.slice(index,index+300))
      throw insertError
    }
    for(let index=0;index<outdatedIds.length;index+=300){
      const {error}=await supabase.from('region_features').delete().in('id',outdatedIds.slice(index,index+300))
      if(error)throw error
    }
  }
  const {error:updateError}=await supabase.from('celestial_regions').update({enrichment_version:Math.max(3,Number(region.enrichment_version??0)),source_checked_at:new Date().toISOString()}).eq('id',region.id)
  if(updateError)throw updateError
  return{ok:true,status:'ready' as const,total:prepared.length,cached:false,source}
}
