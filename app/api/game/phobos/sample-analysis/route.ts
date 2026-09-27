import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CONFIDENCE_WEIGHT: Record<string, number> = { 'very-low': 0.45, low: 0.60, medium: 0.75, high: 0.90 }
const TIER_WEIGHT: Record<string, number> = { trace: 0.45, viable: 0.68, rich: 0.82, exceptional: 0.94 }

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

async function requirePhobosPresence(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return data?.current_location === 'phobos'
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)) }

function deriveAnalysis(resourceType: string, abundance: number, tier: string, confidence: string) {
  const signal = clamp01(Number.isFinite(abundance) ? abundance : 0)
  const quality = clamp01((CONFIDENCE_WEIGHT[confidence] ?? 0.5) * 0.55 + (TIER_WEIGHT[tier] ?? 0.5) * 0.45)
  const finding = signal >= 0.34 && quality >= 0.55 ? 'confirmed' : signal < 0.16 && quality >= 0.40 ? 'rejected' : 'inconclusive'
  const developmentStatus = finding === 'confirmed' && quality >= 0.75 && signal >= 0.65
    ? 'extraction_candidate'
    : finding === 'confirmed' && quality >= 0.55 && signal >= 0.34
      ? 'drilling_authorized'
      : 'blocked'
  const composition = resourceType === 'water'
    ? { target: 'hydration-bearing-material', hydration_signal_index: signal, dry_matrix_index: clamp01(1 - signal) }
    : { target: 'metal-bearing-regolith', metallic_signal_index: signal, matrix_signal_index: clamp01(1 - signal) }
  return { signal, quality, finding, developmentStatus, composition }
}

