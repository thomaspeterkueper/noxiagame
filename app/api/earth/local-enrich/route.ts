import { NextRequest,NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enrichEarthLocalScene } from '@/lib/world/spatial/earthLocalEnrichment.server'

export const maxDuration=60
const authClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string,process.env.SUPABASE_SERVICE_ROLE_KEY as string)
async function userFrom(req:NextRequest){const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return null;const {data:{user}}=await authClient.auth.getUser(auth.slice(7));return user}

export async function POST(req:NextRequest){
  const user=await userFrom(req)
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{
    const body=await req.json() as {slug?:string;lat?:number;lon?:number;radiusKm?:number}
    const slug=String(body.slug??'').trim();const lat=Number(body.lat),lon=Number(body.lon)
    if(!slug||!Number.isFinite(lat)||!Number.isFinite(lon))return NextResponse.json({error:'Ort und Koordinaten erforderlich'},{status:400})
    const result=await enrichEarthLocalScene({slug,lat,lon,radiusKm:body.radiusKm})
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store, max-age=0'}})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{'Cache-Control':'private, no-store, max-age=0'}})
  }
}