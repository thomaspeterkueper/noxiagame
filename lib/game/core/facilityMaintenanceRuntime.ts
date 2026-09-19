import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { advanceFacilityMaintenance, type FacilityMaintenanceState, type FacilityOperationLoad } from './facilityMaintenance'

export async function advanceFacilityMaintenanceCommand(input: {
  tick: number
  tileEntityId: string
  load: FacilityOperationLoad
}): Promise<FacilityMaintenanceState> {
  const supabase = createServiceClient()
  const { data: tile, error: tileError } = await supabase.from('tile_entities')
    .select('id,status').eq('id', input.tileEntityId).eq('entity_type', 'building').maybeSingle()
  if (tileError) throw tileError
  if (!tile || tile.status !== 'active') throw new Error('Facility must be an active building')

  const { data: row, error } = await supabase.from('facility_maintenance_state')
    .select('*').eq('tile_entity_id', input.tileEntityId).maybeSingle()
  if (error) throw error

  const current: FacilityMaintenanceState = row ? {
    tileEntityId: row.tile_entity_id,
    condition: Number(row.condition),
    wear: Number(row.wear),
    maintenanceDue: Boolean(row.maintenance_due),
    lastServiceTick: row.last_service_tick ?? null,
    updatedTick: row.updated_tick ?? null,
  } : { tileEntityId: input.tileEntityId, condition: 1, wear: 0, maintenanceDue: false, lastServiceTick: null, updatedTick: null }

  if (current.updatedTick != null && input.tick <= current.updatedTick) return current
  const next = advanceFacilityMaintenance(current, input.load, input.tick)
  const { error: saveError } = await supabase.from('facility_maintenance_state').upsert({
    tile_entity_id: input.tileEntityId,
    condition: next.condition,
    wear: next.wear,
    maintenance_due: next.maintenanceDue,
    last_service_tick: next.lastServiceTick,
    updated_tick: input.tick,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tile_entity_id' })
  if (saveError) throw saveError
  return next
}
