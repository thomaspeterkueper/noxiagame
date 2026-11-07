import { simulateBodyIncident } from './personBodyExperiment'
const result=simulateBodyIncident({personId:'test-person',tick:10,insult:{id:'burn-1',kind:'thermal',region:'right_hand',intensity:1,duration:1}})
if(result.interoception.dominantRegion!=='right_hand')throw Error('wrong region')
if(!result.reflex?.triggered||result.reflex.kind!=='withdraw')throw Error('acute withdrawal missing')
if(result.affect.pain<=0||result.affect.fear<=0)throw Error('pain/affect missing')
if(result.later.interoception.nociception>=result.interoception.nociception)throw Error('healing did not reduce nociception')
if(result.later.reflexStimulus!==null)throw Error('reflex retriggered during healing')
console.log('PASS: burn -> withdrawal -> localized injury -> pain/fear -> healing')
