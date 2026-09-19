import type { FacilityOutputCreditResult } from './facilityProduction'
import { projectFacilityOperation, type FacilityMaintenanceState } from './facilityMaintenance'

type SupabaseLike = any

export interface FacilityWearPolicy {
  wearRatePerUnit: number
  nominalOutput: number
}

export function operationFromProduction(
  outputAmount: number,
  policy: FacilityWearPolicy,
): { wearRate: number; load: number } {
  const nominal = Math.max(policy.nominalOutput, 0.000001)
  return {
    wearRate: Math.max(0, policy.wearRatePerUnit) * Math.max(0, outputAmount),
    load: Math.min(1, Math.max(0, outputAmount) / nominal),
  }
}

export async function projectProductionWear(
  supabase: SupabaseLike,
  output: FacilityOutputCreditResult,
  policy: FacilityWearPolicy,
): Promise<FacilityMaintenanceState> {
  const { data: existing, error } = await supabase.from('facility_maintenance')
    .select('*').eq('tile_entity_id', output.tileEntityId).maybeSingle()
  if (error) throw error

  const current: FacilityMaintenanceState = existing ? {
    tileEntityId: existing.tile_entity_id,
    condition: Number(existing.condition),
    wear: Number(existing.wear),
    maintenanceDue: Boolean(existing.maintenance_due),
    lastMaintainedTick: existing.last_maintained_tick ?? null,
    updatedTick: existing.updated_tick ?? null,
  } : {
    tileEntityId: output.tileEntityId,
    condition: 1,
    wear: 0,
    maintenanceDue: false,
    lastMaintainedTick: null,
    updatedTick: null,
  }

  // The output RPC is idempotent. Replaying the same credited tick must not add wear again.
  if (current.updatedTick === output.tickNumber || output.idempotent) return current

  const next = projectFacilityOperation(current, operationFromProduction(output.amount, policy), output.tickNumber)
  const { error: upsertError } = await supabase.from('facility_maintenance').upsert({
    tile_entity_id: next.tileEntityId,
    condition: next.condition,
    wear: next.wear,
    maintenance_due: next.maintenanceDue,
    last_maintained_tick: next.lastMaintainedTick,
    updated_tick: next.updatedTick,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tile_entity_id' })
  if (upsertError) throw upsertError
  return next
}
