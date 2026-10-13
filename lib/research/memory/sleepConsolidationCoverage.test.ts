import {describe,it,expect} from "vitest";
import {simulateGlobalLimit,coverageByPerson,syntheticStarvationFixture} from "./sleepConsolidationCoverage";
describe("global sleep-consolidation limit coverage",()=>{
 it("reproduces starvation under shared 512 row limit",()=>{
  const rows=syntheticStarvationFixture(),selected=simulateGlobalLimit(rows);
  expect(rows).toHaveLength(600);expect(selected).toHaveLength(512);
  expect(coverageByPerson(rows,selected,["A","B"])).toEqual([
   {personId:"A",available:550,selected:512},
   {personId:"B",available:50,selected:0}
  ]);
 });
 it("does not mutate its input",()=>{
  const rows=syntheticStarvationFixture(),first=rows[0];
  simulateGlobalLimit(rows);expect(rows[0]).toBe(first);
 });
});
