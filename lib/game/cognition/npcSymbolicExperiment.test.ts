import { assessEncounter } from './npcSymbolicExperiment'
const check=(ok:boolean,msg:string)=>{if(!ok)throw Error(msg)}
const a=assessEncounter({npcId:'a',fatigue:.1,trust:.9,observedDistress:.8,remembersConflict:false})
const b=assessEncounter({npcId:'b',fatigue:.9,trust:.2,observedDistress:.8,remembersConflict:true})
check(a.baseline.approach>b.baseline.approach,'individual history and fatigue alter response')
check(b.baseline.withdraw>a.baseline.withdraw,'fatigued mistrustful agent favors withdrawal')
check(a.symbolic.sourceRefs.every(x=>x.endsWith(':a')),'A contains only own sources')
check(b.symbolic.sourceRefs.every(x=>x.endsWith(':b')),'B contains only own sources')
check(a.symbolic.symbols.includes('avi') && b.symbolic.symbols.includes('avi'),'ambiguity survives shared observation')
check(JSON.stringify(a)===JSON.stringify(assessEncounter({npcId:'a',fatigue:.1,trust:.9,observedDistress:.8,remembersConflict:false})),'deterministic repeat')
console.log('Symbolic A/B encounter fixtures passed')
