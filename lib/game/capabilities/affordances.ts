/** Pure, deterministic affordance resolver. No inventory, credit or DB mutations. */
export type Capability = "transport" | "energy_supply" | "energy_storage" | "sensing" | "compute";
export type EntityState = {
  id: string;
  properties: { cargoCapacityKg?: number; batteryCapacityKWh?: number; chargeKWh?: number; dischargePowerKW?: number; sensorKinds?: readonly string[]; computeUnits?: number };
  connectedTo?: readonly string[];
  enabled?: boolean;
};
export type Context = {
  gridId?: string;
  chargingInfrastructure?: boolean;
  requestedCargoKg?: number;
  requestedEnergyKWh?: number;
  requireSensor?: string;
};
export type Affordance = { capability: Capability; entityId: string; available: boolean; reasons: readonly string[]; maximum?: number };
const valid = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
export function resolveAffordances(entity: EntityState, context: Context = {}): Affordance[] {
  const p = entity.properties;
  const active = entity.enabled !== false;
  const result: Affordance[] = [];
  const push = (capability: Capability, available: boolean, reasons: string[], maximum?: number) =>
    result.push({ capability, entityId: entity.id, available: active && available, reasons: !active ? ["entity_disabled", ...reasons] : reasons, ...(maximum === undefined ? {} : { maximum }) });
  if (p.cargoCapacityKg !== undefined) {
    const capacity = valid(p.cargoCapacityKg) ? p.cargoCapacityKg : 0;
    push("transport", capacity > 0 && (!valid(context.requestedCargoKg) || context.requestedCargoKg <= capacity),
      capacity <= 0 ? ["invalid_capacity"] : valid(context.requestedCargoKg) && context.requestedCargoKg > capacity ? ["insufficient_capacity"] : [], capacity);
  }
  if (p.batteryCapacityKWh !== undefined || p.chargeKWh !== undefined) {
    const capacity = valid(p.batteryCapacityKWh) ? p.batteryCapacityKWh : 0;
    const charge = valid(p.chargeKWh) && p.chargeKWh <= capacity ? p.chargeKWh : 0;
    push("energy_storage", capacity > 0, capacity > 0 ? [] : ["invalid_battery_capacity"], capacity);
    const connected = !!context.gridId && (entity.connectedTo ?? []).includes(context.gridId);
    const power = valid(p.dischargePowerKW) ? p.dischargePowerKW : 0;
    const amountOK = context.requestedEnergyKWh === undefined || (valid(context.requestedEnergyKWh) && context.requestedEnergyKWh <= charge);
    push("energy_supply", connected && context.chargingInfrastructure === true && power > 0 && charge > 0 && amountOK,
      [!connected && "grid_not_connected", context.chargingInfrastructure !== true && "bidirectional_interface_missing",
        power <= 0 && "discharge_power_unavailable", charge <= 0 && "battery_empty", !amountOK && "insufficient_charge"].filter((x): x is string => !!x),
      Math.min(charge, capacity));
  }
  if (p.sensorKinds !== undefined) {
    const kinds = p.sensorKinds;
    const ok = kinds.length > 0 && (!context.requireSensor || kinds.includes(context.requireSensor));
    push("sensing", ok, ok ? [] : ["sensor_unavailable"], kinds.length);
  }
  if (p.computeUnits !== undefined) {
    const units = valid(p.computeUnits) ? p.computeUnits : 0;
    push("compute", units > 0, units > 0 ? [] : ["compute_unavailable"], units);
  }
  return result;
}
