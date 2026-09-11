import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type LogisticsDomain = 'surface' | 'surface_to_orbit' | 'orbit' | 'inter_node'
export type LogisticsInventoryKind = 'location' | 'facility' | 'depot' | 'surface_port' | 'vehicle' | 'station'
export type LogisticsStorageKind = 'native' | 'location_resources' | 'ship_cargo'
export type TransportJobStatus =
  | 'reserved'
  | 'loading'
  | 'in_transit'
  | 'arrived'
  | 'unloading'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type LogisticsInventoryItem = {
  resource: string
  label?: string | null
  unit?: string | null
  amount: number
  reservedOutbound: number
  available: number
}

export type LogisticsInventorySnapshot = {
  id: string
  owner_profile_id: string | null
  location_id: string | null
  inventory_kind: LogisticsInventoryKind
  storage_kind: LogisticsStorageKind
  subject_type: string
  subject_id: string | null
  label: string
  capacity: number | null
  public_deposit: boolean
  public_withdraw: boolean
  active: boolean
  metadata: Record<string, unknown>
  totalAmount: number
  items: LogisticsInventoryItem[]
}

export type CargoTransferResult = {
  commandId: string
  sourceInventoryId: string
  targetInventoryId: string
  resource: string
  amount: number
  sourceAmount: number
  targetAmount: number
  idempotent: boolean
}

export type TransportJobResult = {
  id: string
  command_id: string
  actor_profile_id: string
  location_id: string | null
  domain: LogisticsDomain
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  vehicle_role: string | null
  resource: string
  amount: number
  status: TransportJobStatus
  route_snapshot: Record<string, unknown>
  created_at: string
  started_at: string | null
  arrives_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  failure_code: string | null
  updated_at: string
  idempotent: boolean
}

function logisticsError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function inventorySnapshotCommand(inventoryId: string): Promise<LogisticsInventorySnapshot> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_inventory_snapshot', {
    p_inventory_id: inventoryId,
  })
  if (error) throw logisticsError('noxia_inventory_snapshot', error)
  return data as LogisticsInventorySnapshot
}

export async function transferCargoCommand(input: {
  commandId: string
  profileId: string
  sourceInventoryId: string
  targetInventoryId: string
  resource: string
  amount: number
}): Promise<CargoTransferResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_transfer_cargo', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.profileId,
    p_source_inventory_id: input.sourceInventoryId,
    p_target_inventory_id: input.targetInventoryId,
    p_resource: input.resource,
    p_amount: input.amount,
  })
  if (error) throw logisticsError('noxia_transfer_cargo', error)
  return data as CargoTransferResult
}

export async function createTransportJobCommand(input: {
  commandId: string
  profileId: string
  locationId?: string | null
  domain: LogisticsDomain
  sourceInventoryId: string
  destinationInventoryId: string
  vehicleInventoryId?: string | null
  vehicleRole?: string | null
  resource: string
  amount: number
  routeSnapshot?: Record<string, unknown>
}): Promise<TransportJobResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_create_transport_job', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.profileId,
    p_location_id: input.locationId ?? null,
    p_domain: input.domain,
    p_source_inventory_id: input.sourceInventoryId,
    p_destination_inventory_id: input.destinationInventoryId,
    p_vehicle_inventory_id: input.vehicleInventoryId ?? null,
    p_vehicle_role: input.vehicleRole ?? null,
    p_resource: input.resource,
    p_amount: input.amount,
    p_route_snapshot: input.routeSnapshot ?? {},
  })
  if (error) throw logisticsError('noxia_create_transport_job', error)
  return data as TransportJobResult
}

async function transportJobStateCommand(
  rpc: 'noxia_start_transport_job' | 'noxia_arrive_transport_job' | 'noxia_complete_transport_job' | 'noxia_cancel_transport_job',
  jobId: string,
  profileId: string,
): Promise<TransportJobResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc(rpc, {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw logisticsError(rpc, error)
  return data as TransportJobResult
}

export function startTransportJobCommand(jobId: string, profileId: string) {
  return transportJobStateCommand('noxia_start_transport_job', jobId, profileId)
}

export function arriveTransportJobCommand(jobId: string, profileId: string) {
  return transportJobStateCommand('noxia_arrive_transport_job', jobId, profileId)
}

export function completeTransportJobCommand(jobId: string, profileId: string) {
  return transportJobStateCommand('noxia_complete_transport_job', jobId, profileId)
}

export function cancelTransportJobCommand(jobId: string, profileId: string) {
  return transportJobStateCommand('noxia_cancel_transport_job', jobId, profileId)
}
