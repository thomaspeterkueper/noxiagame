import {describe,it,expect} from "vitest";
import {compareMemoryRegimes} from "./valueBenchmark";
describe("synthetic memory value benchmark",()=>{
 it("is deterministic and read-only",()=>expect(compareMemoryRegimes()).toEqual(compareMemoryRegimes()));
 it("compression reduces storage without losing these held-out outcomes",()=>{
  const [full,compressed]=compareMemoryRegimes();
  expect(compressed.bytes).toBeLessThan(full.bytes);
  expect(compressed.mae).toBe(full.mae);
 });
 it("reveals a failure of naive selective memory",()=>{
  const [full,,selective]=compareMemoryRegimes();
  expect(selective.mae).toBeGreaterThan(full.mae);
  expect(selective.criticalRecall).toBe(1);
  expect(selective.anchorRecall).toBe(1);
 });
});
