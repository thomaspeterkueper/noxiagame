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
 * Itinerary definitions are server-authored decompositions of an already-created
 * TransportJob. They do not mutate cargo. Each row references the same shared
 * inventories used by the aggregate job.
 *
 * Only a reserved job can be decomposed, and it can be defined once. This keeps
 * the v1 contract deliberately small; later route replanning should be an explicit
 * revision command rather than silent row replacement.
 */
export async function defineTransportItinerary(input: {
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
  const { data: job, error: jobError } = await supabase
    .from('transport_jobs')
    .select('id,status')
    .eq('id', input.jobId)
    .eq('actor_profile_id', input.actorProfileId)
    .maybeSingle()
  if (jobError) throw commandError('transport job lookup', jobError)
  if (!job) throw new Error('NOXIA_TRANSPORT_JOB_NOT_FOUND')
  if (job.status !== 'reserved') throw new Error('NOXIA_TRANSPORT_ITINERARY_STATE_INVALID')

  const existing = await getTransportItinerary(input.actorProfileId, input.jobId)
  if (existing.legs.length > 0 || existing.handovers.length > 0) {
    throw new Error('NOXIA_TRANSPORT_ITINERARY_ALREADY_DEFINED')
  }

  // We intentionally refuse partial definitions at this boundary. The DB rows are
  // independent projections; consumers should provide the complete itinerary in
  // one server action. If one insert fails, cleanup the first projection before
  // surfacing the error so callers never observe a half-defined itinerary.
  const legRows = input.legs.map(leg => ({
    job_id: input.jobId,
    sequence_no: leg.sequenceNo,
    domain: leg.domain,
    source_inventory_id: leg.sourceInventoryId,
    destination_inventory_id: leg.destinationInventoryId,
    vehicle_inventory_id: leg.vehicleInventoryId ?? null,
    route_snapshot: leg.routeSnapshot ?? {},
  }))
  const handoverRows = input.handovers.map(handover => ({
    job_id: input.jobId,
    sequence_no: handover.sequenceNo,
    source_inventory_id: handover.sourceInventoryId,
    target_inventory_id: handover.targetInventoryId,
    resource: handover.resource,
    amount: handover.amount,
    requires_docking: handover.requiresDocking ?? false,
    docking_connection_id: handover.dockingConnectionId ?? null,
  }))

  if (legRows.length > 0) {
    const { error } = await supabase.from('transport_job_legs').insert(legRows)
    if (error) throw commandError('transport leg definition', error)
  }
  if (handoverRows.length > 0) {
    const { error } = await supabase.from('transport_job_handovers').insert(handoverRows)
    if (error) {
      if (legRows.length > 0) await supabase.from('transport_job_legs').delete().eq('job_id', input.jobId)
      throw commandError('transport handover definition', error)
    }
  }
  return getTransportItinerary(input.actorProfileId, input.jobId)
}
