import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { buildAuthoritativeMoonSurfaceMissionDraft, MoonSurfaceMissionDraftError, parseMoonSurfaceMissionIntent } from '@/lib/game/moonSurfaceMissionDraftServer'
import { beginLoadingTransportJob, createTransportJob, startTransportJob } from '@/lib/game/core/logistics'

async function user(req:NextRequest){const h=req.headers.get('authorization');if(!h?.startsWith('Bearer '))return null;const sb=createServiceClient();const{data:{user}}=await sb.auth.getUser(h.slice(7));return user}

export async function POST(req:NextRequest){
 const u=await user(req); if(!u)return NextResponse.json({error:'Unauthorized'},{status:401})
 let body:Record<string,unknown>; try{body=await req.json()}catch{return NextResponse.json({error:'Ungültiger JSON-Body.'},{status:400})}
 try{
  const intent=parseMoonSurfaceMissionIntent(body)
  const draft=await buildAuthoritativeMoonSurfaceMissionDraft(u.id,intent)
  if(body.action!=='start') return NextResponse.json(draft)
  const job=await createTransportJob({commandId:randomUUID(),actorProfileId:u.id,locationId:draft.locationId,domain:'surface',sourceInventoryId:draft.sourceInventoryId,destinationInventoryId:draft.destinationInventoryId,vehicleInventoryId:draft.vehicleInventoryId,vehicleRole:draft.vehicleRole,resource:draft.resource,amount:draft.amount,routeSnapshot:draft.routeSnapshot})
  const jobId=String((job as Record<string,unknown>).id??'')
  if(!jobId) throw new Error('NOXIA_TRANSPORT_JOB_NOT_FOUND')
  await beginLoadingTransportJob(u.id,jobId)
  const started=await startTransportJob(u.id,jobId)
  return NextResponse.json({ok:true,ready:true,draft,job:started})
 }catch(error){
  if(error instanceof MoonSurfaceMissionDraftError) return NextResponse.json({error:error.message,code:error.code,...error.details},{status:error.status})
  const message=error instanceof Error?error.message:String(error)
  console.error('moon surface mission failed:',message)
  return NextResponse.json({error:'Moon-Surface-Mission konnte nicht gestartet werden.',code:'MOON_SURFACE_MISSION_FAILED'},{status:500})
 }
}
