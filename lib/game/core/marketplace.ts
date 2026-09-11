import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { LogisticsResource } from '@/lib/game/core/logistics'

export const MARKET_OFFER_STATUSES = ['open', 'filled', 'cancelled'] as const
export type MarketOfferStatus = typeof MARKET_OFFER_STATUSES[number]

export type StorageAccount = {
  id: string
  host_inventory_id: string
  owner_profile_id: string
  inventory_id: string | null
  status: 'active' | 'closed'
  created_at: string
  updated_at: string
}

export type MarketOffer = {
  id: string
  command_id: string
  seller_profile_id: string
  host_inventory_id: string
  seller_inventory_id: string
  reservation_id: string
  resource: LogisticsResource
  amount_total: number
  amount_remaining: number
  unit_price: number
  status: MarketOfferStatus
  created_at: string
  updated_at: string
  closed_at: string | null
}

export type MarketSettlement = {
  id: string
  command_id: string
  offer_id: string
  buyer_profile_id: string
  seller_profile_id: string
  host_inventory_id: string
  seller_inventory_id: string
  buyer_inventory_id: string
  resource: LogisticsResource
  amount: number
  unit_price: number
  total_price: number
  result: Record<string, unknown>
  created_at: string
}

function marketError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function ensureStorageAccount(profileId: string, hostInventoryId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_ensure_storage_account', {
    p_owner_profile_id: profileId,
    p_host_inventory_id: hostInventoryId,
  })
  if (error) throw marketError('noxia_ensure_storage_account', error)
  return data as {
    account: StorageAccount
    hostInventoryId: string
    inventory: Record<string, unknown>
  }
}

export async function listStorageAccounts(profileId: string, hostInventoryId?: string | null): Promise<StorageAccount[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('storage_accounts')
    .select('id,host_inventory_id,owner_profile_id,inventory_id,status,created_at,updated_at')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: true })
    .limit(250)

  if (hostInventoryId) query = query.eq('host_inventory_id', hostInventoryId)

  const { data, error } = await query
  if (error) throw marketError('storage account query', error)
  return (data ?? []) as unknown as StorageAccount[]
}

export async function listMarketOffers(options: {
  hostInventoryId?: string | null
  sellerProfileId?: string | null
  resource?: LogisticsResource | null
  status?: MarketOfferStatus | null
  limit?: number
} = {}): Promise<MarketOffer[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('market_offers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 250))

  if (options.hostInventoryId) query = query.eq('host_inventory_id', options.hostInventoryId)
  if (options.sellerProfileId) query = query.eq('seller_profile_id', options.sellerProfileId)
  if (options.resource) query = query.eq('resource', options.resource)
  if (options.status) query = query.eq('status', options.status)

  const { data, error } = await query
  if (error) throw marketError('market offer query', error)
  return (data ?? []) as unknown as MarketOffer[]
}

export async function getMarketOffer(offerId: string): Promise<MarketOffer | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('market_offers')
    .select('*')
    .eq('id', offerId)
    .maybeSingle()

  if (error) throw marketError('market offer lookup', error)
  return data as unknown as MarketOffer | null
}

export async function createMarketOffer(input: {
  commandId: string
  sellerProfileId: string
  sellerInventoryId: string
  resource: LogisticsResource
  amount: number
  unitPrice: number
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_create_market_offer', {
    p_command_id: input.commandId,
    p_seller_profile_id: input.sellerProfileId,
    p_seller_inventory_id: input.sellerInventoryId,
    p_resource: input.resource,
    p_amount: input.amount,
    p_unit_price: input.unitPrice,
  })
  if (error) throw marketError('noxia_create_market_offer', error)
  return data
}

export async function cancelMarketOffer(profileId: string, offerId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_cancel_market_offer', {
    p_seller_profile_id: profileId,
    p_offer_id: offerId,
  })
  if (error) throw marketError('noxia_cancel_market_offer', error)
  return data
}

export async function buyMarketOffer(input: {
  commandId: string
  buyerProfileId: string
  offerId: string
  amount: number
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_buy_market_offer', {
    p_command_id: input.commandId,
    p_buyer_profile_id: input.buyerProfileId,
    p_offer_id: input.offerId,
    p_amount: input.amount,
  })
  if (error) throw marketError('noxia_buy_market_offer', error)
  return data
}

export async function listMarketSettlements(profileId: string, limit = 100): Promise<MarketSettlement[]> {
  const supabase = createServiceClient()
  const boundedLimit = Math.min(Math.max(limit, 1), 250)
  const { data, error } = await supabase
    .from('market_settlements')
    .select('*')
    .or(`buyer_profile_id.eq.${profileId},seller_profile_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(boundedLimit)

  if (error) throw marketError('market settlement query', error)
  return (data ?? []) as unknown as MarketSettlement[]
}
