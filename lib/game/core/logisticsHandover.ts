import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { LogisticsResource, TransportDomain } from './logistics'

export type TransportJobLeg = {
  id: string
  job_id: string
  sequence_no: number
  domain: TransportDomain
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  route_snapshot: Record<string, unknown>
  status: 'planned' | 'in_transit' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
}

export type TransportJobHandover = {
  id: string
  job_id: string
  sequence_no: number
  source_inventory_id: string
  target_inventory_id: string
  resource: LogisticsResource
  amount: number
  requires_docking: boolean
  docking_connection_id: string | null
  status: 'planned' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
}

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function transferConnectedCargo(input: {
  commandId: string
  actorProfileId: string
  connectionId: string
  sourceInventoryId: string
  targetInventoryId: string
  resource: LogisticsResource
  amount: number
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_transfer_connected_cargo', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_connection_id: input.connectionId,
    p_source_inventory_id: input.sourceInventoryId,
    p_target_inventory_id: input.targetInventoryId,
    p_resource: input.resource,
    p_amount: input.amount,
  })
  if (error) throw commandError('noxia_transfer_connected_cargo', error)
  return data
}

export async function getTransportItinerary(profileId: string, jobId: string): Promise<{
  legs: TransportJobLeg[]
  handovers: TransportJobHandover[]
}> {
  const supabase = createServiceClient()
  const { data: job, error: jobError } = await supabase
    .from('transport_jobs')
    .select('id')
    .eq('id', jobId)
    .eq('actor_profile_id', profileId)
    .maybeSingle()
  if (jobError) throw commandError('transport job lookup', jobError)
  if (!job) throw new Error('NOXIA_TRANSPORT_JOB_NOT_FOUND')

  const [{ data: legs, error: legsError }, { data: handovers, error: handoversError }] = await Promise.all([
    supabase.from('transport_job_legs').select('*').eq('job_id', jobId).order('sequence_no'),
    supabase.from('transport_job_handovers').select('*').eq('job_id', jobId).order('sequence_no'),
  ])
  if (legsError) throw commandError('transport leg query', legsError)
  if (handoversError) throw commandError('transport handover query', handoversError)

  return {
    legs: (legs ?? []) as unknown as TransportJobLeg[],
    handovers: (handovers ?? []) as unknown as TransportJobHandover[],
  }
}

/**
 * Atomically decomposes an existing reserved TransportJob into explicit vehicle
 * legs and explicit cargo handovers. The RPC owns the transaction and command
 * idempotency; callers never assemble a half-defined itinerary client-side.
 */
export async function defineTransportItinerary(input: {
  commandId: string
  actorProfileId: string
  jobId: string
  legs: Array<{
    sequenceNo: number
    domain: TransportDomain
    sourceInventoryId: string
    destinationInventoryId: string
    vehicleInventoryId?: string | null
    routeSnapshot?: Record<string, unknown>
  }>
  handovers: Array<{
    sequenceNo: number
    sourceInventoryId: string
    targetInventoryId: string
    resource: LogisticsResource
    amount: number
    requiresDocking?: boolean
    dockingConnectionId?: string | null
  }>
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_define_transport_itinerary', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_job_id: input.jobId,
    p_legs: input.legs,
    p_handovers: input.handovers,
  })
  if (error) throw commandError('noxia_define_transport_itinerary', error)
  return {
    command: data,
    itinerary: await getTransportItinerary(input.actorProfileId, input.jobId),
  }
}
