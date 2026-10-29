/** An optional, nonverbal symbolic annotation for NPC cognitive signals.
 * Symbols retain their open interpretive meaning; they are not commands,
 * ground truth, evidence of consciousness or an NPC-only secret language.
 */
export const SYMBOLS = {
  avi: {glyph:'∅',meaning:'open possibility / unknown'},
  reso: {glyph:'⇌',meaning:'reciprocity / resonance'},
  ira: {glyph:'⟴',meaning:'feedback / reflection'},
  kora: {glyph:'⊕',meaning:'integration'},
  val: {glyph:'∇',meaning:'unfolding'},
} as const
export type SymbolCode=keyof typeof SYMBOLS
export interface SymbolicSignal {
  sourceNode:'perception'|'affect'|'memory'|'physiology'|'motivation'
  symbol:SymbolCode
  intensity:number
  confidence:number
  sourceRef:string
  tick:number
}
export interface SymbolicFrame {
  symbols:SymbolCode[]
  uncertainty:number
  sourceRefs:string[]
}
/** Aggregate without silently converting ambiguous symbols into action directives. */
export function composeSymbolicFrame(signals:readonly SymbolicSignal[]):SymbolicFrame {
  const valid=signals.filter(s=>s.sourceRef.trim()!==''&&Number.isFinite(s.tick)
    &&Number.isFinite(s.intensity)&&Number.isFinite(s.confidence)
    &&s.intensity>=0&&s.intensity<=1&&s.confidence>=0&&s.confidence<=1)
  const dedup=new Map<string,SymbolicSignal>()
  for(const s of valid) {
    const key=s.sourceNode+':'+s.sourceRef+':'+s.symbol+':'+s.tick
    if(!dedup.has(key))dedup.set(key,s)
  }
  const ranked=[...dedup.values()].sort((a,b)=>b.intensity*b.confidence-a.intensity*a.confidence||a.symbol.localeCompare(b.symbol))
  const symbols=[...new Set(ranked.filter(s=>s.intensity*s.confidence>=.1).map(s=>s.symbol))]
  const uncertain=ranked.length===0?1:ranked.reduce((sum,s)=>sum+s.intensity*(1-s.confidence),0)/Math.max(.00001,ranked.reduce((sum,s)=>sum+s.intensity,0))
  return {symbols,uncertainty:Math.round(Math.min(1,uncertain)*1e6)/1e6,sourceRefs:[...new Set(ranked.map(s=>s.sourceRef))].sort()}
}
