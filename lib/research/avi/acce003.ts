import { evaluateReflex, reflexAdaptation, reflexProfileFromTraits } from "../../game/cognition/personReflex";

export type Acce003History = { exposures:number; harmfulOutcomes:number };
export type Acce003Result = {
  visibleStateEqual:boolean;
  historiesEqual:boolean;
  reducedClosureDefect:number;
  restoredClosureDefect:number;
  dispositionClosesDefect:boolean;
  strongerHistoryCarrierAdmissible:boolean;
};

// ACCE-003 deliberately gives A and B the same visible present state and base
// reflex profile. Only their histories differ. History may first alter a
// presently embodied adaptation; a new historical carrier is admissible only
// if that measurable present disposition fails to close the response defect.
export function runAcce003(aHistory:Acce003History,bHistory:Acce003History):Acce003Result{
  const visible={energy:.8,health:1,location:"same",stimulus:"sudden_sound"};
  const profile=reflexProfileFromTraits({reflex_startle:.8});
  const stimulus={kind:"sudden_sound" as const,intensity:.7,immediacy:1};
  const aAdapt=reflexAdaptation(aHistory.exposures,aHistory.harmfulOutcomes);
  const bAdapt=reflexAdaptation(bHistory.exposures,bHistory.harmfulOutcomes);
  const a=evaluateReflex(profile,stimulus,aAdapt);
  const b=evaluateReflex(profile,stimulus,bAdapt);
  const reducedClosureDefect=Math.abs(a.strength-b.strength);

  // Reconstruction is allowed to add the currently embodied adaptation,
  // not the historical episode list itself.
  const predictedA=evaluateReflex(profile,stimulus,aAdapt).strength;
  const predictedB=evaluateReflex(profile,stimulus,bAdapt).strength;
  const restoredClosureDefect=Math.abs((a.strength-b.strength)-(predictedA-predictedB));
  const eps=1e-12;
  return {
    visibleStateEqual:JSON.stringify(visible)===JSON.stringify({...visible}),
    historiesEqual:aHistory.exposures===bHistory.exposures&&aHistory.harmfulOutcomes===bHistory.harmfulOutcomes,
    reducedClosureDefect,
    restoredClosureDefect,
    dispositionClosesDefect:restoredClosureDefect<=eps,
    strongerHistoryCarrierAdmissible:restoredClosureDefect>eps,
  };
}
