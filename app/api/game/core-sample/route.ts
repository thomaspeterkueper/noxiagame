import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { haversineKm, type ResourceTier } from '@/lib/game/resourceScanning'

const CORE_SAMPLE_RADIUS_KM = 0.005
const ENERGY_COST = 25
const COMPONENT_COST = 1
const DURATION_SECONDS = 15 * 60

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

async function findRegionFor(supabase: ReturnType<typeof createServiceClient>, lat: number, lon: number) {
  const { data: regions } = await supabase.from('celestial_regions').select('id,slug,bounds')
  for (const region of regions ?? []) {
    const b = region.bounds as { south:number; west:number; north:number; east:number }
    if (b && lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east) return region
  }
  return null
}

async function resolveDueJobs(
  supabase: ReturnType<typeof createServiceClient>,
  profileId: string,
  locationId: string,
) {
  const now = new Date().toISOString()
  const { data: due } = await supabase
    .from('core_sample_jobs')
    .select('*')
    .eq('profile_id', profileId)
    .eq('location_id', locationId)
    .eq('status', 'running')
    .lte('completes_at', now)

  for (const job of due ?? []) {
    const origin = { lat: Number(job.latitude_deg), lon: Number(job.longitude_deg) }
    const region = await findRegionFor(supabase, origin.lat, origin.lon)
    if (!region) {
      await supabase.from('core_sample_jobs').update({
        status:'failed', completed_at:now, result:{ error:'no_region_at_sample_position' },
      }).eq('id', job.id)
      continue
    }

    const { data: resources } = await supabase
      .from('region_resources')
      .select('id,resource_type,lat,lon,abundance,properties')
      .eq('region_id', region.id)

    const nearby = (resources ?? [])
      .map((r:any) => ({ ...r, distanceKm:haversineKm(origin,{lat:Number(r.lat),lon:Number(r.lon)}) }))
      .filter((r:any) => Number.isFinite(r.distanceKm) && r.distanceKm <= CORE_SAMPLE_RADIUS_KM)
      .sort((a:any,b:any) => a.distanceKm-b.distanceKm)

    const hit:any = nearby[0] ?? null
    if (!hit) {
      await supabase.from('core_sample_jobs').update({
        status:'completed', completed_at:now,
        result:{ empty:true, radius_m:CORE_SAMPLE_RADIUS_KM*1000, conclusion:'no_resource_detected_in_sample' },
      }).eq('id', job.id)
      continue
    }

    const tier = (hit.properties?.tier ?? 'trace') as ResourceTier
    const evidence = `Direkte Bohrkernprobe am Zielpunkt; nächstes modelliertes Vorkommen ${Math.round(hit.distanceKm*1000)} m entfernt.`
    await supabase.from('scanner_discoveries').upsert({
      discovered_by_profile_id:profileId,
      location_id:locationId,
      ground_truth_key:`resource:${hit.id}`,
      region_resource_id:hit.id,
      lat:Number(hit.lat), lon:Number(hit.lon),
      resource_type:hit.resource_type,
      abundance_tier:tier,
      evidence_kind:'core_sample_confirmed',
      signal_kind:'resource_deposit',
      source_type:hit.resource_type,
      interpretation_label:`Bohrkern bestätigt: ${hit.resource_type}`,
      confidence:'high',
      evidence,
      last_measured_at:now,
    }, { onConflict:'location_id,ground_truth_key', ignoreDuplicates:false })

    await supabase.from('core_sample_jobs').update({
      status:'completed', completed_at:now, region_resource_id:hit.id,
      result:{
        empty:false,
        resource_type:hit.resource_type,
        abundance:Number(hit.abundance),
        abundance_tier:tier,
        distance_m:Math.round(hit.distanceKm*1000),
        evidence_kind:'core_sample_confirmed',
        confidence:'high',
      },
    }).eq('id', job.id)
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({error:'unauthorized'},{status:401})
  const locationSlug = new URL(req.url).searchParams.get('location')
  if (!locationSlug) return NextResponse.json({error:'location_required'},{status:400})

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug',locationSlug).maybeSingle()
  if (!location) return NextResponse.json({error:'location_not_found'},{status:404})

  await resolveDueJobs(supabase,user.id,location.id)
  const [{ data:jobs }, { data:owned }] = await Promise.all([
    supabase.from('core_sample_jobs').select('*').eq('profile_id',user.id).eq('location_id',location.id).order('created_at',{ascending:false}).limit(20),
    supabase.from('player_instruments').select('instrument_id').eq('profile_id',user.id).eq('instrument_id','core_sample').maybeSingle(),
  ])

  return NextResponse.json({
    owned:Boolean(owned),
    cost:{energy:ENERGY_COST,components:COMPONENT_COST},
    durationSeconds:DURATION_SECONDS,
    sampleRadiusM:CORE_SAMPLE_RADIUS_KM*1000,
    jobs:jobs??[],
  })
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({error:'unauthorized'},{status:401})
  const body = await req.json().catch(()=>({}))
  const locationSlug = typeof body.location==='string'?body.location:''
  const lat = Number(body.lat), lon = Number(body.lon)
  if (!locationSlug) return NextResponse.json({error:'location_required'},{status:400})
  if (!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)
    return NextResponse.json({error:'invalid_coordinates'},{status:400})

  const supabase = createServiceClient()
  const { data:location } = await supabase.from('locations').select('id,slug').eq('slug',locationSlug).maybeSingle()
  if (!location) return NextResponse.json({error:'location_not_found'},{status:404})
  const region = await findRegionFor(supabase,lat,lon)
  if (!region) return NextResponse.json({error:'no_region_at_sample_position'},{status:400})

  const { data:jobId, error } = await supabase.rpc('start_core_sample_job',{
    p_profile_id:user.id,
    p_location_id:location.id,
    p_latitude_deg:lat,
    p_longitude_deg:lon,
    p_energy_cost:ENERGY_COST,
    p_component_cost:COMPONENT_COST,
    p_duration_seconds:DURATION_SECONDS,
  })
  if (error) {
    const message = error.message || 'core_sample_start_failed'
    const known = ['core_sample_not_owned','insufficient_energy','insufficient_components','invalid_coordinates']
    const code = known.find(v=>message.includes(v)) ?? 'core_sample_start_failed'
    return NextResponse.json({error:code},{status:code.startsWith('insufficient_')?409:400})
  }

  const { data:job } = await supabase.from('core_sample_jobs').select('*').eq('id',jobId).single()
  return NextResponse.json({ok:true,job,cost:{energy:ENERGY_COST,components:COMPONENT_COST},durationSeconds:DURATION_SECONDS})
}
