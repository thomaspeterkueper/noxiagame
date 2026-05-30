// app/api/game/trade/route.ts
// Erstellt: 30.05.2026

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// GET – Spielstand laden
export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Profil laden
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, last_seen_at')
    .eq('id', user.id)
    .single()

  // Schiff laden
  const { data: ship } = await supabase
    .from('ships')
    .select('id, location, cargo_max')
    .eq('profile_id', user.id)
    .single()

  // Cargo laden
  const { data: cargo } = ship
    ? await supabase
        .from('ship_cargo')
        .select('resource, amount')
        .eq('ship_id', ship.id)
    : { data: [] }

  const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
  for (const c of cargo ?? []) {
    cargoMap[c.resource] = c.amount
  }

  return NextResponse.json({
    credits:  profile?.credits ?? 5000,
    location: ship?.location ?? 'moon',
    cargoMax: ship?.cargo_max ?? 100,
    cargo:    cargoMap,
    shipId:   ship?.id,
  })
}

// POST – Kauf oder Verkauf
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, resource, amount, price, location } = body

  if (!action || !resource || !amount || !price || !location) {
    return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
  }

  // Profil laden
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  // Schiff laden
  const { data: ship } = await supabase
    .from('ships')
    .select('id, cargo_max')
    .eq('profile_id', user.id)
    .single()

  if (!ship) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

  // Cargo laden
  const { data: cargoRows } = await supabase
    .from('ship_cargo')
    .select('resource, amount')
    .eq('ship_id', ship.id)

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
    if (newCargoAmount < amount) return NextResponse.json({ error: 'Nicht genug Ware an Bord' }, { status: 400 })
    const totalRevenue = price * amount
    newCredits += totalRevenue
    newCargoAmount -= amount
    profit = totalRevenue

  } else {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  // Credits aktualisieren
  await supabase
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', user.id)

  // Cargo aktualisieren
  if (newCargoAmount > 0) {
    await supabase
      .from('ship_cargo')
      .upsert({ ship_id: ship.id, resource, amount: newCargoAmount }, { onConflict: 'ship_id,resource' })
  } else {
    await supabase
      .from('ship_cargo')
      .delete()
      .eq('ship_id', ship.id)
      .eq('resource', resource)
  }

  // Transaktion speichern
  await supabase
    .from('trade_transactions')
    .insert({
      profile_id:    user.id,
      from_location: location,
      to_location:   location,
      resource,
      amount,
      profit,
    })

  return NextResponse.json({
    ok:       true,
    credits:  newCredits,
    cargo:    { ...cargoMap, [resource]: newCargoAmount },
  })
}

// PATCH – Standort wechseln
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { location } = await req.json()
  if (!location) return NextResponse.json({ error: 'Fehlender Standort' }, { status: 400 })

  await supabase
    .from('ships')
    .update({ location })
    .eq('profile_id', user.id)

  return NextResponse.json({ ok: true, location })
}