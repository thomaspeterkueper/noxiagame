import { composeSymbolicFrame } from './npcSymbolicResonance'
const check=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)}
const signals=[
 {sourceNode:'perception' as const,symbol:'reso' as const,intensity:.9,confidence:.8,sourceRef:'observation:1',tick:7},
 {sourceNode:'memory' as const,symbol:'avi' as const,intensity:.7,confidence:.5,sourceRef:'memory:2',tick:7},
]
const f=composeSymbolicFrame(signals)
check(f.symbols.includes('reso')&&f.symbols.includes('avi'),'multiple meanings preserved')
check(f.sourceRefs.length===2,'provenance retained')
check(composeSymbolicFrame([...signals,signals[0]]).sourceRefs.length===2,'duplicate suppressed')
check(composeSymbolicFrame([]).uncertainty===1,'missing evidence stays uncertain')
check(composeSymbolicFrame([{...signals[0],confidence:NaN}]).symbols.length===0,'invalid signals rejected')
console.log('NPC symbolic resonance prototype passed')
