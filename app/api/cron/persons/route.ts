// app/api/cron/persons/route.ts
// Named-person simulation heartbeat. Deterministic; no LLM decisions.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { loadColonyPressures } from '@/lib/game/colonyPressure'
import { runPersonTick } from '@/lib/game/personBrain'
import { projectInteriorPresence } from '@/lib/game/population/interiorPresence'
import { persistInteriorPerception } from '@/lib/game/cognition/interiorPerception'
import { projectSurfacePresence } from '@/lib/game/population/surfacePresence'

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: tickRow } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  const tick = Number(tickRow?.tick_number ?? 0)
  const pressures = await loadColonyPressures(supabase)
  const result = await runPersonTick(supabase, tick, pressures)

  // Project room presence after decisions so cognition observes the resulting
  // authoritative activity state, never the client-side spatial projection.
  const { data: activePeople, error: peopleError } = await supabase
    .from('people')
    .select('id, activity_state')
    .eq('simulation_tier', 'active')
  const personIds = (activePeople ?? []).map((person: any) => person.id)
  const { data: assignments, error: assignmentsError } = personIds.length
    ? await supabase
        .from('person_assignments')
        .select('id, person_id, assignment_type, tile_entity_id, role_code, is_active')
        .in('person_id', personIds)
        .eq('is_active', true)
    : { data: [], error: null }

  let interior = { projected: 0, moved: 0, entered: 0, cleared: 0 }
  let surface = { projected: 0, updated: 0, cleared: 0 }
  let epistemic = { written: 0, error: null as string | null }
  const projectionErrors: string[] = []
  if (peopleError) projectionErrors.push(`interior people load: ${peopleError.message ?? peopleError}`)
  if (assignmentsError) projectionErrors.push(`interior assignments load: ${assignmentsError.message ?? assignmentsError}`)
  if (!peopleError && !assignmentsError) {
    try {
      interior = await projectInteriorPresence(supabase, tick, activePeople ?? [], assignments ?? [])
      surface = await projectSurfacePresence(supabase, tick, activePeople ?? [], assignments ?? [])
      const { data: presenceRows, error: presenceError } = personIds.length
        ? await supabase
            .from('person_interior_presence')
            .select('person_id, tile_entity_id, template_id, room_id, updated_tick')
            .in('person_id', personIds)
        : { data: [], error: null }
      if (presenceError) projectionErrors.push(`interior presence load: ${presenceError.message ?? presenceError}`)
      else epistemic = await persistInteriorPerception(supabase, tick, presenceRows ?? [])
    } catch (error: any) {
      projectionErrors.push(`interior projection: ${error?.message ?? String(error)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    tick,
    locationsWithPressure: pressures.size,
    ...result,
    interior,
    surface,
    epistemic,
    errors: [...result.errors, ...projectionErrors, ...(epistemic.error ? [`epistemic: ${epistemic.error}`] : [])],
  })
}
