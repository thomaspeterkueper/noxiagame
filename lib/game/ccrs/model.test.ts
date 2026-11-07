import { chooseAction, preview, propose, type Scene } from './model'
let failures = 0
function check(value: boolean, label: string) { if (!value) { failures++; console.error('FAIL',label) } }
const base: Scene = {id:'seelenberg-cafe',tick:42,tension:65,contamination:40,restorationCapacity:12,actors:[
  {id:'a',empathy:85,frustration:10,trust:50},
  {id:'b',empathy:10,frustration:95,trust:50},
]}
const event=propose(base,'a','mediate','pilot')
check(JSON.stringify(propose(base,'a','mediate','pilot'))===JSON.stringify(event),'deterministic event')
check(JSON.stringify(chooseAction(base,base.actors[0],'pilot'))===JSON.stringify(chooseAction(base,base.actors[0],'pilot')),'deterministic choice')
check(preview(base,event).tension===55 && base.tension===65,'mediation reduces tension without mutating source')
check(preview(base,propose(base,'b','provoke','pilot')).tension===77,'provocation increases tension')
const restored=preview(base,propose(base,'a','restore','pilot'))
check(restored.contamination===32 && restored.restorationCapacity===4,'restoration consumes capacity')
check(preview({...base,restorationCapacity:0},propose({...base,restorationCapacity:0},'a','restore','pilot')).contamination===40,'no free restoration')
check(preview({...base,tension:99},propose({...base,tension:99},'b','provoke','pilot')).tension===100,'bounded values')
try { propose(base,'missing','provoke','pilot'); check(false,'invalid actor rejected') } catch { check(true,'invalid actor rejected') }
if (failures) throw Error(`${failures} CCRS tests failed`)
console.log('CCRS pure model tests passed')
