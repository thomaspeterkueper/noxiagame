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
  const [{data:ship,error:shipError},{data:article,error:articleError}]=await Promise.all([
    sb.from('ships').select('id,name,ship_type_id,location,status,cargo_max,is_active').eq('id',slot.ship_id).maybeSingle(),
    sb.from('spacecraft_flight_articles').select('*').eq('ship_id',slot.ship_id).maybeSingle(),
  ])
  if(shipError) throw shipError
  if(articleError) throw articleError
  const {data:inventory,error:inventoryError}=await sb.from('logistics_inventories')
    .select('id,label,capacity,metadata').eq('storage_kind','ship_cargo').eq('subject_type','ship').eq('subject_id',slot.ship_id).maybeSingle()
  if(inventoryError) throw inventoryError
  return {slot,ship,article,inventory}
}

export async function GET(req:NextRequest){
  const u=await user(req); if(!u)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{return NextResponse.json({ok:true,shuttle:await snapshot(u.id)})}
  catch(error){console.error('lunar shuttle query failed',error);return NextResponse.json({error:'Lunar Shuttle konnte nicht geladen werden.'},{status:500})}
}

export async function POST(req:NextRequest){
  const u=await user(req); if(!u)return NextResponse.json({error:'Unauthorized'},{status:401})
  let body:Record<string,unknown>;try{body=await req.json()}catch{return NextResponse.json({error:'Ungültiger JSON-Body.'},{status:400})}
  if(body.action!=='provision') return NextResponse.json({error:'Ungültige Shuttle-Aktion.'},{status:400})
  try{
    const sb=createServiceClient()
    const {data,error}=await sb.rpc('noxia_provision_lunar_ascent_shuttle',{p_command_id:randomUUID(),p_actor_profile_id:u.id})
    if(error) throw error
    return NextResponse.json({ok:true,provisioning:data,shuttle:await snapshot(u.id)})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    console.error('lunar shuttle provision failed',message)
    return NextResponse.json({error:'Lunar Ascent Shuttle konnte nicht provisioniert werden.'},{status:500})
  }
}
