import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await serviceClient.auth.getUser(auth.slice(7))
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationSlug = new URL(req.url).searchParams.get('location') ?? 'earth'
  const { data: location } = await serviceClient
    .from('locations')
    .select('id,slug,name,population,population_max,location_resources(resource,stock,consumption,production)')
    .eq('slug', locationSlug)
    .maybeSingle()

  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const [pricesResult, ordersResult, locationsResult, tickResult] = await Promise.all([
    serviceClient
      .from('market_prices')
      .select('id,resource,buy_price,sell_price,avg_sell_7,location_id')
      .eq('location_id', location.id),
    serviceClient
      .from('trade_orders')
      .select('id,resource,amount,reward,expires_at,status,location_id')
      .eq('location_id', location.id)
      .eq('status', 'open')
      .order('expires_at'),
    serviceClient
      .from('locations')
      .select('slug,name,population')
      .order('slug'),
    serviceClient
      .from('tick_log')
      .select('tick_number')
      .order('tick_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const prices = (pricesResult.data ?? []).map(row => ({
    ...row,
    locations: { slug: location.slug, name: location.name },
  }))
  const orders = (ordersResult.data ?? []).map(row => ({
    ...row,
    locations: { slug: location.slug, name: location.name },
  }))

  return NextResponse.json({
    location,
    prices,
    orders,
    locations: locationsResult.data ?? [],
    tickNumber: Number(tickResult.data?.tick_number ?? 0),
  })
}
