import { describe, expect, it } from 'vitest'
import { inviteToVenue, applyVisitEvent } from './groupVisits'
import { assessGroupVenueAdmission, type PopulationPresenceEvidence } from './groupVenueAdmission'
const people: PopulationPresenceEvidence[] = ['a','b'].map(personId=>({
  personId, locationId:'earth', activityState:'idle', simulationTier:'active',
  travelling:false, activeTemporaryVenueId:null,
}))
function fixture() {
  let visit=inviteToVenue({id:'g',venueId:'cafe',initiatorId:'a',invitedId:'b',now:1})
  visit=applyVisitEvent(visit,{type:'accept',actorId:'b'},2).visit
  for(const id of ['a','b']) visit=applyVisitEvent(visit,{type:'arrive',actorId:id,routeConfirmed:true},3).visit
  return {visit,venueLocationId:'earth',people,verifiedInvitationIds:['b'],availableVisitorSlots:2,venueAccessible:true,venueOpen:true}
}
describe('group admission checks',()=>{
  it('recognizes confirmed group ready for server commit',()=>{
    const a=assessGroupVenueAdmission(fixture())
    expect(a.admitted).toBe(true)
    expect(a.reason).toBe('requires_atomic_core_commit')
  })
  it('denies unverified consent and unconfirmed arrival',()=>{
    expect(assessGroupVenueAdmission({...fixture(),verifiedInvitationIds:[]}).admitted).toBe(false)
    const f=fixture()
    expect(assessGroupVenueAdmission({...f,visit:{...f.visit,arrivedIds:['a']}}).reason).toBe('arrival_not_verified')
  })
  it('denies travel, workplace conflicts and insufficient capacity',()=>{
    const f=fixture()
    expect(assessGroupVenueAdmission({...f,availableVisitorSlots:1}).admitted).toBe(false)
    expect(assessGroupVenueAdmission({...f,people:people.map(p=>p.personId==='b'?{...p,travelling:true}:p)}).admitted).toBe(false)
    expect(assessGroupVenueAdmission({...f,people:people.map(p=>p.personId==='b'?{...p,activeTemporaryVenueId:'other'}:p)}).admitted).toBe(false)
  })
})
