import { buildLocalSurfaceScene } from '../spatial/localSurfaceScene'
import { emptyPerceptionFilterState } from './npcPerceptionFilter'
import { observeLocalScene } from './localScenePerception'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const scene=buildLocalSurfaceScene({
  body:'earth',frameId:'test-town',radiusM:100,
  buildings:[{id:'cafe',center:{xM:8,yM:0},widthM:8,depthM:6,rotationDeg:0,provenance:'observed',label:'Café'}],
  mobileObjects:[{id:'resident:hana',point:{xM:0,yM:0},label:'Hana',role:'person:npc'},{id:'resident:lan',point:{xM:12,yM:0},label:'Lan',role:'person:npc'}],
})
let state=emptyPerceptionFilterState()
let r=observeLocalScene({scene,observerId:'hana',observerPoint:{xM:0,yM:0},atTick:10,state})
check(r.emitted.length===2,'Hana sees cafe and Lan but not herself')
check(r.emitted.some(o=>o.subjectRef==='building:cafe'),'building observation emitted')
check(r.emitted.some(o=>o.subjectRef==='mobile:resident:lan'),'person observation emitted')
state=r.nextState
r=observeLocalScene({scene,observerId:'hana',observerPoint:{xM:0,yM:0},atTick:11,state})
check(r.emitted.length===0,'unchanged local scene produces no repeated observations')
r=observeLocalScene({scene,observerId:'hana',observerPoint:{xM:30,yM:0},atTick:12,state:r.nextState})
check(r.emitted.some(o=>o.subjectRef==='building:cafe'),'distance-band change is observable')
if(failures)throw new Error(String(failures)+' local scene perception test(s) failed')
console.log('Local scene NPC perception: tests passed; repeated_static_scene_emissions=0')
