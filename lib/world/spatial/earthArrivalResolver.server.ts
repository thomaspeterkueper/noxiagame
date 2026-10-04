import { createServiceClient } from '@/lib/supabase/service'

type GeoPoint = { lat:number; lon:number }
type ArrivalKind = 'spaceport'|'airport'|'rail_station'|'bus_station'|'transit_stop'|'center'
type ArrivalNode = {
  id:string
  name:string
  kind:ArrivalKind
  point:GeoPoint
  priority:number
  source:string
}

type OverpassElement = {
  type?:'node'|'way'|'relation'
  id?:number
  lat?:number
  lon?:number
  center?:GeoPoint
  tags?:Record<string,string>
}

const ENDPOINTS=[
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

function distanceM(a:GeoPoint,b:GeoPoint){
  const lat=(a.lat+b.lat)*Math.PI/360
  const dx=(b.lon-a.lon)*111320*Math.cos(lat)
  const dy=(b.lat-a.lat)*110540
  return Math.hypot(dx,dy)
}

function classify(tags:Record<string,string>):{kind:ArrivalKind;priority:number}|null{
  const name=(tags.name??'').toLowerCase()
  if(/spaceport|raumhafen|cosmodrome/.test(name)||tags.aeroway==='spaceport')return{kind:'spaceport',priority:500}
  if(tags.aeroway==='aerodrome'||tags.aeroway==='terminal')return{kind:'airport',priority:400}
  if(tags.railway==='station')return{kind:'rail_station',priority:300}
  if(tags.amenity==='bus_station'||(tags.public_transport==='station'&&tags.bus==='yes'))return{kind:'bus_station',priority:200}
  if(tags.highway==='bus_stop'||tags.public_transport==='platform'||tags.railway==='halt')return{kind:'transit_stop',priority:100}
  return null
}

function score(node:ArrivalNode,center:GeoPoint){
  // Class dominates. Within one class, prefer named/central nodes.
  return node.priority*100000-Math.min(50000,distanceM(center,node.point))
}

async function queryArrivalNodes(center:GeoPoint,radiusM=12000):Promise<ArrivalNode[]>{
  const query=`[out:json][timeout:12];(
nwr(around:${radiusM},${center.lat},${center.lon})[aeroway~"aerodrome|terminal|spaceport"];
nwr(around:${radiusM},${center.lat},${center.lon})[railway~"station|halt"];
nwr(around:${radiusM},${center.lat},${center.lon})[amenity=bus_station];
nwr(around:${radiusM},${center.lat},${center.lon})[public_transport=station];
node(around:${radiusM},${center.lat},${center.lon})[highway=bus_stop];
);out center;`
  const failures:string[]=[]
  for(const endpoint of ENDPOINTS){
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(),10000)
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'NOXIA/0.1 earth-arrival-resolver'},
        body:new URLSearchParams({data:query}),
        signal:controller.signal,
        cache:'no-store',
      })
      if(!response.ok){failures.push(`${new URL(endpoint).host}: HTTP ${response.status}`);continue}
      const payload=await response.json() as {elements?:OverpassElement[]}
      const nodes:ArrivalNode[]=[]
      for(const element of payload.elements??[]){
        if(element.id==null)continue
        const tags=element.tags??{}
        const cls=classify(tags)
        if(!cls)continue
        const point=element.type==='node'&&Number.isFinite(element.lat)&&Number.isFinite(element.lon)
          ? {lat:element.lat!,lon:element.lon!}
          : element.center
        if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))continue
        nodes.push({
          id:`osm:${element.type}:${element.id}`,
          name:tags.name??(cls.kind==='airport'?'Flughafen':cls.kind==='rail_station'?'Bahnhof':cls.kind==='bus_station'?'Busbahnhof':'Haltestelle'),
          kind:cls.kind,
          point,
          priority:cls.priority,
          source:'OpenStreetMap',
        })
      }
      return nodes
    }catch(error){
      failures.push(`${new URL(endpoint).host}: ${error instanceof Error?error.message:String(error)}`)
    }finally{clearTimeout(timer)}
  }
  throw new Error(`Ankunftsknoten konnten nicht ermittelt werden: ${failures.join('; ')}`)
}

export async function resolveEarthArrival(input:{placeSlug:string;label:string;center:GeoPoint}):Promise<ArrivalNode>{
  const supabase=createServiceClient()
  const {data:region}=await supabase.from('celestial_regions').select('id').eq('slug',input.placeSlug).maybeSingle()

  if(region){
    const {data:stored}=await supabase
      .from('region_features')
      .select('id,geometry,properties')
      .eq('region_id',region.id)
      .eq('feature_type','arrival_node')
    const nodes=(stored??[]).flatMap((row:any)=>{
      const point=row.geometry?.kind==='point'?row.geometry.coordinates:null
      if(!point||!Number.isFinite(Number(point.lat))||!Number.isFinite(Number(point.lon)))return[]
      const props=row.properties??{}
      return[{
        id:String(row.id),
        name:String(props.name??'Ankunft'),
        kind:String(props.arrival_kind??'center') as ArrivalKind,
        point:{lat:Number(point.lat),lon:Number(point.lon)},
        priority:Number(props.arrival_priority??0),
        source:String(props.noxia_source??'NOXIA'),
      }]
    })
    if(nodes.length)return nodes.sort((a,b)=>score(b,input.center)-score(a,input.center))[0]
  }

  let candidates:ArrivalNode[]=[]
  try{candidates=await queryArrivalNodes(input.center)}catch{}
  const chosen=candidates.sort((a,b)=>score(b,input.center)-score(a,input.center))[0]??{
    id:`center:${input.placeSlug}`,
    name:`${input.label} · Ortszentrum`,
    kind:'center' as const,
    point:input.center,
    priority:0,
    source:'NOXIA place center',
  }

  if(region&&chosen.kind!=='center'){
    await supabase.from('region_features').insert({
      region_id:region.id,
      feature_type:'arrival_node',
      geometry:{kind:'point',coordinates:chosen.point},
      properties:{
        name:chosen.name,
        arrival_kind:chosen.kind,
        arrival_priority:chosen.priority,
        noxia_source:chosen.source,
        noxia_provenance:'observed',
        arrival_resolver_version:1,
      },
    })
  }

  return chosen
}
