import { incidentAt, incidentFacts, incidentNotice, incidentPose, incidentResponders, responderFacts, VENUE_INCIDENT_EVENT } from './venueIncident'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

const T = 'tile-1'
const row = (p: Record<string, unknown>) => ({ payload: { tileEntityId: T, level: 'rangelei', startsTick: 100, endsTick: 110, aftermathTick: 130, participants: [{ personId: 'a', role: 'angreifer', outcome: 'steht' }, { personId: 'b', role: 'verteidiger', outcome: 'am_boden' }], ...p } })

check(VENUE_INCIDENT_EVENT === 'venue_incident', 'event name')
check(incidentAt([row({})], T, 99) === null && incidentAt([row({})], T, 130) === null && incidentAt([row({})], T, 105) !== null && incidentAt([row({})], T, 120) !== null, 'from start until the aftermath ends')
check(incidentAt([row({ cancelled: true })], T, 105) === null && incidentAt([row({})], 'x', 105) === null && incidentAt([row({ participants: [] })], T, 105) === null, 'cancelled, other house, nobody involved: nothing')
const r = incidentAt([row({})], T, 102)!
check(incidentPose(r, 'a', 102)?.pose === 'schubsen' && incidentPose(r, 'b', 102)?.pose === 'abwehren' && incidentPose(r, 'c', 102) === null, 'scuffle: pushing and fending off, bystanders as usual')
check(incidentPose(r, 'b', 108)?.pose === 'hinfallen' && incidentPose(r, 'b', 120)?.pose === 'liegen' && incidentPose(r, 'a', 120) === null, 'the one who goes down falls and stays down for a while')
const k = incidentAt([row({ level: 'kampf', participants: [{ personId: 'a', role: 'angreifer', outcome: 'steht' }, { personId: 'b', role: 'verteidiger', outcome: 'verletzt' }, { personId: 's', role: 'schlichter', outcome: 'steht' }] })], T, 101)!
check(incidentPose(k, 'a', 101)?.pose === 'zuschlagen' && incidentPose(k, 's', 101)?.pose === 'abwehren', 'fight: hitting, peacemaker in between')
const after = incidentPose(k, 'b', 120)
check(after?.pose === 'liegen' && after.verletzt === true, 'injured in a fight: down and visibly hurt')
check(incidentFacts(k, 'b', 101, { a: 'Ben' }).some(f => f.includes('Ben') && f.includes('angegangen')) && incidentFacts(k, 'b', 101).some(f => f.includes('verletzt')), 'involved know their part')
check(incidentFacts(k, 'z', 101, { a: 'Ben', b: 'Anna' }).some(f => f.includes('Ben und Anna')) && incidentFacts(null, 'z', 101).length === 0, 'bystanders know what they saw, nothing without an event')
check(incidentNotice(k, 101).includes('Schlägerei') && incidentNotice(k, 120).includes('verletzt'), 'notice')

{
  const k2 = incidentAt([row({ level: 'kampf', participants: [{ personId: 'a', role: 'angreifer', outcome: 'steht' }, { personId: 'b', role: 'verteidiger', outcome: 'verletzt' }] })], T, 101)!
  check(incidentResponders(k2, 105).length === 0, 'nobody comes while it still runs')
  const r = incidentResponders(k2, 115)
  check(r.filter(x => x.roleCode === 'police').length === 2 && r.filter(x => x.roleCode === 'paramedic').length === 2, 'police and paramedics after a fight with injury')
  check(incidentResponders(k2, 130).length === 0, 'gone when the aftermath ends')
  const sc = incidentAt([row({})], T, 102)!
  check(incidentResponders(sc, 115).length === 0, 'a scuffle without injury or ban: nobody is called')
  check(responderFacts(k2, r[0]).some(f => f.includes('Schlägerei')) && incidentNotice(k2, 115).includes('Polizei') && incidentNotice(k2, 115).includes('Rettungsdienst'), 'responders know why they are here; notice says so')
}

if (failures) { console.error(failures + ' failed'); process.exit(1) } else console.log('venueIncident: all passed')
