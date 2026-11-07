import {makeActor,dreamRecombine,transmitMemory,injectSyntheticSignal,inspectKnownTokens} from './npc-cognition-cohorts.mjs';
import {seeded} from './npc-information-simulator.mjs';
export function runPopulation({seed=717,npcsPerGroup=8,ticks=30}={}) {
 if(!Number.isSafeInteger(seed)||!Number.isInteger(npcsPerGroup)||npcsPerGroup<2||npcsPerGroup>100||!Number.isInteger(ticks)||ticks<1||ticks>1000) throw Error('invalid population configuration');
 const groups=['control','recombination','social','signal','placebo'];
 const cohorts=Object.fromEntries(groups.map(g=>[g,Array.from({length:npcsPerGroup},(_,i)=>makeActor(g+':'+i,[{tokens:['common','base'+(i%3)],ref:'observation:'+g+':'+i},{tokens:['base'+(i%3),'local'+i],ref:'observation:local:'+g+':'+i}]))]));
 const random=seeded(seed);
 const timeline=[];
 for(let tick=1;tick<=ticks;tick++){
  for(const g of groups){
   const actors=cohorts[g];
   if(g!=='control') for(let i=0;i<actors.length;i++) actors[i]=dreamRecombine(actors[i],{maxPairs:12});
   if(g==='social' && tick%3===0){
    const sender=Math.floor(random()*actors.length); const receiver=(sender+1)%actors.length;
    const available=[...actors[sender].memories,...actors[sender].dreams];
    const selected=available[Math.floor(random()*available.length)];
    actors[receiver]=transmitMemory(actors[sender],actors[receiver],selected.id,{conversationId:'offline:'+tick+':'+sender, tick});
   }
   if(g==='signal' && tick===Math.ceil(ticks/2)) actors[0]=injectSyntheticSignal(actors[0],['hidden-target'],{experimentId:'offline:'+seed});
   if(g==='placebo' && tick===Math.ceil(ticks/2)) actors[0]=injectSyntheticSignal(actors[0],['random-decoy'],{experimentId:'placebo:'+seed});
  }
  timeline.push({tick,groups:Object.fromEntries(groups.map(g=>[g,{
   memories:cohorts[g].reduce((n,a)=>n+a.memories.length,0),
   dreams:cohorts[g].reduce((n,a)=>n+a.dreams.length,0),
   knowledge: new Set(cohorts[g].flatMap(inspectKnownTokens)).size,
   targetExposure:cohorts[g].filter(a=>inspectKnownTokens(a).includes('hidden-target')).length
  }]))});
 }
 return {config:{seed,npcsPerGroup,ticks},timeline,final:timeline.at(-1).groups};
}
