import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { LogisticsResource, RouteSnapshot } from './logistics'

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function createAndStartTransportJobAtomic(input: {
  commandId: string
  actorProfileId: string
  locationId: string
  sourceInventoryId: string
  destinationInventoryId: string
  vehicleInventoryId: string
  vehicleRole: string
  resource: LogisticsResource
  amount: number
  routeSnapshot: RouteSnapshot
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_create_and_start_transport_job', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_location_id: input.locationId,
    p_domain: 'surface',
    p_source_inventory_id: input.sourceInventoryId,
    p_destination_inventory_id: input.destinationInventoryId,
    p_vehicle_inventory_id: input.vehicleInventoryId,
    p_vehicle_role: input.vehicleRole,
    p_resource: input.resource,
    p_amount: input.amount,
    p_route_snapshot: input.routeSnapshot,
  })
  if (error) throw commandError('noxia_create_and_start_transport_job', error)
  return data as Record<string, unknown>
}
