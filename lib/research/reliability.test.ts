import { describe, expect, it } from "vitest";
import { summarizeReliability } from "./reliability";
const sample = {source:"synthetic-fixture",level:"synthetic" as const,trials:100,successes:90,operatingEnvelope:"bench-simulation"};
describe("reliability evidence",()=>{
  it("reports observed success and bounded Wilson interval",()=>{
    const r=summarizeReliability([sample]);
    expect(r.observedRate).toBe(.9);
    expect(r.wilson95[0]).toBeGreaterThan(0);
    expect(r.wilson95[1]).toBeLessThan(1);
    expect(r.evidenceLevels).toEqual(["synthetic"]);
  });
  it("rejects missing provenance",()=>expect(()=>summarizeReliability([{...sample,source:""}])).toThrow());
  it("rejects impossible counts",()=>expect(()=>summarizeReliability([{...sample,successes:101}])).toThrow());
  it("rejects empty datasets",()=>expect(()=>summarizeReliability([])).toThrow());
});
