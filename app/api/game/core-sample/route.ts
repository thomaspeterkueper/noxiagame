import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { haversineKm, type ResourceTier } from '@/lib/game/resourceScanning'

const CORE_SAMPLE_RADIUS_KM = 0.005

type DepthPresetId = 'shallow' | 'medium' | 'deep'
type DepthPreset = { id:DepthPresetId; label:string; depthM:number; energyCost:number; componentCost:number; durationSeconds:number }
type DrillRigId = 'core_sample' | 'drill_rig_rotary' | 'drill_rig_deep'
type DrillRig = { id:DrillRigId; label:string; maxDepthM:number; energyMultiplier:number; durationMultiplier:number; serviceFactor:number }

const DEPTH_PRESETS: Record<DepthPresetId,DepthPreset> = {
  shallow:{id:'shallow',label:'Flachbohrung',depthM:10,energyCost:25,componentCost:1,durationSeconds:15*60},
  medium:{id:'medium',label:'Mittlere Bohrung',depthM:50,energyCost:55,componentCost:2,durationSeconds:45*60},
  deep:{id:'deep',label:'Tiefbohrung',depthM:200,energyCost:140,componentCost:4,durationSeconds:120*60},
}

const DRILL_RIGS: Record<DrillRigId,DrillRig> = {
  core_sample:{id:'core_sample',label:'Mobiles Bohrkern-Set',maxDepthM:10,energyMultiplier:1,durationMultiplier:1,serviceFactor:1},
  drill_rig_rotary:{id:'drill_rig_rotary',label:'Rotationsbohranlage',maxDepthM:50,energyMultiplier:.9,durationMultiplier:.85,serviceFactor:2},
  drill_rig_deep:{id:'drill_rig_deep',label:'Tiefbohranlage',maxDepthM:200,energyMultiplier:.85,durationMultiplier:.8,serviceFactor:3},
}

function rigWear(rig:DrillRig,depthM:number){return Math.max(2,Math.ceil(2+6*(depthM/rig.maxDepthM)))}
function effectivePreset(preset:DepthPreset,rig:DrillRig){return {...preset,energyCost:Math.ceil(preset.energyCost*rig.energyMultiplier),durationSeconds:Math.ceil(preset.durationSeconds*rig.durationMultiplier),wearCost:rigWear(rig,preset.depthM)}}
function serviceCost(rig:DrillRig,condition:number){return condition>=100?0:Math.max(1,Math.ceil((100-condition)/25))*rig.serviceFactor}

async function authenticatedUser(req:NextRequest){const token=req.headers.get('authorization')?.split(' ')[1];if(!token)return null;const supabase=createServiceClient();const{data:{user}}=await supabase.auth.getUser(token);return user??null}
async function findRegionFor(supabase:ReturnType<typeof createServiceClient>,lat:number,lon:number){const{data:regions}=await supabase.from('celestial_regions').select('id,slug,bounds');for(const region of regions??[]){const b=region.bounds as {south:number;west:number;north:number;east:number};if(b&&lat>=b.south&&lat<=b.north&&lon>=b.west&&lon<=b.east)return region}return null}
function hashUnit(input:string){let h=2166136261>>>0;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0)/0xffffffff}
function depthRangeFor(resourceType:string):[number,number]{if(resourceType==='sand_gravel')return[1,25];if(['limestone','gypsum','phosphate','bauxite','salt','silica_quartz'].includes(resourceType))return[3,80];if(resourceType==='groundwater')return[8,180];if(['gold','uranium','copper_ore','iron_ore','nickel','cobalt','zinc','lead','titanium','zirconium'].includes(resourceType))return[15,300];if(['rare_earth','lithium'].includes(resourceType))return[10,220];return[5,150]}
function modeledDepthM(resourceId:string,resourceType:string){const[min,max]=depthRangeFor(resourceType);return Math.round(min+(max-min)*hashUnit(`${resourceId}:${resourceType}:depth-v1`))}

