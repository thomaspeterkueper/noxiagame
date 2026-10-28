import { REAL_PLACE_HOSTS, stJohannesActivityWindows, sundernResonanceRoundWindows } from './realPlaceActivity'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

check(stJohannesActivityWindows(18).some(window=>window.kind==='open_community'),'daily open-community window starts at its phase')
check(stJohannesActivityWindows(19).some(window=>window.kind==='open_community'),'daily open-community window remains active for its duration')
check(!stJohannesActivityWindows(20).some(window=>window.kind==='open_community'),'daily open-community window closes after its duration')
check(stJohannesActivityWindows(108).some(window=>window.kind==='service'),'weekly service window starts from the shared tick')
check(stJohannesActivityWindows(109).some(window=>window.kind==='service'),'weekly service window spans two ticks')
check(!stJohannesActivityWindows(110).some(window=>window.kind==='service'),'weekly service window closes deterministically')
check(stJohannesActivityWindows(18+24).some(window=>window.kind==='open_community'),'daily window repeats without a second clock')
check(sundernResonanceRoundWindows(67).some(window=>window.kind==='resonance_round'),'weekly resonance round starts at its phase')
check(sundernResonanceRoundWindows(68).length===1 && sundernResonanceRoundWindows(69).length===0,'resonance round lasts two ticks')
check(sundernResonanceRoundWindows(67+168).length===1,'resonance round repeats weekly on the shared tick')
check(!stJohannesActivityWindows(67).some(window=>window.kind==='service') && sundernResonanceRoundWindows(108).length===0,'church service and resonance round do not overlap')
check(new Set(REAL_PLACE_HOSTS.map(host=>host.personKey)).size===REAL_PLACE_HOSTS.length,'each host is scheduled once')
check(stJohannesActivityWindows(108+168).some(window=>window.kind==='service'),'weekly window repeats without a second clock')

if(failures)throw new Error(String(failures)+' real-place schedule test(s) failed')
console.log('Real-place activity schedule: tests passed')
