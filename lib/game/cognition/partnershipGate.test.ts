import { proposePartnership, type PartnershipRequest } from './partnershipGate'
let failures=0
function check(value:boolean,label:string){if(!value){failures++; console.error('FAIL',label)}}
const base:PartnershipRequest={
 eventId:'bond-1',personA:'alice',personB:'bob',atTick:50,adultA:true,adultB:true,
 consentA:{personId:'alice',partnerId:'bob',accepted:true,recordedAtTick:40,expiresAtTick:60},
 consentB:{personId:'bob',partnerId:'alice',accepted:true,recordedAtTick:45,expiresAtTick:55},
 alreadyPartnered:false,
}
const accepted=proposePartnership(base)
check(accepted.allowed && accepted.command.members.join(',')==='alice,bob','mutual consent creates proposal')
check(!proposePartnership({...base,consentB:null}).allowed,'one-sided proposal rejected')
check(!proposePartnership({...base,consentA:{...base.consentA!,accepted:false}}).allowed,'revoked consent rejected')
check(!proposePartnership({...base,atTick:61}).allowed,'expired consent rejected')
check(!proposePartnership({...base,adultB:false}).allowed,'minor rejected')
check(!proposePartnership({...base,personB:'alice'}).allowed,'self partnership rejected')
check(!proposePartnership({...base,alreadyPartnered:true}).allowed,'duplicate bond rejected')
check(JSON.stringify(accepted)===JSON.stringify(proposePartnership(base)),'deterministic proposal')
if(failures) throw Error(failures+' partnership gate tests failed')
console.log('Partnership gate tests passed')
