import { describe, it, expect } from "vitest";
import { assessSundernDailyLife, SUNDERN_NEEDS } from "./sundernDailyLifeReadiness";
import { SUNDERN_FAMILIES } from "./sundernFamilyPilot";
describe("Sundern daily life readiness", () => {
  it("does not mark unknown households ready", () => {
    const results = assessSundernDailyLife([]);
    expect(results).toHaveLength(5);
    expect(results.every(r => !r.ready && r.missing.includes("housing"))).toBe(true);
  });
  it("requires verified housing and all daily needs", () => {
    const needs = Object.fromEntries(SUNDERN_NEEDS.map(n => [n, "verified"])) as any;
    const familyId = SUNDERN_FAMILIES[0].id;
    expect(assessSundernDailyLife([{ familyId, homeId: "home-1", homeVerified: true, needs }])[0].ready).toBe(true);
    expect(assessSundernDailyLife([{ familyId, homeId: "home-1", homeVerified: false, needs }])[0].ready).toBe(false);
  });
  it("rejects duplicate family evidence", () => {
    const record = { familyId: SUNDERN_FAMILIES[0].id, homeVerified: false, needs: {} };
    expect(() => assessSundernDailyLife([record, record])).toThrow("duplicate_family");
  });
});
