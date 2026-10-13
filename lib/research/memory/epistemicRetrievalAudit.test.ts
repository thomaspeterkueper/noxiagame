import {describe,it,expect} from "vitest";
import {retrieveEpistemicTraces} from "./epistemicRetrievalAudit";
import type {PersistedEpistemicTrace} from "../../game/cognition/personEpistemicPersistence";
const trace=(id:string,person_id:string,observed_tick:number,value:string):PersistedEpistemicTrace=>({
 id,person_id,observed_tick,value,subject_ref:"cafe",attribute:"open",source_type:"person",source_ref:"speaker",modality:"reported",provenance_refs:["conversation:1"],confidence:.5,salience:.3,trace_kind:"observation"
});
describe("read-only epistemic retrieval",()=>{
 const rows=[trace("old","a",1,"yes"),trace("new","a",3,"no"),trace("other","b",2,"yes")];
 it("isolates person and time",()=>{
  const r=retrieveEpistemicTraces(rows,{personId:"a",subjectRef:"cafe",attribute:"open",atTick:2,limit:5});
  expect(r.rows.map(x=>x.id)).toEqual(["old"]);expect(r.metrics.scanned).toBe(3);
 });
 it("keeps conflicting evidence with provenance instead of declaring truth",()=>{
  const r=retrieveEpistemicTraces(rows,{personId:"a",subjectRef:"cafe",attribute:"open",atTick:3,limit:5});
  expect(r.rows.map(x=>x.value)).toEqual(["no","yes"]);
  expect(r.rows[0].provenance_refs).toEqual(["conversation:1"]);
 });
 it("enforces limit and rejects invalid bounds",()=>{
  expect(retrieveEpistemicTraces(rows,{personId:"a",subjectRef:"cafe",attribute:"open",atTick:3,limit:1}).rows).toHaveLength(1);
  expect(()=>retrieveEpistemicTraces(rows,{personId:"a",subjectRef:"cafe",attribute:"open",atTick:3,limit:0})).toThrow();
 });
});
