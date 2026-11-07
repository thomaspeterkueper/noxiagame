/** Sundern developmental cohort v0.1. Planning-only: no DB writes or live spawning. */
export type FamilyPilot = Readonly<{
 id:string; district:string; adults:readonly string[]; children:readonly {id:string; ageMonths:number}[];
 setting:"multilingual"|"musical"|"craft"|"intergenerational"|"nature";
 languages:readonly string[]; interests:readonly string[];
}>;
export const SUNDERN_FAMILIES:readonly FamilyPilot[]=Object.freeze([
 {id:"sundern-family-01",district:"Sundern",adults:["s01-a","s01-b"],children:[{id:"s01-c",ageMonths:0}],setting:"multilingual",languages:["de","vi"],interests:["cooking","stories"]},
 {id:"sundern-family-02",district:"Sundern",adults:["s02-a","s02-b"],children:[{id:"s02-c",ageMonths:6}],setting:"musical",languages:["de"],interests:["music","dance"]},
 {id:"sundern-family-03",district:"Sundern",adults:["s03-a","s03-b"],children:[{id:"s03-c",ageMonths:18}],setting:"craft",languages:["de"],interests:["making","repair"]},
 {id:"sundern-family-04",district:"Sundern",adults:["s04-a","s04-b","s04-grandparent"],children:[{id:"s04-c",ageMonths:30}],setting:"intergenerational",languages:["de"],interests:["memory","gardening"]},
 {id:"sundern-family-05",district:"Sundern",adults:["s05-a","s05-b"],children:[{id:"s05-c",ageMonths:48}],setting:"nature",languages:["de"],interests:["forest","animals"]},
]);
export type PilotPlan = Readonly<{location:"Sundern"; cohortId:string; families:readonly FamilyPilot[]; totalActors:number; enabled:false; persist:false; liveSpawn:false}>;
export function createSundernPilotPlan():PilotPlan {
 const actorIds=SUNDERN_FAMILIES.flatMap(f=>[...f.adults,...f.children.map(c=>c.id)]);
 if (new Set(actorIds).size!==actorIds.length) throw new Error("duplicate_actor_id");
 if (SUNDERN_FAMILIES.length!==5 || SUNDERN_FAMILIES.some(f=>f.children.some(c=>!Number.isSafeInteger(c.ageMonths)||c.ageMonths<0))) throw new Error("invalid_cohort");
 return {location:"Sundern",cohortId:"sundern-ontogenesis-v0.1",families:SUNDERN_FAMILIES,totalActors:actorIds.length,enabled:false,persist:false,liveSpawn:false};
}
