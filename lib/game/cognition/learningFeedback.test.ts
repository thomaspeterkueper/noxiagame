import {describe,it,expect} from "vitest";
import {appendLearningEvent,evaluateLearning,simulateLearningCycle,type LearningEvent} from "./learningFeedback";
const p: Extract<LearningEvent,{type:"prediction"}>={type:"prediction",id:"p1",actorId:"npc-1",modelVersion:"v1",metric:"energy",unit:"kWh",contextId:"room",expected:10,tolerance:2,tick:1};
const o: Extract<LearningEvent,{type:"observation"}>={type:"observation",id:"o1",predictionId:"p1",actorId:"npc-1",metric:"energy",unit:"kWh",contextId:"room",measured:15,sourceId:"meter",tick:2};
describe("learning feedback",()=>{
 it("creates three ordered immutable events",()=>{
   const ledger=simulateLearningCycle([],p,o,"e1");
   expect(ledger.map(e=>e.type)).toEqual(["prediction","observation","evaluation"]);
   expect(ledger[2]).toMatchObject({result:"deviation_detected",deviation:5});
   expect(Object.isFrozen(ledger)).toBe(true);
 });
 it("does not auto-approve a model revision",()=>{
   const ledger=simulateLearningCycle([],p,o,"e1");
   expect(ledger.some(e=>e.type==="revision_proposed")).toBe(false);
 });
 it("permits a proposal only after detected deviation",()=>{
   const ledger=simulateLearningCycle([],p,o,"e1");
   expect(appendLearningEvent(ledger,{type:"revision_proposed",id:"r1",actorId:"npc-1",evaluationId:"e1",proposedModelVersion:"v2",tick:3})).toHaveLength(4);
   expect(()=>appendLearningEvent([], {type:"revision_proposed",id:"r1",actorId:"npc-1",evaluationId:"e1",proposedModelVersion:"v2",tick:3})).toThrow();
 });
 it("rejects duplicates and time reversal",()=>{
   const ledger=simulateLearningCycle([],p,o,"e1");
   expect(()=>appendLearningEvent(ledger,p)).toThrow("duplicate_event");
   expect(()=>appendLearningEvent(ledger,{...p,id:"p2",tick:0})).toThrow("nonmonotonic_tick");
 });
 it("does not equate different contexts",()=>{
   expect(evaluateLearning(p,{...o,contextId:"other"}).result).toBe("review_required");
 });
 it("rejects mismatched evaluation claims",()=>{
   const ledger=appendLearningEvent(appendLearningEvent([],p),o);
   expect(()=>appendLearningEvent(ledger,{type:"evaluation",id:"e1",actorId:"npc-1",predictionId:"p1",observationId:"o1",deviation:0,result:"within_tolerance",reasons:[],tick:2})).toThrow("evaluation_mismatch");
 });
 it("rejects unlinked observations",()=>{
   expect(()=>appendLearningEvent([] ,o)).toThrow("invalid_observation");
 });
 it("keeps normal predictions within tolerance",()=>{
   expect(evaluateLearning(p,{...o,measured:11}).result).toBe("within_tolerance");
 });
});
