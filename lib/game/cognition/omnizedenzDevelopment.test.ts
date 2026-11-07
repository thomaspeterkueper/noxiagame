import {describe,it,expect} from "vitest";
import {annotateEpisodes,assessHigherSymbols,OMNI_SYMBOLS} from "./omnizedenzDevelopment";
import {syntheticInfancy,runDevelopment} from "./ontogeneticLanguageExperiment";
describe("Omnizedenz observation layer",()=>{
 it("uses the established symbols",()=>expect(OMNI_SYMBOLS).toMatchObject({Avi:"∅",Nunc:"◉",Reso:"⇌",Ori:"⟳",Val:"∇"}));
 it("marks new and recurring words without claiming proven resonance",()=>{
   const trace=annotateEpisodes(syntheticInfancy(8));
   expect(trace[0].symbols.some(s=>s.symbol==="Avi")).toBe(true);
   expect(trace[4].symbols.some(s=>s.symbol==="Ori")).toBe(true);
   expect(trace[0].symbols.find(s=>s.symbol==="Reso")?.observed).toBe(false);
 });
 it("does not invent embodiment or introspection",()=>{
   const lex=runDevelopment(syntheticInfancy(8),{ball:"ball"},[7])[0].associations;
   expect(assessHigherSymbols(lex).filter(x=>x.applicable).map(x=>x.name)).toEqual(["Val"]);
 });
 it("does not alter the source episodes",()=>{
   const episodes=syntheticInfancy(3), original=JSON.stringify(episodes);
   annotateEpisodes(episodes);
   expect(JSON.stringify(episodes)).toBe(original);
 });
 it("rejects nonchronological input",()=>{
   expect(()=>annotateEpisodes([{day:2,scene:[],utterance:[],caregiver:"a"},{day:1,scene:[],utterance:[],caregiver:"a"}])).toThrow();
 });
});
