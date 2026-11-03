import { describe, expect, it } from "vitest";
import { resolveAffordances, type EntityState } from "./affordances";

const truck: EntityState = {
  id: "truck-1", properties: {
    cargoCapacityKg: 12000, batteryCapacityKWh: 480, chargeKWh: 250, dischargePowerKW: 350
  }, connectedTo: ["depot-grid"]
};
const get = (context: Parameters<typeof resolveAffordances>[1] = {}) => resolveAffordances(truck, context);
describe("emergent affordances", () => {
  it("derives transport and storage from physical attributes", () => {
    expect(get().find(x => x.capability === "transport")?.available).toBe(true);
    expect(get().find(x => x.capability === "energy_storage")?.maximum).toBe(480);
  });
  it("does not invent grid supply without infrastructure", () => {
    expect(get().find(x => x.capability === "energy_supply")?.available).toBe(false);
  });
  it("supplies grid only under required conditions", () => {
    expect(get({gridId:"depot-grid", chargingInfrastructure:true, requestedEnergyKWh:200}).find(x => x.capability === "energy_supply")?.available).toBe(true);
  });
  it("blocks unavailable energy quantities", () => {
    expect(get({gridId:"depot-grid", chargingInfrastructure:true, requestedEnergyKWh:300}).find(x => x.capability === "energy_supply")?.available).toBe(false);
  });
  it("blocks overcapacity cargo", () => {
    expect(get({requestedCargoKg:13000}).find(x => x.capability === "transport")?.available).toBe(false);
  });
  it("never exposes actions on disabled entities", () => {
    expect(resolveAffordances({...truck,enabled:false},{gridId:"depot-grid",chargingInfrastructure:true}).every(x => !x.available)).toBe(true);
  });
  it("supports sensors and computing independent of entity type", () => {
    const node: EntityState = {id:"node",properties:{sensorKinds:["no2"],computeUnits:4}};
    expect(resolveAffordances(node,{requireSensor:"no2"}).filter(x=>x.available).map(x=>x.capability)).toEqual(["sensing","compute"]);
  });
  it("rejects nonfinite resource values", () => {
    const invalid: EntityState = {id:"invalid",properties:{batteryCapacityKWh:Infinity,chargeKWh:NaN,dischargePowerKW:100},connectedTo:["grid"]};
    expect(resolveAffordances(invalid,{gridId:"grid",chargingInfrastructure:true}).every(x=>!x.available)).toBe(true);
  });
});
