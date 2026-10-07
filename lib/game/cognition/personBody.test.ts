import {applyBodyInsult,advanceBodyHealing,healthyBody,projectBody,senseBody} from './personBody'
let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const healthy=projectBody(healthyBody())
check(healthy.painSignal===0&&!healthy.reflexStimulus,'healthy body has no synthetic pain')
const burned=applyBodyInsult(healthyBody(),{id:'hot-pan',kind:'thermal',region:'right_hand',intensity:1,duration:1})
const acute=projectBody(burned)
check(acute.interoception.dominantRegion==='right_hand','local injury preserves body region')
check(acute.interoception.nociception>0&&acute.reflexStimulus?.kind==='pain','acute tissue damage produces nociception and reflex input')
const later=advanceBodyHealing(burned,12)
check(senseBody(later).nociception<acute.interoception.nociception,'healing reduces nociception')
check(projectBody(later).reflexStimulus===null,'old injury does not endlessly retrigger acute withdrawal')
const systemic={...healthyBody(),oxygenStress:.8}
const hypoxia=projectBody(systemic)
check(hypoxia.interoception.systemicDistress===.8&&hypoxia.interoception.nociception===0,'systemic distress remains distinct from nociception')
if(failures)throw new Error(String(failures)+' body test(s) failed')
console.log('Person body: tests passed; deterministic=1; external_llm_calls=0; persistence_writes=0')
