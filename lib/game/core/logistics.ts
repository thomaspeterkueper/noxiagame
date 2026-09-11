import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export const LOGISTICS_RESOURCES = ['water', 'energy', 'metal', 'components'] as const
export type LogisticsResource = typeof LOGISTICS_RESOURCES[number]

export const TRANSPORT_DOMAINS = ['surface', 'surface_to_orbit', 'orbit', 'inter_node'] as const
export type TransportDomain = typeof TRANSPORT_DOMAINS[number]

export const TRANSPORT_STATUSES = [
  'reserved',
  'loading',
  'in_transit',
  'arrived',
  'unloading',
  'completed',
  'cancelled',
  'failed',
] as const
export type TransportStatus = typeof TRANSPORT_STATUSES[number]

export type RouteSnapshot = Record<string, unknown>

export type LogisticsInventory = {
  id: string
  owner_profile_id: string | null
  location_id: string | null
  inventory_kind: 'location' | 'facility' | 'depot' | 'surface_port' | 'vehicle' | 'station'
  storage_kind: 'native' | 'location_resources' | 'ship_cargo'
  subject_type: string
  subject_id: string | null
  label: string
  capacity: number | null
  public_deposit: boolean
  public_withdraw: boolean
  active: boolean
  metadata: Record<string, unknown>
}

export type TransportJob = {
  id: string
  command_id: string
  actor_profile_id: string
  location_id: string | null
  domain: TransportDomain
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  vehicle_role: string | null
  resource: LogisticsResource
  amount: number
  status: TransportStatus
  route_snapshot: RouteSnapshot
  created_at: string
  started_at: string | null
  arrives_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  failure_code: string | null
  updated_at: string
}

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

function canReadInventory(profileId: string, inventory: Pick<LogisticsInventory, 'owner_profile_id' | 'public_deposit' | 'public_withdraw' | 'active'>) {
  return inventory.active && (
    inventory.owner_profile_id === profileId
    || inventory.public_deposit
    || inventory.public_withdraw
  )
}

export function routeEtaSeconds(snapshot: RouteSnapshot | null | undefined): number | null {
  if (!snapshot) return null
  const raw = snapshot.etaSeconds
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^\d+$/.test(raw)
      ? Number(raw)
      : Number.NaN
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.max(1, Math.round(value))
}

export async function listAccessibleInventories(profileId: string, locationId?: string | null): Promise<LogisticsInventory[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('logistics_inventories')
    .select('id,owner_profile_id,location_id,inventory_kind,storage_kind,subject_type,subject_id,label,capacity,public_deposit,public_withdraw,active,metadata')
    .eq('active', true)
    .or(`owner_profile_id.eq.${profileId},public_deposit.eq.true,public_withdraw.eq.true`)
    .order('inventory_kind')
    .order('label')
    .limit(250)

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query
  if (error) throw commandError('logistics inventory query', error)
  return (data ?? []) as unknown as LogisticsInventory[]
}

export async function getAccessibleInventorySnapshot(profileId: string, inventoryId: string) {
  const supabase = createServiceClient()
  const { data: inventory, error: inventoryError } = await supabase
    .from('logistics_inventories')
    .select('id,owner_profile_id,public_deposit,public_withdraw,active')
    .eq('id', inventoryId)
    .maybeSingle()

  if (inventoryError) throw commandError('logistics inventory lookup', inventoryError)
  if (!inventory) throw new Error('NOXIA_INVENTORY_NOT_FOUND')
  if (!canReadInventory(profileId, inventory as any)) throw new Error('NOXIA_INVENTORY_FORBIDDEN')

  const { data, error } = await supabase.rpc('noxia_inventory_snapshot', {
    p_inventory_id: inventoryId,
  })
  if (error) throw commandError('noxia_inventory_snapshot', error)
  return data
}

export async function listPlayerTransportJobs(
  profileId: string,
  options: { status?: TransportStatus | null; locationId?: string | null; limit?: number } = {},
): Promise<TransportJob[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('transport_jobs')
    .select('*')
    .eq('actor_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 250))

  if (options.status) query = query.eq('status', options.status)
  if (options.locationId) query = query.eq('location_id', options.locationId)

  const { data, error } = await query
  if (error) throw commandError('transport job query', error)
  return (data ?? []) as unknown as TransportJob[]
}

export async function getPlayerTransportJob(profileId: string, jobId: string): Promise<TransportJob | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('transport_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('actor_profile_id', profileId)
    .maybeSingle()
  if (error) throw commandError('transport job lookup', error)
  return data as unknown as TransportJob | null
}

export async function transferCargo(input: {
  commandId: string
  actorProfileId: string
  sourceInventoryId: string
  targetInventoryId: string
  resource: LogisticsResource
  amount: number
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_transfer_cargo', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_source_inventory_id: input.sourceInventoryId,
    p_target_inventory_id: input.targetInventoryId,
    p_resource: input.resource,
    p_amount: input.amount,
  })
  if (error) throw commandError('noxia_transfer_cargo', error)
  return data
}

