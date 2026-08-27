// app/api/game/population/route.ts
// NOXIA-LIVING-0001 — lesbare Personenansicht für Gebäude/Standort

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const tileEntityId = req.nextUrl.searchParams.get('tileEntityId')
  const locationId = req.nextUrl.searchParams.get('locationId')

  if (!tileEntityId && !locationId) {
    return NextResponse.json({ error: 'tileEntityId oder locationId erforderlich.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let assignmentsQuery = supabase
    .from('person_assignments')
    .select('id, person_id, assignment_type, location_id, tile_entity_id, role_code, is_active')
    .eq('is_active', true)

  if (tileEntityId) assignmentsQuery = assignmentsQuery.eq('tile_entity_id', tileEntityId)
  else assignmentsQuery = assignmentsQuery.eq('location_id', locationId)

  const { data: assignments, error } = await assignmentsQuery
  if (error) {
    return NextResponse.json({ residents: [], unavailable: true, detail: error.message })
  }

  const personIds = [...new Set((assignments ?? []).map(a => a.person_id))]
  if (personIds.length === 0) return NextResponse.json({ residents: [] })

  const [{ data: people }, { data: needs }, { data: skills }] = await Promise.all([
    supabase
      .from('people')
      .select('id, display_name, birth_year, activity_state, last_action, last_decision_factors, last_tick')
      .in('id', personIds),
    supabase
      .from('person_needs')
      .select('person_id, need_code, satisfaction')
      .in('person_id', personIds),
    supabase
      .from('person_skills')
      .select('person_id, skill_code, level, experience')
      .in('person_id', personIds),
  ])

  const residents = (people ?? []).map(person => {
    const personAssignments = (assignments ?? []).filter(a => a.person_id === person.id)
    return {
      id: person.id,
      displayName: person.display_name,
      birthYear: person.birth_year,
      activityState: person.activity_state,
      lastAction: person.last_action,
      lastDecisionFactors: person.last_decision_factors ?? {},
      lastTick: person.last_tick,
      assignments: personAssignments.map(a => ({
        type: a.assignment_type,
        roleCode: a.role_code,
        tileEntityId: a.tile_entity_id,
      })),
      needs: (needs ?? []).filter(n => n.person_id === person.id).map(n => ({
        code: n.need_code,
        satisfaction: Number(n.satisfaction),
      })),
      skills: (skills ?? []).filter(s => s.person_id === person.id).map(s => ({
        code: s.skill_code,
        level: Number(s.level),
        experience: Number(s.experience),
      })),
    }
  }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))

  return NextResponse.json({ residents })
}
