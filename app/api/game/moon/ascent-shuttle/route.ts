import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function user(req:NextRequest){
  const h=req.headers.get('authorization')
  if(!h?.startsWith('Bearer ')) return null
  const sb=createServiceClient()
  const {data:{user}}=await sb.auth.getUser(h.slice(7))
  return user
}

async function snapshot(profileId:string){
  const sb=createServiceClient()
  const {data:slot,error}=await sb.from('lunar_ascent_shuttle_slots')
    .select('ship_id,vehicle_instance_id,created_at').eq('owner_profile_id',profileId).maybeSingle()
  if(error) throw error
  if(!slot) return null
  const [{data:ship,error:shipError},{data:article,error:articleError},{data:vehicle,error:vehicleError}]=await Promise.all([
    sb.from('ships').select('id,name,ship_type_id,location,status,cargo_max,is_active').eq('id',slot.ship_id).maybeSingle(),
    sb.from('spacecraft_flight_articles').select('*').eq('ship_id',slot.ship_id).maybeSingle(),
    sb.from('vehicle_instances').select('id,frame_id,label,status,current_node_inventory_id,location_id').eq('id',slot.vehicle_instance_id).maybeSingle(),
  ])
  if(shipError) throw shipError
  if(articleError) throw articleError
  if(vehicleError) throw vehicleError
  const {data:inventory,error:inventoryError}=await sb.from('logistics_inventories')
    .select('id,label,capacity,metadata').eq('storage_kind','ship_cargo').eq('subject_type','ship').eq('subject_id',slot.ship_id).maybeSingle()
  if(inventoryError) throw inventoryError
  const {data:moonLocation,error:moonLocationError}=await sb.from('locations').select('id').eq('slug','moon').single()
  if(moonLocationError) throw moonLocationError
  const [{data:surfacePort,error:surfacePortError},{data:orbitalInterface,error:orbitalError}]=await Promise.all([
    sb.from('logistics_inventories')
      .select('id,label,inventory_kind,subject_type,metadata')
      .eq('location_id',moonLocation.id)
      .eq('inventory_kind','surface_port').eq('label','Shuttle-Port-Lager').eq('active',true).limit(1).maybeSingle(),
    sb.from('logistics_inventories')
      .select('id,label,inventory_kind,subject_type,metadata')
      .eq('subject_type','orbital_interface').eq('active',true).limit(1).maybeSingle(),
  ])
  if(surfacePortError) throw surfacePortError
  if(orbitalError) throw orbitalError
  const [shipCargo,surfaceCargo,orbitalCargo]=await Promise.all([
    inventory?.id ? sb.rpc('noxia_inventory_snapshot',{p_inventory_id:inventory.id}) : Promise.resolve({data:null,error:null}),
    surfacePort?.id ? sb.rpc('noxia_inventory_snapshot',{p_inventory_id:surfacePort.id}) : Promise.resolve({data:null,error:null}),
    orbitalInterface?.id ? sb.rpc('noxia_inventory_snapshot',{p_inventory_id:orbitalInterface.id}) : Promise.resolve({data:null,error:null}),
  ])
  if(shipCargo.error) throw shipCargo.error
  if(surfaceCargo.error) throw surfaceCargo.error
  if(orbitalCargo.error) throw orbitalCargo.error
  return {slot,ship,vehicle,article,inventory:shipCargo.data??inventory,surfacePort:surfaceCargo.data??surfacePort,orbitalInterface:orbitalCargo.data??orbitalInterface}
}

export async function GET(req:NextRequest){
  const u=await user(req); if(!u)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{return NextResponse.json({ok:true,shuttle:await snapshot(u.id)})}
  catch(error){console.error('lunar shuttle query failed',error);return NextResponse.json({error:'Lunar Shuttle konnte nicht geladen werden.'},{status:500})}
}

export async function POST(req:NextRequest){
  const u=await user(req); if(!u)return NextResponse.json({error:'Unauthorized'},{status:401})
  let body:Record<string,unknown>;try{body=await req.json()}catch{return NextResponse.json({error:'Ungültiger JSON-Body.'},{status:400})}
  try{
    const sb=createServiceClient()
    if(body.action==='provision'){
      const {data,error}=await sb.rpc('noxia_provision_lunar_ascent_shuttle',{p_command_id:randomUUID(),p_actor_profile_id:u.id})
      if(error) throw error
      return NextResponse.json({ok:true,provisioning:data,shuttle:await snapshot(u.id)})
    }
    const state=await snapshot(u.id)
    if(!state?.ship?.id||!state.slot?.vehicle_instance_id) return NextResponse.json({error:'Lunar Ascent Shuttle ist noch nicht provisioniert.'},{status:409})
    if(body.action==='stage-surface-port'){
      const portId=typeof body.portInventoryId==='string'?body.portInventoryId:''
      const {data,error}=await sb.rpc('noxia_stage_surface_vehicle',{
        p_command_id:randomUUID(),p_actor_profile_id:u.id,p_vehicle_instance_id:state.slot.vehicle_instance_id,p_target_inventory_id:portId,
      })
      if(error) throw error
      return NextResponse.json({ok:true,staging:data,shuttle:await snapshot(u.id)})
    }
    if(body.action==='surface-transfer'){
      const portId=typeof body.portInventoryId==='string'?body.portInventoryId:''
      const resource=typeof body.resource==='string'?body.resource:''
      const amount=Number(body.amount)
      const direction=body.direction==='shuttle-to-port'?'shuttle-to-port':'port-to-shuttle'
      if(!['water','energy','metal','components'].includes(resource)||!Number.isInteger(amount)||amount<=0) return NextResponse.json({error:'Ungültige Cargo-Parameter.'},{status:400})
      const {data,error}=await sb.rpc('noxia_transfer_staged_surface_shuttle_cargo',{
        p_command_id:randomUUID(),p_actor_profile_id:u.id,p_ship_id:state.ship.id,p_surface_port_inventory_id:portId,p_resource:resource,p_amount:amount,p_direction:direction,
      })
      if(error) throw error
      return NextResponse.json({ok:true,transfer:data,shuttle:await snapshot(u.id)})
    }
    return NextResponse.json({error:'Ungültige Shuttle-Aktion.'},{status:400})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    console.error('lunar shuttle provision failed',message)
    return NextResponse.json({error:'Lunar Ascent Shuttle konnte nicht provisioniert werden.'},{status:500})
  }
}
