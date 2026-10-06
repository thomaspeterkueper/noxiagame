import { describe, expect, it } from "vitest";
import { observable, runAcce001 } from "./acce001";

describe("ACCE-001 AVI core closure reference experiment", () => {
  it("has a valid null case: equal complete states produce equal observables", () => {
    const state = { x: 10, h: -2 };
    expect(observable(state)).toBe(observable({ ...state }));
  });

  it("produces an apparent closure defect when the standard hidden carrier is omitted", () => {
    const result = runAcce001();
    expect(result.qA).toBe(8);
    expect(result.qB).toBe(12);
    expect(result.reducedClosureDefect).toBe(4);
  });

  it("restores closure when the hidden standard state is included", () => {
    const result = runAcce001();
    expect(result.fullClosureDefect).toBe(0);
    expect(result.extensionAdmissible).toBe(false);
    expect(result.evidenceLabel).toBe("SIMULATION_EVIDENCE");
  });
});
