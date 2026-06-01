// app/api/game/orders/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 01.06.2026
// Version:      0.2.0
//
// v0.2.0: fulfill akzeptiert optionalen &agreedReward (ausgehandelter Bonus).
// Der Server berechnet das legitime Maximum SELBST (orderMaxReward, dieselbe
// Formel wie der Client) und DECKELT still darauf. Ein manipulierter Client
// kann sich so nicht über das dringlichkeits-basierte Maximum hinaus bereichern.
// Ohne agreedReward bleibt das Verhalten wie bisher (fester order.reward).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { orderMaxReward } from '@/lib/game/config'   // ← NEU: geteilte Formel

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

// GET – Offene Aufträge laden
// GET ?action=fulfill&orderId=xxx[&agreedReward=NNN] – Auftrag erfüllen
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Offene Aufträge laden
  if (!action) {
    const { data: orders } = await serviceClient
      .from('trade_orders')
      .select('*, locations(slug, name)')
      .eq('status', 'open')
      .order('reward', { ascending: false })
      .limit(10)

    return NextResponse.json({ orders: orders ?? [] })
  }

  // Auftrag erfüllen
  if (action === 'fulfill') {
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'Fehlende Order ID' }, { status: 400 })

    // ── NEU: gewünschter Bonus aus Query (optional) ───────────────────────────
    // Der Client schickt seinen ausgehandelten Wunschbetrag. Wir vertrauen ihm
    // NICHT, sondern deckeln ihn unten gegen unser selbst berechnetes Maximum.
    const agreedRewardRaw = searchParams.get('agreedReward')
    const agreedReward = agreedRewardRaw != null ? parseInt(agreedRewardRaw, 10) : null

    // Auftrag laden
    const { data: order } = await serviceClient
      .from('trade_orders')
      .select('*, locations(id, slug)')
      .eq('id', orderId)
      .eq('status', 'open')
      .single()

    if (!order) return NextResponse.json({ error: 'Auftrag nicht gefunden oder bereits erfüllt' }, { status: 404 })

    // Spielerprofil laden
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

    // Schiff laden
    const { data: ship } = await serviceClient
      .from('ships')
      .select('id, location')
      .eq('profile_id', user.id)
      .single()

    if (!ship) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

    // Prüfen ob Spieler am richtigen Ort ist
    if (ship.location !== order.locations?.slug) {
      return NextResponse.json({
        error: `Du musst nach ${order.locations?.slug.toUpperCase()} fliegen um diesen Auftrag zu erfüllen.`
      }, { status: 400 })
    }

    // Cargo laden
    const { data: cargoRows } = await serviceClient
      .from('ship_cargo')
      .select('resource, amount')
      .eq('ship_id', ship.id)

    const cargoMap: Record<string, number> = {}
    for (const c of cargoRows ?? []) cargoMap[c.resource] = c.amount

    // Prüfen ob genug Ware an Bord
    const cargoAmount = cargoMap[order.resource] ?? 0
    if (cargoAmount < order.amount) {
      return NextResponse.json({
        error: `Nicht genug ${order.resource} an Bord. Benötigt: ${order.amount}t, An Bord: ${cargoAmount}t`
      }, { status: 400 })
    }

    // ── NEU: tatsächlichen Reward bestimmen (mit Deckelung) ────────────────────
    // Lagerstand der Zielkolonie für diese Ressource holen (für die Dringlichkeit).
    const { data: locRes } = await serviceClient
      .from('location_resources')
      .select('stock')
      .eq('location_id', order.location_id)
      .eq('resource', order.resource)
      .single()

    const serverMax = orderMaxReward(
      order.reward,
      order.expires_at ?? null,
      locRes?.stock ?? null,
    )

    // Basis = order.reward. Wenn ein gültiger Bonus übergeben wurde, clampen
    // wir ihn auf [order.reward, serverMax]. Ungültige/zu hohe Werte werden
    // still gedeckelt; fehlende oder kaputte Werte fallen auf order.reward zurück.
    let finalReward = order.reward
    if (agreedReward != null && Number.isFinite(agreedReward)) {
      finalReward = Math.min(Math.max(agreedReward, order.reward), serverMax)
    }
    // ───────────────────────────────────────────────────────────────────────────

    // Auftrag erfüllen
    const newCredits = profile.credits + finalReward   // ← finalReward statt order.reward
    const newCargoAmount = cargoAmount - order.amount

    // Credits aktualisieren
    await serviceClient
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

    // Cargo aktualisieren
    if (newCargoAmount > 0) {
      await serviceClient.from('ship_cargo').upsert(
        { ship_id: ship.id, resource: order.resource, amount: newCargoAmount },
        { onConflict: 'ship_id,resource' }
      )
    } else {
      await serviceClient.from('ship_cargo').delete()
        .eq('ship_id', ship.id).eq('resource', order.resource)
    }

    // Auftrag als erfüllt markieren
    await serviceClient
      .from('trade_orders')
      .update({ status: 'fulfilled', fulfilled_by: user.id })
      .eq('id', orderId)

    // Lagerbestand der Kolonie erhöhen
    await serviceClient.rpc('add_to_stock', {
      location_id:   order.location_id,
      resource_type: order.resource,
      amount:        order.amount,
    })

    // Transaktion speichern
    await serviceClient.from('trade_transactions').insert({
      profile_id:    user.id,
      from_location: ship.location,
      to_location:   order.locations?.slug,
      resource:      order.resource,
      amount:        order.amount,
      profit:        finalReward,   // ← finalReward statt order.reward
      order_id:      orderId,
    })

    return NextResponse.json({
      ok:         true,
      reward:     finalReward,      // ← der WIRKLICH gebuchte Betrag (Client zeigt diesen an)
      baseReward: order.reward,     // ← zur Info: Basiswert ohne Bonus
      newCredits,
      newCargo:   { ...cargoMap, [order.resource]: newCargoAmount },
    })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}
