import { discoveryProbability, requiredChannel, rollResourceScan, scannerCapability, type ResourceCandidate } from './resourceScanning'

let failures=0
const check=(condition:boolean,message:string)=>{if(!condition){failures++;console.error('FAIL '+message)}}

const richIron:ResourceCandidate={id:'iron-1',resourceType:'iron_ore',lat:0,lon:0,abundance:.8,tier:'rich',mrdsBoosted:false}
const groundwater:ResourceCandidate={id:'water-1',resourceType:'groundwater',lat:0,lon:0,abundance:.5,tier:'viable',mrdsBoosted:false}

const basic=scannerCapability(0,0)
check(basic.interpretationLevel===0,'knowledge starts at interpretation level 0')
check(basic.channels.includes('mineral')&&!basic.channels.includes('subsurface'),'basic scanner channel gate')
check(requiredChannel('groundwater')==='subsurface','groundwater requires subsurface channel')
check(discoveryProbability(groundwater,basic)===0,'missing channel makes target unmeasurable')

const advanced=scannerCapability(2,2500,'seismic')
check(advanced.interpretationLevel===2,'knowledge raises interpretation level')
check(advanced.channels.includes('subsurface'),'hardware level 2 enables subsurface')
check(discoveryProbability(groundwater,advanced)>0,'matching seismic instrument can detect groundwater')

const known=new Set<string>(['iron-1'])
const skipped=rollResourceScan([richIron,groundwater],known,advanced,()=>0)
check(skipped.length===1&&skipped[0].candidate.id==='water-1','already known truth is not rediscovered')

const miss=rollResourceScan([groundwater],new Set(),advanced,()=>.999)
check(miss[0].measurable&&!miss[0].found,'measurable target may still be missed')
const hit=rollResourceScan([groundwater],new Set(),advanced,()=>0)
check(hit[0].measurable&&hit[0].found,'successful roll produces discovery')

const orbital=scannerCapability(3,6000,'orbital')
check(orbital.interpretationLevel===0,'orbital remote sensing remains interpretation-capped')
check(orbital.radiusKm===5,'orbital instrument uses remote-sensing radius')

if(failures)throw new Error(String(failures))
console.log('Resource scanning: tests passed')