async function resolveDueJobs(supabase:ReturnType<typeof createServiceClient>,profileId:string,locationId:string){
 const now=new Date().toISOString();const{data:due}=await supabase.from('core_sample_jobs').select('*').eq('profile_id',profileId).eq('location_id',locationId).eq('status','running').lte('completes_at',now)
 for(const job of due??[]){
  const origin={lat:Number(job.latitude_deg),lon:Number(job.longitude_deg)},targetDepthM=Number(job.target_depth_m??10);const region=await findRegionFor(supabase,origin.lat,origin.lon)
  if(!region){await supabase.from('core_sample_jobs').update({status:'failed',completed_at:now,result:{...(job.result??{}),error:'no_region_at_sample_position'}}).eq('id',job.id);continue}
  const{data:resources}=await supabase.from('region_resources').select('id,resource_type,lat,lon,abundance,properties').eq('region_id',region.id)
  const nearby=(resources??[]).map((r:any)=>({...r,distanceKm:haversineKm(origin,{lat:Number(r.lat),lon:Number(r.lon)}),modeledDepthM:modeledDepthM(String(r.id),String(r.resource_type))})).filter((r:any)=>Number.isFinite(r.distanceKm)&&r.distanceKm<=CORE_SAMPLE_RADIUS_KM&&r.modeledDepthM<=targetDepthM).sort((a:any,b:any)=>a.distanceKm-b.distanceKm||a.modeledDepthM-b.modeledDepthM)
  const hit:any=nearby[0]??null
  if(!hit){await supabase.from('core_sample_jobs').update({status:'completed',completed_at:now,result:{...(job.result??{}),empty:true,radius_m:5,target_depth_m:targetDepthM,conclusion:'no_resource_intersection_in_sample',depth_model:'noxia_modeled_depth_v1'}}).eq('id',job.id);continue}
  const tier=(hit.properties?.tier??'trace') as ResourceTier;const evidence=`Direkte Bohrkernprobe bis ${targetDepthM} m; modellierte Lagerstättentiefe ${hit.modeledDepthM} m; horizontale Abweichung ${Math.round(hit.distanceKm*1000)} m.`
  await supabase.from('scanner_discoveries').upsert({discovered_by_profile_id:profileId,location_id:locationId,ground_truth_key:`resource:${hit.id}`,region_resource_id:hit.id,lat:Number(hit.lat),lon:Number(hit.lon),resource_type:hit.resource_type,abundance_tier:tier,evidence_kind:'core_sample_confirmed',signal_kind:'resource_deposit',source_type:hit.resource_type,interpretation_label:`Bohrkern bestätigt: ${hit.resource_type}`,confidence:'high',evidence,last_measured_at:now},{onConflict:'location_id,ground_truth_key',ignoreDuplicates:false})
  await supabase.from('core_sample_jobs').update({status:'completed',completed_at:now,region_resource_id:hit.id,result:{...(job.result??{}),empty:false,resource_type:hit.resource_type,abundance:Number(hit.abundance),abundance_tier:tier,distance_m:Math.round(hit.distanceKm*1000),target_depth_m:targetDepthM,modeled_resource_depth_m:hit.modeledDepthM,depth_model:'noxia_modeled_depth_v1',evidence_kind:'core_sample_confirmed',confidence:'high'}}).eq('id',job.id)
 }
}

export async function GET(req:NextRequest){
 const user=await authenticatedUser(req);if(!user)return NextResponse.json({error:'unauthorized'},{status:401});const locationSlug=new URL(req.url).searchParams.get('location');if(!locationSlug)return NextResponse.json({error:'location_required'},{status:400})
 const supabase=createServiceClient();const{data:location}=await supabase.from('locations').select('id,slug').eq('slug',locationSlug).maybeSingle();if(!location)return NextResponse.json({error:'location_not_found'},{status:404});await resolveDueJobs(supabase,user.id,location.id)
 const[{data:jobs},{data:ownedRows},{data:stateRows}]=await Promise.all([supabase.from('core_sample_jobs').select('*').eq('profile_id',user.id).eq('location_id',location.id).order('created_at',{ascending:false}).limit(20),supabase.from('player_instruments').select('instrument_id').eq('profile_id',user.id).in('instrument_id',Object.keys(DRILL_RIGS)),supabase.from('player_instrument_state').select('instrument_id,condition_percent').eq('profile_id',user.id).in('instrument_id',Object.keys(DRILL_RIGS))])
 const owned=new Set((ownedRows??[]).map((r:any)=>r.instrument_id));const condition=new Map((stateRows??[]).map((r:any)=>[r.instrument_id,Number(r.condition_percent)]));const rigs=Object.values(DRILL_RIGS).map(r=>{const c=owned.has(r.id)?(condition.get(r.id)??100):null;return{...r,owned:owned.has(r.id),conditionPercent:c,serviceComponentCost:c===null?null:serviceCost(r,c)}})
 return NextResponse.json({owned:owned.has('core_sample'),sampleRadiusM:5,depthPresets:Object.values(DEPTH_PRESETS),drillRigs:rigs,depthModel:'noxia_modeled_depth_v1',jobs:jobs??[]})
}

