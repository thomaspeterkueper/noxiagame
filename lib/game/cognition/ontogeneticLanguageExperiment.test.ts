import {describe,it,expect} from "vitest";
import {learnEpisode,predictReferent,runDevelopment,syntheticInfancy} from "./ontogeneticLanguageExperiment";
const targets={ball:"ball",cup:"cup",book:"book",water:"water"};
describe("ontogenetic language experiment",()=>{
 it("begins with no learned vocabulary",()=>{expect(runDevelopment([],targets,[0])[0].vocabulary).toBe(0)});
 it("learns from chronological, grounded interactions",()=>{
  const snapshots=runDevelopment(syntheticInfancy(120),targets,[0,3,7,29,119]);
  expect(snapshots[0].accuracy).toBeLessThanOrEqual(snapshots[4].accuracy);
  expect(snapshots[4].correct).toBe(4);
 });
 it("is deterministic",()=>expect(runDevelopment(syntheticInfancy(40),targets,[9,39])).toEqual(runDevelopment(syntheticInfancy(40),targets,[9,39])));
 it("does not learn an unseen word",()=>expect(predictReferent(learnEpisode({},{day:0,scene:["cup"],utterance:["cup"],caregiver:"a"}),"tree")).toBeNull());
 it("rejects non-visible attention",()=>expect(()=>learnEpisode({},{day:0,scene:["cup"],utterance:["cup"],caregiver:"a",attention:"ball"})).toThrow());
 it("rejects out of order experiences",()=>expect(()=>runDevelopment([{day:2,scene:["cup"],utterance:["cup"],caregiver:"a"},{day:1,scene:["cup"],utterance:["cup"],caregiver:"a"}],targets,[2])).toThrow());
 it("does not infer an answer from an exact tie",()=>expect(predictReferent({cup:{cup:1,ball:1}},"cup")).toBeNull());
 it("preserves earlier snapshots when later experiences occur",()=>{
  const snapshots=runDevelopment(syntheticInfancy(20),targets,[0,19]);
  expect(snapshots[0].vocabulary).toBe(1);
  expect(snapshots[0].associations.cup).toBeUndefined();
 });
});
