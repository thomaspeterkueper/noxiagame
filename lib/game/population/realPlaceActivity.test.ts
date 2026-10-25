import { stJohannesActivityWindows } from './realPlaceActivity'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

check(stJohannesActivityWindows(18).some(window=>window.kind==='open_community'),'daily open-community window starts at its phase')
check(stJohannesActivityWindows(19).some(window=>window.kind==='open_community'),'daily open-community window remains active for its duration')
check(!stJohannesActivityWindows(20).some(window=>window.kind==='open_community'),'daily open-community window closes after its duration')
check(stJohannesActivityWindows(108).some(window=>window.kind==='service'),'weekly service window starts from the shared tick')
check(stJohannesActivityWindows(109).some(window=>window.kind==='service'),'weekly service window spans two ticks')
check(!stJohannesActivityWindows(110).some(window=>window.kind==='service'),'weekly service window closes deterministically')
check(stJohannesActivityWindows(18+24).some(window=>window.kind==='open_community'),'daily window repeats without a second clock')
check(stJohannesActivityWindows(108+168).some(window=>window.kind==='service'),'weekly window repeats without a second clock')

if(failures)throw new Error(String(failures)+' real-place schedule test(s) failed')
console.log('Real-place activity schedule: tests passed')