export async function createTransportJob(input: {
  commandId: string
  actorProfileId: string
  locationId?: string | null
  domain: TransportDomain
  sourceInventoryId: string
  destinationInventoryId: string
  vehicleInventoryId?: string | null
  vehicleRole?: string | null
  resource: LogisticsResource
  amount: number
  routeSnapshot?: RouteSnapshot
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_create_transport_job', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
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
  if (error) throw commandError('noxia_create_transport_job', error)
  return data
}

export async function beginLoadingTransportJob(profileId: string, jobId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_begin_loading_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_begin_loading_transport_job', error)
  return data
}

export async function startTransportJob(profileId: string, jobId: string) {
  const job = await getPlayerTransportJob(profileId, jobId)
  if (!job) throw new Error('NOXIA_TRANSPORT_JOB_NOT_FOUND')

  // The DB state machine derives arrives_at exclusively from route_snapshot.etaSeconds.
  // Refuse a start without a finite ETA rather than creating an immortal in_transit job.
  if ((job.status === 'reserved' || job.status === 'loading') && routeEtaSeconds(job.route_snapshot) == null) {
    throw new Error('NOXIA_TRANSPORT_ROUTE_ETA_REQUIRED')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_start_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_start_transport_job', error)
  return data
}

export async function arriveTransportJob(profileId: string, jobId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_arrive_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_arrive_transport_job', error)
  return data
}

export async function beginUnloadingTransportJob(profileId: string, jobId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_begin_unloading_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_begin_unloading_transport_job', error)
  return data
}

export async function completeTransportJob(profileId: string, jobId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_complete_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_complete_transport_job', error)
  return data
}

export async function cancelTransportJob(profileId: string, jobId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_cancel_transport_job', {
    p_job_id: jobId,
    p_actor_profile_id: profileId,
  })
  if (error) throw commandError('noxia_cancel_transport_job', error)
  return data
}

export type SettleDueTransportJobsResult = {
  due: number
  arrived: number
  unloading: number
  completed: number
  failed: string[]
}

/**
 * Advance at most one observable lifecycle phase per cron pass. The transit cron
 * runs once per minute, so arrival and unloading remain queryable instead of being
 * collapsed into an immediate completed state in the same scheduler invocation.
 */
export async function settleDueTransportJobs(limit = 100): Promise<SettleDueTransportJobsResult> {
  const supabase = createServiceClient()
  const boundedLimit = Math.min(Math.max(limit, 1), 250)
  const now = new Date().toISOString()

  const [dueResult, arrivedResult, unloadingResult] = await Promise.all([
    supabase
      .from('transport_jobs')
      .select('id,actor_profile_id,status')
      .eq('status', 'in_transit')
      .lte('arrives_at', now)
      .order('arrives_at', { ascending: true })
      .limit(boundedLimit),
    supabase
      .from('transport_jobs')
      .select('id,actor_profile_id,status')
      .eq('status', 'arrived')
      .order('arrived_at', { ascending: true })
      .limit(boundedLimit),
    supabase
      .from('transport_jobs')
      .select('id,actor_profile_id,status')
      .eq('status', 'unloading')
      .order('updated_at', { ascending: true })
      .limit(boundedLimit),
  ])

  if (dueResult.error) throw commandError('due transport job query', dueResult.error)
  if (arrivedResult.error) throw commandError('arrived transport job query', arrivedResult.error)
  if (unloadingResult.error) throw commandError('unloading transport job query', unloadingResult.error)

  const candidates = new Map<string, { id: string; actor_profile_id: string; status: string }>()
  for (const row of [...(dueResult.data ?? []), ...(arrivedResult.data ?? []), ...(unloadingResult.data ?? [])]) {
    if (candidates.size >= boundedLimit) break
    candidates.set(row.id, row)
  }

  let arrived = 0
  let unloading = 0
  let completed = 0
  const failed: string[] = []

  for (const job of candidates.values()) {
    try {
      if (job.status === 'in_transit') {
        await arriveTransportJob(job.actor_profile_id, job.id)
        arrived += 1
      } else if (job.status === 'arrived') {
        await beginUnloadingTransportJob(job.actor_profile_id, job.id)
        unloading += 1
      } else if (job.status === 'unloading') {
        await completeTransportJob(job.actor_profile_id, job.id)
        completed += 1
      }
    } catch (error) {
      console.error(`Transport job ${job.id} settlement failed:`, error)
      failed.push(job.id)
    }
  }

  return { due: candidates.size, arrived, unloading, completed, failed }
}
