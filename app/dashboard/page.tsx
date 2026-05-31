import { createServiceClient } from '@/lib/supabase/service'
import DashboardClient from './DashboardClient'

export const revalidate = 30

async function getGameData() {
  const supabase = createServiceClient()
  const [{ data: locations }, { data: prices }, { data: orders }] = await Promise.all([
    supabase.from('locations').select('*, location_resources(resource, stock, consumption, production), has_shipyard').order('slug'),
    supabase.from('market_prices').select('*, locations(slug, name)').order('locations(slug)'),
    supabase.from('trade_orders').select('*, locations(slug, name)').eq('status', 'open').order('reward', { ascending: false }).limit(3),
  ])
  return { locations: locations ?? [], prices: prices ?? [], orders: orders ?? [] }
}

export default async function Dashboard() {
  const { locations, prices, orders } = await getGameData()
  return <DashboardClient locations={locations} prices={prices} orders={orders} />
}