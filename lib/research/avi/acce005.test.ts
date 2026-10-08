import {describe,expect,it} from "vitest";
import {ACCE005_SEED,ACCE005_Z_THRESHOLD,posteriorPredictive,runAcce005} from "./acce005";
describe("ACCE-005 uncertainty-aware closure gate",()=>{
 it("propagates state and measurement uncertainty",()=>{expect(posteriorPredictive({mean:10,variance:4},1)).toEqual({mean:10,variance:5});});
 it("removes a false point-estimate anomaly",()=>{const r=runAcce005()[0];expect(r.seed).toBe(ACCE005_SEED);expect(r.pointEstimateZ).toBeGreaterThanOrEqual(ACCE005_Z_THRESHOLD);expect(r.posteriorPredictiveZ).toBeLessThan(ACCE005_Z_THRESHOLD);expect(r.status).toBe("STANDARD_CLOSURE");expect(r.extensionAdmissible).toBe(false);});
 it("labels a surviving residual unresolved rather than AVI",()=>{const r=runAcce005()[1];expect(r.posteriorPredictiveZ).toBeGreaterThanOrEqual(ACCE005_Z_THRESHOLD);expect(r.status).toBe("UNRESOLVED_CLOSURE_DEFECT");expect(r.nextGate).toBe("AUDIT_E1_E2");expect(r.extensionAdmissible).toBe(false);});
});
