import {describe,it,expect} from "vitest";
import {previewSundernProvisioning} from "./sundernProvisioningPreview";
const location="11111111-1111-4111-8111-111111111111";
describe("Sundern provisioning preview",()=>{
 it("maps 16 NPC people without writing",()=>{
  const plan=previewSundernProvisioning(location,2026);
  expect(plan.people).toHaveLength(16);
  expect(plan.execute).toBe(false);
  expect(plan.requiresCoreIntegration).toBe(true);
 });
 it("uses the canonical people columns",()=>{
  expect(previewSundernProvisioning(location,2026).people[0].record).toMatchObject({current_location_id:location,simulation_tier:"background",activity_state:"idle"});
 });
 it("rejects non-UUID place names",()=>expect(()=>previewSundernProvisioning("Sundern",2026)).toThrow());
 it("rejects invalid simulation years",()=>expect(()=>previewSundernProvisioning(location,0)).toThrow());
});
