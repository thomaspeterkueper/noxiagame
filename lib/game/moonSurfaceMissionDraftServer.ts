import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { getAccessibleInventorySnapshot, listAccessibleInventories, LOGISTICS_RESOURCES, type LogisticsResource } from '@/lib/game/core/logistics'
import { resolveAuthoritativeLogisticsCargoMass } from '@/lib/game/core/logisticsCargoMassAuthority'
import { getPlayerVehicleSnapshot, projectPersistedVehicle } from '@/lib/game/core/vehicleInstances'
import { resolveMoonSurfaceEngineeringProfile } from '@/lib/game/moonSurfaceEngineering'
import { deriveMoonRouteMetrics, assessMoonSurfaceRoute, type MoonSurfaceVehicleRole } from '@/lib/game/moonSurfaceLogistics'
import { prepareProspectiveSurfaceMission } from '@/lib/game/vehicles/surfaceMissionDraft'
import { traversalFromMoonAssessment } from '@/lib/game/vehicles/surfaceMission'
import { resolveSurfaceLogisticsEndpoints } from '@/lib/game/vehicles/surfaceLogisticsNodes'
import { resolveRuntimeTerrainSampler } from '@/lib/game/spatial/runtimeTerrainSampler.server'
import type { TerrainDatasetDescriptor, WorldFrame } from '@/lib/game/spatial/types'

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class MoonSurfaceMissionDraftError extends Error {
  constructor(public status:number, public code:string, message:string, public details:Record<string,unknown>={}) { super(message) }
}
function fail(status:number,code:string,message:string,details:Record<string,unknown>={}):never { throw new MoonSurfaceMissionDraftError(status,code,message,details) }

export function parseMoonSurfaceMissionIntent(body:Record<string,unknown>) {
  const sourceInventoryId=typeof body.sourceInventoryId==='string'&&UUID_RE.test(body.sourceInventoryId)?body.sourceInventoryId:null
  const destinationInventoryId=typeof body.destinationInventoryId==='string'&&UUID_RE.test(body.destinationInventoryId)?body.destinationInventoryId:null
  const vehicleId=typeof body.vehicleId==='string'&&UUID_RE.test(body.vehicleId)?body.vehicleId:null
  const resource=typeof body.resource==='string'&&(LOGISTICS_RESOURCES as readonly string[]).includes(body.resource)?body.resource as LogisticsResource:null
  const n=Number(body.amount), amount=Number.isInteger(n)&&n>0?n:null
  if(!sourceInventoryId||!destinationInventoryId||!vehicleId||!resource||!amount) fail(400,'MISSION_INTENT_INVALID','Ungültige Moon-Surface-Missionsparameter.')
  if(sourceInventoryId===destinationInventoryId) fail(400,'MISSION_ENDPOINTS_IDENTICAL','Quelle und Ziel müssen verschieden sein.')
  return {sourceInventoryId,destinationInventoryId,vehicleId,resource,amount}
}

function items(snapshot:unknown){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)) return [] as Record<string,unknown>[]
  const raw=(snapshot as Record<string,unknown>).items
  return Array.isArray(raw)?raw.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)) as Record<string,unknown>[]:[]
}

