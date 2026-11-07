/** Experimental Omnizedenz interpretation layer; not an NPC's innate language. */
import type { Episode, Lexicon } from "./ontogeneticLanguageExperiment";
export type SymbolName = "Avi" | "Nunc" | "Reso" | "Ori" | "Val" | "Ira" | "Kora" | "Lume";
export const OMNI_SYMBOLS: Readonly<Record<SymbolName,string>> = {
  Avi:"∅", Nunc:"◉", Reso:"⇌", Ori:"⟳", Val:"∇", Ira:"⟴", Kora:"⊕", Lume:"∫"
};
export type SymbolEvidence = Readonly<{
  symbol:SymbolName; reason:string; observed:boolean;
}>;
export type SymbolicTrace = Readonly<{
  day:number; episodeIndex:number; symbols:readonly SymbolEvidence[];
}>;
/** Tags evidence, not inferred consciousness or true causal resonance. */
export function annotateEpisodes(episodes:readonly Episode[]):readonly SymbolicTrace[] {
  if (episodes.some((e,i)=>i>0 && e.day<episodes[i-1].day)) throw new Error("episodes_not_chronological");
  const seen=new Map<string,number>();
  return episodes.map((e,index)=>{
    const words=[...new Set(e.utterance.map(x=>x.toLowerCase().trim()).filter(Boolean))];
    const scene=new Set(e.scene.map(x=>x.toLowerCase().trim()));
    const tags:SymbolEvidence[]=[{symbol:"Nunc",reason:"episode_recorded",observed:true}];
    if (words.some(w=>!seen.has(w))) tags.push({symbol:"Avi",reason:"unseen_word_potential",observed:true});
    if (words.some(w=>(seen.get(w)??0)>0)) tags.push({symbol:"Ori",reason:"word_recurrence",observed:true});
    if (e.attention && scene.has(e.attention.toLowerCase().trim()) && words.length)
      tags.push({symbol:"Reso",reason:"cooccurrence_only_not_proven_resonance",observed:false});
    for(const w of words) seen.set(w,(seen.get(w)??0)+1);
    return {day:e.day,episodeIndex:index,symbols:tags};
  });
}
export type SymbolicAssessment = Readonly<{name:SymbolName; applicable:boolean; evidence:string}>;
/** Interpretations requiring longitudinal or embodied evidence stay unconfirmed. */
export function assessHigherSymbols(lexicon:Lexicon):readonly SymbolicAssessment[] {
  const hasAssociations=Object.values(lexicon).some(scores=>Object.values(scores).some(v=>Number.isFinite(v)&&v>0));
  return [
    {name:"Val",applicable:hasAssociations,evidence:hasAssociations?"association_present_not_learning_proven":"no_associations"},
    {name:"Ira",applicable:false,evidence:"self_reflection_not_measured"},
    {name:"Kora",applicable:false,evidence:"integration_not_operationalized"},
    {name:"Lume",applicable:false,evidence:"embodiment_not_measured"},
  ];
}
