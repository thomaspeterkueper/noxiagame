import type { AffectState } from "../../game/cognition/personAffect";
import { affectSalience } from "../../game/cognition/personAffect";
import type { ReflexAdaptation } from "../../game/cognition/personReflex";

export type MemoryCarrier={salience:number;uncertainty:number};
export type BiographicalCarriers={affect:AffectState;reflex:ReflexAdaptation;memory:MemoryCarrier};
export type ClosureStage='visible'|'affect'|'affect+reflex'|'affect+reflex+memory';
export type Acce004Point={stage:ClosureStage;defect:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));

// Synthetic response observable: each term is a present-state carrier already
// represented in NOXIA. History labels themselves are deliberately absent.
export function biographicalResponse(c:BiographicalCarriers):number{
  const affect=.30*affectSalience(c.affect)+.12*clamp((1-c.affect.mood)/2);
  const reflex=.28*clamp(c.reflex.sensitization-c.reflex.habituation+.5);
  const memory=.20*clamp(c.memory.salience)+.10*clamp(c.memory.uncertainty);
  return affect+reflex+memory;
}
function partial(c:BiographicalCarriers,stage:ClosureStage):number{
  let v=0;
  if(stage!=='visible')v+=.30*affectSalience(c.affect)+.12*clamp((1-c.affect.mood)/2);
  if(stage==='affect+reflex'||stage==='affect+reflex+memory')v+=.28*clamp(c.reflex.sensitization-c.reflex.habituation+.5);
  if(stage==='affect+reflex+memory')v+=.20*clamp(c.memory.salience)+.10*clamp(c.memory.uncertainty);
  return v;
}
export function biographicalClosureCurve(a:BiographicalCarriers,b:BiographicalCarriers):Acce004Point[]{
  const observed=biographicalResponse(a)-biographicalResponse(b);
  const stages:ClosureStage[]=['visible','affect','affect+reflex','affect+reflex+memory'];
  return stages.map(stage=>({stage,defect:Math.abs(observed-(partial(a,stage)-partial(b,stage)))}));
}
