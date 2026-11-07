import {describe,it,expect} from "vitest";
import {createSundernPilotPlan,SUNDERN_FAMILIES} from "./sundernFamilyPilot";
describe("Sundern family pilot",()=>{
 it("contains five families",()=>expect(SUNDERN_FAMILIES).toHaveLength(5));
 it("uses distinct actor ids",()=>{
  const actors=SUNDERN_FAMILIES.flatMap(f=>[...f.adults,...f.children.map(c=>c.id)]);
  expect(new Set(actors).size).toBe(actors.length);
  expect(createSundernPilotPlan().totalActors).toBe(actors.length);
 });
 it("starts without persistence or live spawning",()=>{
  expect(createSundernPilotPlan()).toMatchObject({enabled:false,persist:false,liveSpawn:false});
 });
 it("includes different ages and settings",()=>{
  expect(new Set(SUNDERN_FAMILIES.map(f=>f.setting)).size).toBe(5);
  expect(new Set(SUNDERN_FAMILIES.flatMap(f=>f.children.map(c=>c.ageMonths))).size).toBe(5);
 });
});
