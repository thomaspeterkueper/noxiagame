import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { LogisticsResource } from './logistics'

export type FacilityOutputCreditResult = {
  tickNumber: number
  tileEntityId: string
  inventoryId: string
  locationId: string | null
  resource: LogisticsResource
  amount: number
  amountAfter: number
  idempotent: boolean
}

export async function creditFacilityOutputCommand(input: {
  tickNumber: number
  tileEntityId: string
  resource: LogisticsResource
  amount: number
}): Promise<FacilityOutputCreditResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_credit_facility_output', {
    p_tick_number: input.tickNumber,
    p_tile_entity_id: input.tileEntityId,
    p_resource: input.resource,
    p_amount: input.amount,
  })

  if (error) {
    const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
    throw new Error(`noxia_credit_facility_output failed${suffix ? `: ${suffix}` : ''}`)
  }

  return data as FacilityOutputCreditResult
}