export async function buildAuthoritativeMoonSurfaceMissionDraft(actorProfileId:string,intent:ReturnType<typeof parseMoonSurfaceMissionIntent>){
  const supabase=createServiceClient()
  const {sourceInventoryId,destinationInventoryId,vehicleId,resource,amount}=intent
  const [sourceSnapshot,vehicleSnapshot]=await Promise.all([
    getAccessibleInventorySnapshot(actorProfileId,sourceInventoryId),
    getPlayerVehicleSnapshot(actorProfileId,vehicleId),
  ])
  if(!vehicleSnapshot) fail(404,'VEHICLE_NOT_FOUND','Fahrzeug nicht gefunden.')

  const {data:location,error:locationError}=await supabase.from('locations').select('id,slug').eq('slug','moon').maybeSingle()
  if(locationError) throw locationError
  if(!location) fail(409,'MOON_LOCATION_UNRESOLVED','Moon-Standort nicht gefunden.')

  const inventories=await listAccessibleInventories(actorProfileId,location.id)
  const source=inventories.find(i=>i.id===sourceInventoryId), destination=inventories.find(i=>i.id===destinationInventoryId)
  if(!source||!destination) fail(403,'SURFACE_ENDPOINT_INACCESSIBLE','Quelle oder Ziel ist nicht zugänglich.')
  if(source.subject_type!=='tile_entity'||destination.subject_type!=='tile_entity'||!source.subject_id||!destination.subject_id) fail(409,'SPATIAL_NODE_REQUIRED','Quelle und Ziel müssen räumliche Surface-Knoten sein.')

  const vehicle=vehicleSnapshot.vehicle
  if(vehicle.location_id!==location.id||vehicle.status!=='ready') fail(409,'VEHICLE_NOT_READY','Das Fahrzeug ist nicht bereit.')
  if(vehicle.current_node_inventory_id!==sourceInventoryId) fail(409,'VEHICLE_NOT_AT_SOURCE','Das Fahrzeug muss am Quellknoten gestaged sein.')
  if(vehicleSnapshot.activeTransportJob) fail(409,'VEHICLE_BUSY','Das Fahrzeug hat bereits einen aktiven Transport.')

  const profile=resolveMoonSurfaceEngineeringProfile(vehicle.frame_id)
  if(profile.status==='unresolved') fail(409,'ENGINEERING_FRAME_UNAVAILABLE','Für diesen Frame fehlt ein freigegebenes Moon-Surface-Profil.',{reason:profile.reason,details:profile.details})
  const role: MoonSurfaceVehicleRole | null = profile.frame.role === 'cargo-rover' || profile.frame.role === 'heavy-hauler'
    ? profile.frame.role
    : null
  if(!role) fail(409,'MOON_SURFACE_ROLE_UNSUPPORTED','Der Engineering-Frame besitzt keine unterstützte Moon-Surface-Rolle.')

  const sourceItem=items(sourceSnapshot).find(i=>i.resource===resource)
  const available=Number(sourceItem?.available??sourceItem?.amount??0)
  if(!Number.isFinite(available)||available<amount) fail(409,'CARGO_STOCK_INSUFFICIENT','Nicht genug frei verfügbare Ware.',{available})
  const unit=typeof sourceItem?.unit==='string'&&sourceItem.unit.trim()?sourceItem.unit.trim():null
  const cargo=resolveAuthoritativeLogisticsCargoMass({commodityId:resource,amount,unit})
  if(cargo.resolution.status!=='resolved') fail(409,'CARGO_MASS_UNRESOLVED','Für diese Fracht fehlt eine autoritative Massenbasis.',{reason:cargo.resolution.reason,unit})

  const [{data:frame,error:frameError},{data:entities,error:entityError}]=await Promise.all([
    supabase.from('world_frames').select('*').eq('location_id',location.id).maybeSingle(),
    supabase.from('tile_entities').select('id,x_m,y_m').in('id',[source.subject_id,destination.subject_id]),
  ])
  if(frameError) throw frameError
  if(entityError) throw entityError
  if(!frame||frame.origin_status==='pending'||!frame.terrain_dataset_id) fail(409,'WORLD_FRAME_UNRESOLVED','Moon-World-Frame/Terrain ist nicht aufgelöst.')
  const {data:dataset,error:datasetError}=await supabase.from('terrain_datasets').select('*').eq('id',frame.terrain_dataset_id).maybeSingle()
  if(datasetError) throw datasetError
  if(!dataset||dataset.status!=='ready') fail(409,'TERRAIN_DATASET_NOT_READY','Moon-Terrain ist nicht sampling-bereit.')

  const endpoints=resolveSurfaceLogisticsEndpoints(source,destination,entities??[])
  if(endpoints.status==='unresolved') fail(409,'SURFACE_ENDPOINT_COORDINATES_UNRESOLVED','Surface-Koordinaten fehlen.',{reason:endpoints.reason})
  const dx=endpoints.destination.point.xM-endpoints.origin.point.xM, dy=endpoints.destination.point.yM-endpoints.origin.point.yM
  const distanceM=Math.hypot(dx,dy)
  if(!(distanceM>0)) fail(409,'ROUTE_DISTANCE_INVALID','Route hat keine positive Distanz.')

  const runtime=await resolveRuntimeTerrainSampler(supabase,frame.terrain_dataset_id)
  if(!runtime.sampler) fail(409,'TERRAIN_RUNTIME_UNAVAILABLE','Der verifizierte LOLA-Datensatz ist noch nicht runtime-sampling-bereit.',{details:runtime.details,datasetId:runtime.datasetId})

  const worldFrame:WorldFrame={
    locationId:frame.location_id,body:'moon',coordinateSystem:frame.coordinate_system,
    originLatDeg:Number(frame.origin_lat_deg),originLonDeg:Number(frame.origin_lon_deg),originAltM:Number(frame.origin_alt_m),
    originStatus:frame.origin_status,referenceFrame:frame.reference_frame,latitudeType:frame.latitude_type,
    longitudeDirection:frame.longitude_direction,equatorialRadiusM:Number(frame.equatorial_radius_m),polarRadiusM:Number(frame.polar_radius_m),
    verticalDatum:frame.vertical_datum,terrainDatasetId:frame.terrain_dataset_id,worldSeed:frame.world_seed,
    observedSource:frame.observed_source??{},derivedConfig:frame.derived_config??{},
  }
  const terrain:TerrainDatasetDescriptor={
    id:dataset.id,body:'moon',locationId:dataset.location_id??location.id,provider:dataset.provider,datasetName:dataset.dataset_name,
    datasetVersion:dataset.dataset_version,datasetKind:dataset.dataset_kind,resolutionM:Number(dataset.resolution_m),
    horizontalReference:dataset.horizontal_reference,verticalReference:dataset.vertical_reference,latitudeType:frame.latitude_type,
    longitudeDirection:frame.longitude_direction,sourceUri:dataset.source_uri,sourceLicense:dataset.source_license,
    accessMode:dataset.access_mode,status:dataset.status,metadata:dataset.metadata??{},
  }
  const sampleCount=Math.max(2,Math.min(128,Math.ceil(distanceM/25)+1))
  const samples:{distanceM:number;elevationM:number}[]=[]
  for(let i=0;i<sampleCount;i++){
    const t=i/(sampleCount-1), xM=endpoints.origin.point.xM+dx*t, yM=endpoints.origin.point.yM+dy*t
    const s=await runtime.sampler.sampleTerrainHeight({frame:worldFrame,dataset:terrain},{xM,yM})
    if(!s) fail(409,'TERRAIN_ROUTE_NODATA','LOLA liefert entlang der Route NoData.',{sampleIndex:i,sampleCount})
    samples.push({distanceM:distanceM*t,elevationM:s.zM})
  }
  const metrics=deriveMoonRouteMetrics(samples)
  const assessment=assessMoonSurfaceRoute({routeClass:'offroad',metrics,vehicle:{role,frameId:profile.frame.id,safeLongitudinalSlopeDeg:profile.frame.surfaceMobility!.safeLongitudinalSlopeDeg}})
  const routeId=`moon:${sourceInventoryId.slice(0,8)}:${destinationInventoryId.slice(0,8)}:${vehicleId.slice(0,8)}:${resource}:${amount}`
  const plan={routeId,originInventoryId:sourceInventoryId,destinationInventoryId,segments:[{id:'direct-lola-offroad',distanceKm:distanceM/1000,traversal:traversalFromMoonAssessment(assessment)}]}
  const draft=prepareProspectiveSurfaceMission({frame:profile.frame,instance:projectPersistedVehicle(vehicle),operationProfile:profile.operationProfile,plan,projectedCargo:[cargo.resolution.cargo]})
  if(!draft.estimate.feasible||!draft.routeSnapshot) fail(409,'SURFACE_MISSION_INFEASIBLE','Moon-Surface-Mission ist nicht freigegeben.',{estimate:draft.estimate,metrics,assessment})
  const vehicleInventoryId=(vehicleSnapshot.inventory as Record<string,unknown>|null)?.id
  if(typeof vehicleInventoryId!=='string'||!UUID_RE.test(vehicleInventoryId)) fail(409,'VEHICLE_CARGO_INVENTORY_UNRESOLVED','Fahrzeug-Cargoinventar fehlt.')
  return {ok:true as const,ready:true as const,locationId:location.id,sourceInventoryId,destinationInventoryId,vehicleId,vehicleInventoryId,vehicleRole:role,resource,amount,metrics,assessment,estimate:draft.estimate,routeSnapshot:{...draft.routeSnapshot,moonRouteClass:'offroad',terrainDatasetId:dataset.id,engineeringSourceId:profile.sourceId,cargoMassSource:cargo.source}}
}
