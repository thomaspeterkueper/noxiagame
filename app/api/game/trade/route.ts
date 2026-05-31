// app/api/game/trade/route.ts
// Erstellt: 30.05.2026

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

   // Handelshistorie laden (für Statistiken)
if (action === 'getTrades') {
  const { data: trades } = await serviceClient
    .from('trade_transactions')
    .select('*')
    .eq('profile_id', user.id)
    .order('traded_at', { ascending: false })
    .limit(100)
  return NextResponse.json({ trades: trades ?? [] })
}
  // Spielstand laden (kein action Parameter)
  if (!action) {
    const { data: profile } = await serviceClient
      .from('profiles').select('credits').eq('id', user.id).single()
   const { data: ship } = await serviceClient
  .from('ships').select('id, location, cargo_max, ship_type_id').eq('profile_id', user.id).single()
    const { data: cargo } = ship
      ? await serviceClient.from('ship_cargo').select('resource, amount').eq('ship_id', ship.id)
      : { data: [] }

    const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const c of cargo ?? []) cargoMap[c.resource] = c.amount

    return NextResponse.json({
      credits:  profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo:    cargoMap,
      shipId:   ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
    })
   
  }

  const resource = searchParams.get('resource') as string
  const amount   = parseInt(searchParams.get('amount') ?? '1')
  const price    = parseInt(searchParams.get('price') ?? '0')
  const location = searchParams.get('location') as string

  const { data: profile } = await serviceClient
    .from('profiles').select('id, credits').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  const { data: ship } = await serviceClient
    .from('ships').select('id, location, cargo_max, ship_type_id').eq('profile_id', user.id).single()
  if (!ship) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

  const { data: cargoRows } = await serviceClient
    .from('ship_cargo').select('resource, amount').eq('ship_id', ship.id)
  const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
  for (const c of cargoRows ?? []) cargoMap[c.resource] = c.amount
  const cargoUsed = Object.values(cargoMap).reduce((a, b) => a + b, 0)

  let newCredits = profile.credits
  let newCargoAmount = cargoMap[resource] ?? 0
  let profit = 0

  if (action === 'buy') {
    const totalCost = price * amount
    if (newCredits < totalCost) return NextResponse.json({ error: 'Unzureichende Credits' }, { status: 400 })
    if (cargoUsed + amount > ship.cargo_max) return NextResponse.json({ error: 'Frachtraum voll' }, { status: 400 })
    newCredits -= totalCost
    newCargoAmount += amount
    profit = -totalCost
  } else if (action === 'sell') {
    if (newCargoAmount < amount) return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
    newCredits += price * amount
    newCargoAmount -= amount
    profit = price * amount
  } else if (action === 'travel') {
    await serviceClient.from('ships').update({ location: resource }).eq('profile_id', user.id)
    return NextResponse.json({ ok: true, location: resource })
  } else {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  await serviceClient.from('profiles').update({ credits: newCredits }).eq('id', user.id)

  if (newCargoAmount > 0) {
    await serviceClient.from('ship_cargo').upsert(
      { ship_id: ship.id, resource, amount: newCargoAmount },
      { onConflict: 'ship_id,resource' }
    )
  } else {
    await serviceClient.from('ship_cargo').delete()
      .eq('ship_id', ship.id).eq('resource', resource)
  }

  if (action !== 'travel') {
    await serviceClient.from('trade_transactions').insert({
      profile_id: user.id, from_location: location, to_location: location,
      resource, amount, profit,
    })
  }

 return NextResponse.json({
  credits:    profile?.credits ?? 5000,
  location:   ship?.location ?? 'moon',
  cargoMax:   ship?.cargo_max ?? 100,
  cargo:      cargoMap,
  shipId:     ship?.id,
  shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
})
}