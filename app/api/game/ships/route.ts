// app/api/game/ships/route.ts
// Erstellt: 31.05.2026

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

// GET – Schiffstypen laden
// GET ?action=buy&shipTypeId=fast_courier – Schiff kaufen
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Schiffstypen laden
  if (!action) {
    const { data: shipTypes } = await serviceClient
      .from('ship_types')
      .select('*')
      .order('cost_credits')

    const { data: ship } = await serviceClient
      .from('ships')
      .select('ship_type_id, location')
      .eq('profile_id', user.id)
      .single()

    return NextResponse.json({
      shipTypes: shipTypes ?? [],
      currentShipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
      currentLocation: ship?.location ?? 'moon',
    })
  }

  // Schiff kaufen
  if (action === 'buy') {
    const shipTypeId = searchParams.get('shipTypeId')
    if (!shipTypeId) return NextResponse.json({ error: 'Fehlende Ship Type ID' }, { status: 400 })

    // Schiffstyp laden
    const { data: shipType } = await serviceClient
      .from('ship_types')
      .select('*')
      .eq('id', shipTypeId)
      .single()

    if (!shipType) return NextResponse.json({ error: 'Schiffstyp nicht gefunden' }, { status: 404 })

    // Spieler laden
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

    // Aktuelles Schiff laden
    const { data: ship } = await serviceClient
      .from('ships')
      .select('id, location, ship_type_id')
      .eq('profile_id', user.id)
      .single()

    if (!ship) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

    // Prüfen ob bereits dieses Schiff
    if (ship.ship_type_id === shipTypeId) {
      return NextResponse.json({ error: 'Du hast dieses Schiff bereits.' }, { status: 400 })
    }

    // Prüfen ob Werft vorhanden (nur Mond)
    if (ship.location !== shipType.available_at) {
      return NextResponse.json({
        error: `Dieses Schiff ist nur auf ${shipType.available_at.toUpperCase()} erhältlich.`
      }, { status: 400 })
    }

    // Prüfen ob genug Credits
    if (profile.credits < shipType.cost_credits) {
      return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
    }

    // Kauf durchführen
    const newCredits = profile.credits - shipType.cost_credits

    await serviceClient
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

      console.log('buy attempt:', { shipTypeId, location: ship.location, available_at: shipType.available_at, credits: profile.credits, cost: shipType.cost_credits })

    await serviceClient
      .from('ships')
      .update({
        ship_type_id: shipTypeId,
        cargo_max:    shipType.cargo_max,
      })
      .eq('id', ship.id)

    // Cargo leeren (Schiffswechsel)
    await serviceClient
      .from('ship_cargo')
      .delete()
      .eq('ship_id', ship.id)

    

    return NextResponse.json({
      ok:           true,
      newCredits,
      shipTypeId,
      cargoMax:     shipType.cargo_max,
      speedMult:    shipType.speed_mult,
    })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}