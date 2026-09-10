// app/api/game/trade/route.ts
// Aktualisiert: 10.09.2026 — atomarer Spot-Handel; Travel bleibt bis Transit-Pass kompatibel
// Version:      0.9.0

import { NextRequest, NextResponse } from 'next/server'
import { publishTransaction } from '@/lib/ably/server'
import { createClient } from '@supabase/supabase-js'
import { DOCKING_IDLE_EXPIRE_HOURS } from '@/lib/game/config'
import { flightEnergyCost } from '@/lib/game/ships'
import { operationalDockingPads, selectFreeDockingPad } from '@/lib/game/dockingAssignments'
import { spotTradeCommand, type SpotTradeAction } from '@/lib/game/core/commands'

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

async function incrementFlightCount(profileId: string): Promise<number> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('flight_count')
    .eq('id', profileId)
    .single()

  const next = Number(profile?.flight_count ?? 0) + 1
  await serviceClient.from('profiles').update({ flight_count: next }).eq('id', profileId)
  return next
}

async function reserveDestinationPad(input: {
  shipId: string
  playerProfileId: string
  destinationLocationId: string
}): Promise<{ managed: boolean; padEntityId: string | null; error?: string }> {
  const { data: padRows, error: padError } = await serviceClient
    .from('tile_entities')
    .select('id, profile_id, entity_type, entity_id, parent_id, slot, status, condition')
    .eq('location_id', input.destinationLocationId)
    .eq('entity_type', 'building')
    .in('entity_id', ['landing_pad', 'landing_pad_extra_pad', 'spaceport_pad_mini', 'spaceport_pad_standard'])

  if (padError) return { managed: false, padEntityId: null, error: padError.message }

  const rows = (padRows ?? []) as any[]
  const basePads = rows
    .filter(row => ['landing_pad', 'spaceport_pad_mini', 'spaceport_pad_standard'].includes(row.entity_id))
    .map(row => ({ id: row.id, status: row.status, condition: row.condition, profileId: row.profile_id ?? null }))

  const expansions = rows
    .filter(row => row.entity_id === 'landing_pad_extra_pad' && row.parent_id)
    .map(row => ({
      id: row.id,
      parentEntityId: row.parent_id,
      expansionId: row.entity_id,
      profileId: row.profile_id ?? null,
      status: row.status,
      slot: row.slot ?? null,
      condition: row.condition ?? null,
    }))

  const pads = operationalDockingPads({ basePads, expansions })
  if (pads.length === 0) return { managed: false, padEntityId: null }

  const idleCutoff = new Date(Date.now() - DOCKING_IDLE_EXPIRE_HOURS * 3600_000).toISOString()
  const { error: expireError } = await serviceClient
    .from('ship_docking_assignments')
    .delete()
    .eq('location_id', input.destinationLocationId)
    .lt('updated_at', idleCutoff)
  if (expireError) return { managed: true, padEntityId: null, error: expireError.message }

  const { data: assignmentRows, error: assignmentError } = await serviceClient
    .from('ship_docking_assignments')
    .select('ship_id, location_id, pad_entity_id')
    .eq('location_id', input.destinationLocationId)
  if (assignmentError) return { managed: true, padEntityId: null, error: assignmentError.message }

  const padOwnerById: Record<string, string | null> = {}
  for (const row of rows) padOwnerById[row.id] = row.profile_id ?? null

  const shipIds = Array.from(new Set((assignmentRows ?? []).map(row => row.ship_id)))
  const shipOwnerById: Record<string, string | null> = {}
  if (shipIds.length > 0) {
    const { data: shipOwnerRows } = await serviceClient
      .from('ships')
      .select('id, profile_id')
      .in('id', shipIds)
    for (const ship of shipOwnerRows ?? []) shipOwnerById[ship.id] = ship.profile_id ?? null
  }

  const invalidAssignmentShipIds: string[] = []
  for (const row of assignmentRows ?? []) {
    const padOwner = padOwnerById[row.pad_entity_id] ?? null
    const shipOwner = shipOwnerById[row.ship_id] ?? null
    if (padOwner != null && shipOwner != null && padOwner !== shipOwner) invalidAssignmentShipIds.push(row.ship_id)
  }

  if (invalidAssignmentShipIds.length > 0) {
    const { error: cleanupError } = await serviceClient
      .from('ship_docking_assignments')
      .delete()
      .in('ship_id', invalidAssignmentShipIds)
    if (cleanupError) return { managed: true, padEntityId: null, error: cleanupError.message }
  }

  const assignments = (assignmentRows ?? [])
    .filter(row => !invalidAssignmentShipIds.includes(row.ship_id))
    .map(row => ({ shipId: row.ship_id, locationId: row.location_id, padEntityId: row.pad_entity_id }))

  const remaining = [...pads]
  while (remaining.length > 0) {
    const candidate = selectFreeDockingPad({
      pads: remaining,
      assignments,
      arrivingShipId: input.shipId,
      playerProfileId: input.playerProfileId,
    })
    if (!candidate) break

    const { error } = await serviceClient
      .from('ship_docking_assignments')
      .upsert({
        ship_id: input.shipId,
        location_id: input.destinationLocationId,
        pad_entity_id: candidate.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ship_id' })

    if (!error) return { managed: true, padEntityId: candidate.id }
    if ((error as any).code !== '23505') return { managed: true, padEntityId: null, error: error.message }

    const index = remaining.findIndex(pad => pad.id === candidate.id)
    if (index >= 0) remaining.splice(index, 1)
    assignments.push({ shipId: `race:${candidate.id}`, locationId: input.destinationLocationId, padEntityId: candidate.id })
  }

  return { managed: true, padEntityId: null }
}

function spotError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_SPOT_CARGO_FULL')) return NextResponse.json({ error: 'Frachtraum voll' }, { status: 400 })
  if (message.includes('NOXIA_SPOT_CREDITS_INSUFFICIENT')) return NextResponse.json({ error: 'Unzureichende Credits' }, { status: 400 })
  if (message.includes('NOXIA_SPOT_CARGO_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
  if (message.includes('NOXIA_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_LOCATION_NOT_FOUND')) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_MARKET_PRICE_NOT_FOUND')) return NextResponse.json({ error: 'Kein Marktpreis für diese Ressource' }, { status: 404 })
  if (message.includes('NOXIA_SPOT_RESOURCE_INVALID')) return NextResponse.json({ error: 'Ungültige Ressource' }, { status: 400 })
  console.error('spot trade command failed:', message)
  return NextResponse.json({ error: 'Handel fehlgeschlagen' }, { status: 500 })
}

async function executeSpotTrade(userId: string, action: SpotTradeAction, resource: string, amount: number) {
  if (!resource) return NextResponse.json({ error: 'Ressource fehlt' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })

  try {
    const result = await spotTradeCommand(userId, action, resource, amount)

    publishTransaction({
      profileId: userId,
      username: result.username ?? undefined,
      resource: result.resource,
      amount: result.booked_amount,
      profit: result.profit,
      fromLocation: result.location,
      toLocation: result.location,
    }).catch(() => {})

    if (action === 'sell') {
      const { data: loc } = await serviceClient
        .from('locations')
        .select('id')
        .eq('slug', result.location)
        .maybeSingle()
      if (loc) {
        try {
          await serviceClient.rpc('upsert_location_reputation', {
            p_profile_id: userId,
            p_location_id: loc.id,
            p_deliveries: 1,
            p_volume: result.booked_amount,
          })
        } catch {
          // Reputation is deliberately non-critical to settlement.
        }
      }
    }

    const { data: cargoRows } = await serviceClient
      .from('ship_cargo')
      .select('resource, amount')
      .eq('ship_id', result.ship_id)

    const cargo: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const row of cargoRows ?? []) cargo[row.resource] = row.amount

    return NextResponse.json({
      ok: true,
      bookedAmount: result.booked_amount,
      requestedAmount: result.requested_amount,
      unitPrice: result.unit_price,
      taxCharged: result.tax_charged,
      taxRate: result.tax_rate,
      priceUpdate: result.price_changed
        ? { resource: result.resource, buyPrice: result.market_buy_price, sellPrice: result.market_sell_price }
        : null,
      credits: result.credits,
      location: result.location,
      cargoMax: result.cargo_max,
      cargo,
      shipId: result.ship_id,
      shipTypeId: result.ship_type_id,
    })
  } catch (error) {
    return spotError(error)
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'getTrades') {
    const { data: trades } = await serviceClient
      .from('trade_transactions')
      .select('*')
      .eq('profile_id', user.id)
      .order('traded_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ trades: trades ?? [] })
  }

  if (!action) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    const { data: shipRows } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active')
      .eq('profile_id', user.id)
    const ship: any = (shipRows as any[])?.find((s: any) => s.is_active)
      ?? (shipRows as any[])?.[0]
      ?? null

    const { data: shipType } = ship?.ship_type_id
      ? await serviceClient.from('ship_types').select('speed_mult, range_distance').eq('id', ship.ship_type_id).single()
      : { data: null }

    const { data: cargoRows } = ship
      ? await serviceClient.from('ship_cargo').select('resource, amount').eq('ship_id', ship.id)
      : { data: [] }

    const cargo: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const row of cargoRows ?? []) cargo[row.resource] = row.amount

    return NextResponse.json({
      credits: profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo,
      shipId: ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
      speedMult: Number((shipType as any)?.speed_mult ?? 1.0),
      rangeDistance: Number((shipType as any)?.range_distance ?? 28),
    })
  }

  const resource = searchParams.get('resource') ?? ''
  const amount = Number.parseInt(searchParams.get('amount') ?? '1', 10)

  // Legacy synchronous travel remains intentionally unchanged until the Transit pass.
  if (action === 'travel') {
    const dest = resource

    const { data: shipRows } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active')
      .eq('profile_id', user.id)
    const travelShip: any = (shipRows as any[])?.find((s: any) => s.is_active)
      ?? (shipRows as any[])?.[0]
      ?? null
    if (!travelShip) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

    const fromLocation = travelShip.location
    const energyNeeded = flightEnergyCost(fromLocation, dest)

    const { data: energyCargo } = await serviceClient
      .from('ship_cargo')
      .select('amount')
      .eq('ship_id', travelShip.id)
      .eq('resource', 'energy')
      .maybeSingle()
    const energyOnBoard = Number(energyCargo?.amount ?? 0)

    if (energyOnBoard < energyNeeded) {
      return NextResponse.json({
        error: `Nicht genug Energie. Benötigt: ${energyNeeded}t, an Bord: ${energyOnBoard}t`,
        energyNeeded,
        energyOnBoard,
        shipLocation: fromLocation,
      }, { status: 400 })
    }

    const { data: destLoc } = await serviceClient.from('locations').select('id').eq('slug', dest).maybeSingle()
    if (!destLoc) return NextResponse.json({ error: 'Zielort nicht gefunden' }, { status: 404 })

    let landingFee = 0
    let payerCredits: number | null = null
    if (fromLocation !== dest) {
      const { data: destSettings } = await serviceClient
        .from('colony_settings')
        .select('tax_landing')
        .eq('location_id', destLoc.id)
        .maybeSingle()
      landingFee = Math.max(0, Math.round(Number(destSettings?.tax_landing ?? 0)))

      if (landingFee > 0) {
        const { data: payerProfile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
        payerCredits = Number(payerProfile?.credits ?? 0)
        if (!payerProfile || payerCredits < landingFee) {
          return NextResponse.json({ error: `Landegebühr ${landingFee} Cr — nicht genug Credits`, landingFee }, { status: 400 })
        }
      }
    }

    let dockingManaged = false
    let dockingPadEntityId: string | null = null
    if (fromLocation !== dest) {
      const reservation = await reserveDestinationPad({
        shipId: travelShip.id,
        playerProfileId: user.id,
        destinationLocationId: destLoc.id,
      })
      if (reservation.error) return NextResponse.json({ error: `Docking konnte nicht geprüft werden: ${reservation.error}` }, { status: 503 })
      dockingManaged = reservation.managed
      dockingPadEntityId = reservation.padEntityId
      if (dockingManaged && !dockingPadEntityId) {
        return NextResponse.json({ error: 'Kein freier Landeplatz am Ziel verfügbar.', code: 'NO_LANDING_CAPACITY', destination: dest }, { status: 409 })
      }
    }

    if (landingFee > 0 && payerCredits != null) {
      await serviceClient.from('profiles').update({ credits: payerCredits - landingFee }).eq('id', user.id)
      const { data: destTick } = await serviceClient.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
      await serviceClient.from('colony_ledger').insert({
        location_id: destLoc.id,
        tick: Number(destTick?.tick_number ?? 0),
        entry_type: 'landing_fee',
        profile_id: user.id,
        resource_type: null,
        amount: landingFee,
        note: `Landegebühr ${dest}`,
      })
    }

    const energyLeft = energyOnBoard - energyNeeded
    if (energyLeft > 0) {
      await serviceClient.from('ship_cargo').update({ amount: energyLeft }).eq('ship_id', travelShip.id).eq('resource', 'energy')
    } else {
      await serviceClient.from('ship_cargo').delete().eq('ship_id', travelShip.id).eq('resource', 'energy')
    }

    await serviceClient.from('ships').update({ location: dest }).eq('id', travelShip.id)

    if (fromLocation !== dest && !dockingManaged) {
      await serviceClient.from('ship_docking_assignments').delete().eq('ship_id', travelShip.id)
    }

    const flightCount = fromLocation !== dest ? await incrementFlightCount(user.id) : Number.NaN
    return NextResponse.json({
      ok: true,
      location: dest,
      energyUsed: energyNeeded,
      flightCount,
      landingFee,
      docking: { managed: dockingManaged, padEntityId: dockingPadEntityId },
    })
  }

  if (action === 'buy' || action === 'sell') {
    return executeSpotTrade(user.id, action, resource, amount)
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const action = body?.action
  if (action !== 'buy' && action !== 'sell') {
    return NextResponse.json({ error: 'POST unterstützt hier nur buy/sell' }, { status: 400 })
  }

  return executeSpotTrade(
    user.id,
    action,
    typeof body?.resource === 'string' ? body.resource : '',
    Number.parseInt(String(body?.amount ?? '1'), 10),
  )
}
