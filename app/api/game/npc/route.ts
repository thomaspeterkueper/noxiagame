// app/api/game/npc/route.ts
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Öffentliche Lesesicht auf das NPC-Handelsledger (npc_trades) für den
// „Marktteilnehmer"-Feed. Wie die world-Route: Service-Client, keine Auth —
// Weltdaten sind per RLS für alle sichtbar (entdeckbar, nicht aufgedrängt).
// Read-only; liefert die jüngsten Käufe mit Akteursname + Ortskürzel.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('npc_trades')
    .select('resource, amount, unit_price, tick, created_at, actors(display_name), locations(slug)')
    .order('created_at', { ascending: false })
    .limit(15)

  const trades = (data ?? []).map((t: any) => ({
    actor:    t.actors?.display_name ?? 'NPC',
    resource: t.resource,
    amount:   Number(t.amount),
    price:    Number(t.unit_price),
    location: t.locations?.slug ?? null,
    tick:     Number(t.tick),
    at:       t.created_at,
  }))

  return NextResponse.json({ trades })
}
