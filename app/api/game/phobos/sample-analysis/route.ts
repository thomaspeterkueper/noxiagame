import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { deriveSampleAnalysis } from '@/lib/game/research/sampleAnalysis'

async function userFromRequest(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  return id ? { id } : null
}

async function requirePhobosPresence(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return data?.current_location === 'phobos'
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
  const sampleKind = body.sampleKind === 'drill_core' ? 'drill_core' : 'regolith_reference'
  if (!prospectId) return NextResponse.json({ error: 'prospectId erforderlich' }, { status: 400 })

  try {
    const { data: sample, error: sampleError } = await supabase
      .from('research_samples')
      .select('*')
      .eq('prospect_id', prospectId)
      .eq('sample_kind', sampleKind)
      .maybeSingle()
    if (sampleError) throw new Error(sampleError.message)
    if (!sample) return NextResponse.json({ error: sampleKind === 'drill_core' ? 'Noch kein Bohrkern für dieses Ziel registriert.' : 'Keine registrierte Referenzprobe für dieses Ziel.' }, { status: 404 })
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
    if (!returned) return NextResponse.json({ error: sampleKind === 'drill_core' ? 'Der Bohrkern muss zuerst vollständig zu Base Alpha zurückgebracht werden.' : 'Die Probe muss zuerst vollständig zu Base Alpha zurückgebracht werden.' }, { status: 409 })

    const { data: depot, error: depotError } = await supabase.from('logistics_inventories').select('id').contains('metadata', { role: 'stickney_depot' }).eq('active', true).limit(1).maybeSingle()
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
    const derived = deriveSampleAnalysis({ resourceType, abundance: Number(prospect.abundance ?? 0), tier, confidence, sampleKind })
    const now = new Date().toISOString()
    const { data: analysis, error: insertError } = await supabase.from('sample_analyses').insert({
      sample_id: sample.id,
      prospect_id: prospectId,
      analyst_profile_id: user.id,
      facility_entity_id: facility.id,
      method: derived.capability.method,
      quality_score: derived.quality,
      finding: derived.finding,
      measured_signal_index: derived.signal,
      composition: derived.composition,
      development_status: derived.developmentStatus,
      provenance: {
        source_prospect_provenance: prospect.properties?.provenance ?? 'derived-gameplay-model',
        sample_kind: sampleKind,
        evidence_class: derived.evidenceClass,
        analysis_model: sampleKind === 'drill_core' ? 'noxia-stickney-core-lab-v1' : 'noxia-stickney-field-lab-v3',
        instrument_capability: derived.capability,
        observed_deposit: false,
        interpretation: 'in-world gameplay analysis; not a claim about a real Phobos deposit',
      },
    }).select('*').single()
    if (insertError) throw new Error(insertError.message)
    await supabase.from('research_samples').update({ status: 'analyzed', analyzed_at: now, updated_at: now }).eq('id', sample.id)
    const resultProperties = sampleKind === 'drill_core'
      ? {
          ...prospect.properties,
          core_analysis_finding: derived.finding,
          core_analysis_quality: derived.quality,
          core_instrument_capability_sufficient: derived.capability.sufficient,
          core_instrument_capability_gaps: derived.capability.gaps,
          core_analyzed_at: now,
          development_status: derived.developmentStatus,
        }
      : {
          ...prospect.properties,
          analysis_finding: derived.finding,
          analysis_quality: derived.quality,
          instrument_capability_sufficient: derived.capability.sufficient,
          instrument_capability_gaps: derived.capability.gaps,
          analyzed_at: now,
          development_status: derived.developmentStatus,
        }
    await supabase.from('region_resources').update({ properties: resultProperties }).eq('id', prospectId)

    return NextResponse.json({ ok: true, sampleKind, analysis })
  } catch (error) {
    console.error('phobos sample analysis failed:', error)
    return NextResponse.json({ error: 'Probenanalyse fehlgeschlagen.' }, { status: 503 })
  }
}
