import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { applyHealthAffectingEvent } from '@/lib/game/population/healthRuntime'
import { healthEffectFromFacilityIncident, type FacilityIncident } from './facilityIncidents'

export async function recordFacilityIncident(incident: FacilityIncident) {
  const supabase = createServiceClient()

  const { data: event, error } = await supabase.from('population_events').insert({
    tick: incident.tick,
    event_type: 'facility_incident',
    actor_person_id: incident.affectedPersonId,
    location_id: incident.locationId,
    subject_type: 'tile_entity',
    subject_ref: incident.tileEntityId,
    payload: {
      kind: incident.kind,
      severity: incident.severity,
      causeRef: incident.causeRef,
    },
  }).select('id').single()
  if (error) throw error

  const healthEffect = healthEffectFromFacilityIncident(incident)
  if (healthEffect && incident.affectedPersonId) {
    await applyHealthAffectingEvent(supabase, {
      personId: incident.affectedPersonId,
      locationId: incident.locationId,
      tick: incident.tick,
      event: healthEffect,
      sourceSubjectType: 'facility_incident',
      sourceSubjectRef: event.id,
    })
  }

  return { eventId: event.id, healthEffectApplied: Boolean(healthEffect) }
}