async function listAnalyses(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data: samples, error } = await supabase
    .from('research_samples')
    .select('id,prospect_id,status,collected_at,returned_at,analyzed_at,return_job_id,destination_inventory_id,sample_kind,metadata')
    .or(`owner_profile_id.eq.${userId},owner_profile_id.is.null`)
    .order('collected_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!samples?.length) return []

  const prospectIds = [...new Set(samples.map(sample => sample.prospect_id))]
  const sampleIds = samples.map(sample => sample.id)
  const [{ data: prospects, error: prospectError }, { data: analyses, error: analysisError }] = await Promise.all([
    supabase.from('region_resources').select('id,resource_type,x_m,y_m,abundance,properties').in('id', prospectIds),
    supabase.from('sample_analyses').select('*').in('sample_id', sampleIds),
  ])
  if (prospectError) throw new Error(prospectError.message)
  if (analysisError) throw new Error(analysisError.message)
  const prospectById = new Map((prospects ?? []).map(row => [row.id, row]))
  const analysisBySample = new Map((analyses ?? []).map(row => [row.sample_id, row]))
  return samples.map(sample => {
    const prospect: any = prospectById.get(sample.prospect_id)
    const analysis: any = analysisBySample.get(sample.id) ?? null
    return {
      sampleId: sample.id,
      prospectId: sample.prospect_id,
      sampleKind: sample.sample_kind,
      status: analysis ? 'analyzed' : sample.status,
      collectedAt: sample.collected_at,
      returnedAt: sample.returned_at,
      resourceType: prospect?.resource_type ?? null,
      xM: prospect?.x_m ?? null,
      yM: prospect?.y_m ?? null,
      tier: prospect?.properties?.tier ?? null,
      confidence: prospect?.properties?.confidence ?? null,
      analysis: analysis ? {
        id: analysis.id,
        method: analysis.method,
        qualityScore: analysis.quality_score,
        finding: analysis.finding,
        measuredSignalIndex: analysis.measured_signal_index,
        composition: analysis.composition,
        developmentStatus: analysis.development_status,
        provenance: analysis.provenance,
        createdAt: analysis.created_at,
      } : null,
    }
  })
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Probenanalyse ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  try {
    return NextResponse.json({ ok: true, samples: await listAnalyses(supabase, user.id) })
  } catch (error) {
    console.error('phobos sample analysis lookup failed:', error)
    return NextResponse.json({ error: 'Probenregister nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Probenanalyse ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const prospectId = typeof body.prospectId === 'string' ? body.prospectId : ''
  if (!prospectId) return NextResponse.json({ error: 'prospectId erforderlich' }, { status: 400 })

  try {
    const { data: sample, error: sampleError } = await supabase
      .from('research_samples')
      .select('*')
      .eq('prospect_id', prospectId)
      .maybeSingle()
    if (sampleError) throw new Error(sampleError.message)
    if (!sample) return NextResponse.json({ error: 'Keine registrierte Referenzprobe für dieses Ziel.' }, { status: 404 })
    if (sample.owner_profile_id && sample.owner_profile_id !== user.id) return NextResponse.json({ error: 'Diese Probe gehört zu einem anderen Einsatz.' }, { status: 403 })

    const { data: existing, error: existingError } = await supabase.from('sample_analyses').select('*').eq('sample_id', sample.id).maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) return NextResponse.json({ ok: true, idempotent: true, analysis: existing })

    let returned = sample.status === 'returned' || sample.status === 'analyzed'
    if (!returned && sample.return_job_id) {
      const { data: job } = await supabase.from('transport_jobs').select('status,completed_at,destination_inventory_id').eq('id', sample.return_job_id).maybeSingle()
      if (job?.status === 'completed') {
        returned = true
        await supabase.from('research_samples').update({ status: 'returned', returned_at: job.completed_at ?? new Date().toISOString(), destination_inventory_id: job.destination_inventory_id, updated_at: new Date().toISOString() }).eq('id', sample.id)
      }
    }
    if (!returned) return NextResponse.json({ error: 'Die Probe muss zuerst vollständig zu Base Alpha zurückgebracht werden.' }, { status: 409 })

    const { data: depot, error: depotError } = await supabase
      .from('logistics_inventories')
      .select('id')
      .contains('metadata', { role: 'stickney_depot' })
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (depotError || !depot?.id) throw new Error(depotError?.message ?? 'Stickney depot missing')
    const { data: item, error: itemError } = await supabase.from('logistics_inventory_items').select('amount').eq('inventory_id', depot.id).eq('resource', 'research_sample').maybeSingle()
    if (itemError) throw new Error(itemError.message)
    if (Number(item?.amount ?? 0) < 1) return NextResponse.json({ error: 'Im Base-Alpha-Depot ist noch keine Forschungsprobe eingelagert.' }, { status: 409 })

    const [{ data: prospect, error: prospectError }, { data: facility, error: facilityError }] = await Promise.all([
      supabase.from('region_resources').select('id,resource_type,abundance,properties').eq('id', prospectId).single(),
      supabase.from('tile_entities').select('id').eq('entity_id', 'surface_workshop').eq('spatial_region_id', 'phobos-stickney-alpha').limit(1).maybeSingle(),
    ])
    if (prospectError || !prospect) throw new Error(prospectError?.message ?? 'Prospect missing')
    if (facilityError || !facility?.id) return NextResponse.json({ error: 'Das Base-Alpha-Feldlabor ist nicht verfügbar.' }, { status: 409 })

    const resourceType = String(prospect.resource_type)
    const tier = String(prospect.properties?.tier ?? 'trace')
    const confidence = String(prospect.properties?.confidence ?? 'very-low')
    const derived = deriveAnalysis(resourceType, Number(prospect.abundance ?? 0), tier, confidence)
    const now = new Date().toISOString()
    const { data: analysis, error: insertError } = await supabase.from('sample_analyses').insert({
      sample_id: sample.id,
      prospect_id: prospectId,
      analyst_profile_id: user.id,
      facility_entity_id: facility.id,
      method: 'stickney_field_lab_multisensor_v1',
      quality_score: derived.quality,
      finding: derived.finding,
      measured_signal_index: derived.signal,
      composition: derived.composition,
      development_status: derived.developmentStatus,
      provenance: {
        source_prospect_provenance: prospect.properties?.provenance ?? 'derived-gameplay-model',
        analysis_model: 'noxia-stickney-field-lab-v1',
        observed_deposit: false,
        interpretation: 'in-world gameplay analysis; not a claim about a real Phobos deposit',
      },
    }).select('*').single()
    if (insertError) throw new Error(insertError.message)
    await supabase.from('research_samples').update({ status: 'analyzed', analyzed_at: now, updated_at: now }).eq('id', sample.id)
    await supabase.from('region_resources').update({ properties: { ...prospect.properties, analysis_finding: derived.finding, development_status: derived.developmentStatus, analysis_quality: derived.quality, analyzed_at: now } }).eq('id', prospectId)

    return NextResponse.json({ ok: true, analysis })
  } catch (error) {
    console.error('phobos sample analysis failed:', error)
    return NextResponse.json({ error: 'Probenanalyse fehlgeschlagen.' }, { status: 503 })
  }
}
