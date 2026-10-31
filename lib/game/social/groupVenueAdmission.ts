/**
 * #551: validate a social-group visit against authoritative population rows
 * before the existing person_assignments -> projectInteriorPresence pipeline.
 * This does not create assignments: server-side writer must atomically check
 * arrival, capacity, invitation consent and scheduling before any mutation.
 */
import type { GroupVisit } from './groupVisits'

export interface PopulationPresenceEvidence {
  personId: string
  locationId: string
  activityState: string
  simulationTier: string
  travelling: boolean
  activeTemporaryVenueId: string | null
}
export type GroupVenueAdmission = Readonly<{
  admitted: boolean
  members: readonly string[]
  venueId: string
  reason: string
}>

export function assessGroupVenueAdmission(input: {
  visit: GroupVisit
  venueLocationId: string
  people: readonly PopulationPresenceEvidence[]
  verifiedInvitationIds: readonly string[]
  availableVisitorSlots: number
  venueAccessible: boolean
  venueOpen: boolean
}): GroupVenueAdmission {
  const {visit, venueLocationId, people}=input
  const reject=(reason:string):GroupVenueAdmission=>({admitted:false,members:[],venueId:visit.venueId,reason})
  if(visit.phase!=='travelling')return reject('visit_not_travelling')
  if(!input.venueAccessible||!input.venueOpen)return reject('venue_unavailable')
  if(!Number.isInteger(input.availableVisitorSlots)||input.availableVisitorSlots<visit.memberIds.length)
    return reject('visitor_capacity_unavailable')
  if(visit.memberIds.length<2||new Set(visit.memberIds).size!==visit.memberIds.length)
    return reject('invalid_group')
  const byId=new Map(people.map(p=>[p.personId,p]))
  const verified=new Set(input.verifiedInvitationIds)
  for(const id of visit.memberIds){
    if(id!==visit.initiatorId&&!verified.has(id))return reject('invitation_not_verified')
    const person=byId.get(id)
    if(!person||person.simulationTier!=='active'||person.locationId!==venueLocationId)
      return reject('person_not_present_in_location')
    if(person.travelling||person.activityState==='travelling')
      return reject('person_still_travelling')
    if(person.activityState==='working'||person.activityState==='resting')
      return reject('person_not_available')
    if(person.activeTemporaryVenueId&&person.activeTemporaryVenueId!==visit.venueId)
      return reject('conflicting_venue_assignment')
    if(!visit.arrivedIds.includes(id))return reject('arrival_not_verified')
  }
  return {admitted:true,members:[...visit.memberIds],venueId:visit.venueId,reason:'requires_atomic_core_commit'}
}
