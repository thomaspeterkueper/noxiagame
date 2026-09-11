import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { VehicleInstance, VehicleOperationalStatus } from '@/lib/game/vehicles'

export type PersistedVehicleInstance = {
  id: string
  canonical_key: string | null
  frame_id: string
  label: string
  owner_profile_id: string | null
  location_id: string | null
  current_node_inventory_id: string | null
  status: VehicleOperationalStatus
  condition: number
  wear: number
  cargo_capacity_t: number
  energy: VehicleInstance['energy']
  crew_ids: string[]
  modules: VehicleInstance['modules']
  modifications: VehicleInstance['modifications']
  emergent_state: VehicleInstance['emergentState']
  created_at: string
  updated_at: string
}

export type VehicleInstanceSnapshot = {
  vehicle: PersistedVehicleInstance
  inventory: Record<string, unknown> | null
  activeTransportJob: Record<string, unknown> | null
}

function coreError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export function projectPersistedVehicle(row: PersistedVehicleInstance): VehicleInstance {
  return {
    id: row.id,
    frameId: row.frame_id,
    ownerId: row.owner_profile_id,
    locationId: row.location_id,
    status: row.status,
    condition: row.condition,
    wear: row.wear,
    energy: Array.isArray(row.energy) ? row.energy : [],
    // Cargo is authoritative in the linked logistics inventory and is therefore
    // populated by snapshots/consumers rather than duplicated on vehicle_instances.
    cargo: [],
    crewIds: Array.isArray(row.crew_ids) ? row.crew_ids : [],
    modules: Array.isArray(row.modules) ? row.modules : [],
    modifications: row.modifications ?? {},
    emergentState: row.emergent_state ?? {},
  }
}

export async function listPlayerVehicleInstances(
  profileId: string,
  locationId?: string | null,
): Promise<PersistedVehicleInstance[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('vehicle_instances')
    .select('*')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: true })
    .limit(250)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) throw coreError('vehicle instance query', error)
  return (data ?? []) as unknown as PersistedVehicleInstance[]
}

export async function getPlayerVehicleSnapshot(
  profileId: string,
  vehicleId: string,
): Promise<VehicleInstanceSnapshot | null> {
  const supabase = createServiceClient()
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicle_instances')
    .select('id,owner_profile_id')
    .eq('id', vehicleId)
    .maybeSingle()

  if (vehicleError) throw coreError('vehicle instance lookup', vehicleError)
  if (!vehicle) return null
  if (vehicle.owner_profile_id !== profileId) throw new Error('NOXIA_VEHICLE_FORBIDDEN')

  const { data, error } = await supabase.rpc('noxia_vehicle_snapshot', {
    p_vehicle_id: vehicleId,
  })
  if (error) throw coreError('noxia_vehicle_snapshot', error)
  return data as unknown as VehicleInstanceSnapshot
}

/**
 * Server-side creation command for purchase/build/reward flows. There is deliberately
 * no public spawn API: a gameplay system must decide when a vehicle is earned/built.
 */
export async function createVehicleInstanceCommand(input: {
  frameId: string
  label: string
  ownerProfileId: string | null
  locationId: string | null
  cargoCapacityT: number
  currentNodeInventoryId?: string | null
  canonicalKey?: string | null
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_create_vehicle_instance', {
    p_frame_id: input.frameId,
    p_label: input.label,
    p_owner_profile_id: input.ownerProfileId,
    p_location_id: input.locationId,
    p_cargo_capacity_t: input.cargoCapacityT,
    p_current_node_inventory_id: input.currentNodeInventoryId ?? null,
    p_canonical_key: input.canonicalKey ?? null,
  })
  if (error) throw coreError('noxia_create_vehicle_instance', error)
  return data
}
