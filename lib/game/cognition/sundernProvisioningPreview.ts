/** Dry-run bridge to the existing people/person_assignments schema.
 * Caller must resolve an actual Sundern locations.id; no writes are executed.
 */
import {createSundernPilotPlan} from "./sundernFamilyPilot";
export type PersonInsert=Readonly<{display_name:string;birth_year:number;current_location_id:string;simulation_tier:"background";activity_state:"idle"}>;
export type SundernProvisioningPreview=Readonly<{cohortId:string;locationId:string;people:readonly Readonly<{pilotId:string;record:PersonInsert}>[];requiresLocationVerification:true;requiresCoreIntegration:true;execute:false}>;
export function previewSundernProvisioning(locationId:string,simulationYear:number):SundernProvisioningPreview {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(locationId)) throw new Error("verified_location_uuid_required");
 if(!Number.isSafeInteger(simulationYear)||simulationYear<1900||simulationYear>3000) throw new Error("invalid_simulation_year");
 const plan=createSundernPilotPlan();
 const people=plan.families.flatMap(f=>[
  ...f.adults.map((id,i)=>({pilotId:id,record:{display_name:`Pilot ${id}`,birth_year:simulationYear-(i===2?68:35),current_location_id:locationId,simulation_tier:"background" as const,activity_state:"idle" as const}})),
  ...f.children.map(c=>({pilotId:c.id,record:{display_name:`Pilot ${c.id}`,birth_year:simulationYear-Math.floor(c.ageMonths/12),current_location_id:locationId,simulation_tier:"background" as const,activity_state:"idle" as const}})),
 ]);
 return {cohortId:plan.cohortId,locationId,people,requiresLocationVerification:true,requiresCoreIntegration:true,execute:false};
}
