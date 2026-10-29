import { summarizeInteractionSignals, type InteractionSignal } from './npcInteractionSignals'
const base = (n:number,outcome:InteractionSignal['outcome']='helpful'):InteractionSignal=>({
  id:'event:'+n,npcId:'lan',topic:'orientation',context:'everyday',outcome,
  actor:'player',feedbackOptIn:true,sourceRef:'feedback:'+n,simulationTick:n,
})
const check=(condition:boolean,message:string)=>{if(!condition)throw new Error(message)}
check(summarizeInteractionSignals([base(1),base(2)] )[0].status==='insufficient','small sample remains insufficient')
const rows=[base(1),base(2),base(3),base(4),base(5)]
check(summarizeInteractionSignals(rows)[0].status==='candidate-improvement','qualified group gets review candidate')
check(summarizeInteractionSignals([...rows,{...base(6),feedbackOptIn:false}])[0].independentSources===5,'opt-out excluded')
check(summarizeInteractionSignals([...rows,{...base(7),sourceRef:'feedback:1',outcome:'unhelpful'}])[0].independentSources===5,'same source not double counted')
const historical = {...base(1),context:'chronimap' as const,historicalEvidence:'simulation' as const}
check(summarizeInteractionSignals([historical]).length===0,'simulated history is not empirical evidence')
check(summarizeInteractionSignals([base(1,'unhelpful'),base(2,'unhelpful'),base(3,'unhelpful'),base(4),base(5)])[0].status==='needs-review','repeated failures require review')
console.log('NPC interaction signals: pure evaluation tests passed')
