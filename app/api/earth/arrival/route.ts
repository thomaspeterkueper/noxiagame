import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { resolveEarthArrival } from '@/lib/world/spatial/earthArrivalResolver.server'

const serviceClient=createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function getUser(req:NextRequest){
  const auth=req.headers.get('authorization')
  if(!auth?.startsWith('Bearer '))return null
  const {data:{user}}=await serviceClient.auth.getUser(auth.slice(7))
  return user
}

export async function GET(req:NextRequest){
  const user=await getUser(req)
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})

  const p=req.nextUrl.searchParams
  const lat=Number(p.get('lat'))
  const lon=Number(p.get('lon'))
  const label=String(p.get('label')??'').trim().slice(0,240)
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180||!label){
    return NextResponse.json({error:'Ungültiges Reiseziel'},{status:400})
  }
  const placeSlug=p.get('place')??earthPlaceSlug({lat,lon})
  try{
    const arrival=await resolveEarthArrival({placeSlug,label,center:{lat,lon}})
    return NextResponse.json({ok:true,arrival},{
      headers:{'Cache-Control':'private, no-store, max-age=0'},
    })
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:'Ankunftsknoten nicht verfügbar',
    },{status:500,headers:{'Cache-Control':'private, no-store, max-age=0'}})
  }
}
