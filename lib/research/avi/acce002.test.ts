import { describe, expect, it } from "vitest";
import { ACCE002_LAYERS, runAcce002 } from "./acce002";

describe("ACCE-002 layered standard-state diagnosis", () => {
  it("creates one diagnostic case for each standard-state layer", () => {
    expect(runAcce002().map((r) => r.omittedLayer)).toEqual([...ACCE002_LAYERS]);
  });

  it("identifies the actually omitted carrier class", () => {
    for (const result of runAcce002()) {
      expect(result.reducedClosureDefect).toBeGreaterThan(0);
      expect(result.diagnosedLayer).toBe(result.omittedLayer);
    }
  });

  it("restores closure before admitting an ontology extension", () => {
    for (const result of runAcce002()) {
      expect(result.recoveredClosureDefect).toBe(0);
      expect(result.extensionAdmissible).toBe(false);
    }
  });
});