export async function POST(req:NextRequest){
 const user=await authenticatedUser(req);if(!user)return NextResponse.json({error:'unauthorized'},{status:401});const body=await req.json().catch(()=>({}));const locationSlug=typeof body.location==='string'?body.location:'';if(!locationSlug)return NextResponse.json({error:'location_required'},{status:400})
 const supabase=createServiceClient();const{data:location}=await supabase.from('locations').select('id,slug').eq('slug',locationSlug).maybeSingle();if(!location)return NextResponse.json({error:'location_not_found'},{status:404})
 const rig=DRILL_RIGS[(typeof body.rigId==='string'?body.rigId:'core_sample') as DrillRigId];if(!rig)return NextResponse.json({error:'invalid_drill_rig'},{status:400})
 if(body.action==='service'){
  const{data:state}=await supabase.from('player_instrument_state').select('condition_percent').eq('profile_id',user.id).eq('instrument_id',rig.id).maybeSingle();const condition=Number(state?.condition_percent??100);const cost=serviceCost(rig,condition)
  if(cost===0)return NextResponse.json({ok:true,conditionPercent:100,serviceComponentCost:0})
  const{error}=await supabase.rpc('service_drill_rig',{p_profile_id:user.id,p_location_id:location.id,p_rig_id:rig.id,p_component_cost:cost});if(error){const message=error.message||'drill_rig_service_failed';const code=message.includes('insufficient_components')?'insufficient_components':message.includes('drill_rig_not_owned')?'drill_rig_not_owned':'drill_rig_service_failed';return NextResponse.json({error:code},{status:code==='insufficient_components'?409:400})}
  return NextResponse.json({ok:true,conditionPercent:100,serviceComponentCost:cost})
 }
 const lat=Number(body.lat),lon=Number(body.lon);const preset=DEPTH_PRESETS[(typeof body.depthPreset==='string'?body.depthPreset:'shallow') as DepthPresetId];if(!preset)return NextResponse.json({error:'invalid_depth_preset'},{status:400});if(preset.depthM>rig.maxDepthM)return NextResponse.json({error:'drill_rig_depth_exceeded'},{status:400});if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return NextResponse.json({error:'invalid_coordinates'},{status:400});if(!await findRegionFor(supabase,lat,lon))return NextResponse.json({error:'no_region_at_sample_position'},{status:400})
 const effective=effectivePreset(preset,rig);const{data:jobId,error}=await supabase.rpc('start_core_sample_job_v2',{p_profile_id:user.id,p_location_id:location.id,p_latitude_deg:lat,p_longitude_deg:lon,p_target_depth_m:preset.depthM,p_rig_id:rig.id,p_wear_cost:effective.wearCost,p_energy_cost:effective.energyCost,p_component_cost:effective.componentCost,p_duration_seconds:effective.durationSeconds})
 if(error){const message=error.message||'core_sample_start_failed';const known=['core_sample_not_owned','drill_rig_not_owned','drill_rig_requires_service','insufficient_energy','insufficient_components','invalid_coordinates','invalid_depth'];const code=known.find(v=>message.includes(v))??'core_sample_start_failed';return NextResponse.json({error:code},{status:code.startsWith('insufficient_')||code==='drill_rig_requires_service'?409:400})}
 const{data:job}=await supabase.from('core_sample_jobs').select('*').eq('id',jobId).single();return NextResponse.json({ok:true,job,preset:effective,rig,depthModel:'noxia_modeled_depth_v1'})
}
