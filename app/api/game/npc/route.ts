// route.ts
// Aktualisiert: 20.06.2026 — NPC-Route
// Version:      0.2.0
// app/api/game/npc/route.ts
// Erstellt:     15.06.2026
// Aktualisiert: 20.06.2026
//
// Öffentliche Lesesicht auf NPC-Aktivität.
//
// ?action=trades   (default) – letzte Käufe aus npc_trades (Phase B)
// ?action=ledger              – letzte Ereignisse aus npc_ledger (Phase C: produce/sell/build)
// ?action=status              – Treasury + Bestand je NPC-Akteur (Zusammenfassung)
//
// Alle Endpunkte sind read-only und ohne Auth (Weltdaten sichtbar für alle,
// entdeckbar über Muster, nie aufgedrängt).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'trades'

  // ── Käufe (Phase B, npc_trades) ───────────────────────────────────────────
  if (action === 'trades') {
    const { data } = await supabase
      .from('npc_trades')
      .select('resource, amount, unit_price, tick, created_at, actors(display_name), locations(slug)')
      .order('created_at', { ascending: false })
      .limit(20)

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

  // ── Ledger-Ereignisse (Phase C: produce / sell / build) ───────────────────
  if (action === 'ledger') {
    const { data } = await supabase
      .from('npc_ledger')
      .select('kind, resource, goods_delta, credit_delta, tick, created_at, actors(display_name), locations(slug)')
      .not('kind', 'eq', 'endowment')          // Startkapital nicht im Feed
      .order('created_at', { ascending: false })
      .limit(30)

    const events = (data ?? []).map((e: any) => ({
      actor:        e.actors?.display_name ?? 'NPC',
      kind:         e.kind,
      resource:     e.resource ?? null,
      goods_delta:  Number(e.goods_delta ?? 0),
      credit_delta: Number(e.credit_delta ?? 0),
      location:     e.locations?.slug ?? null,
      tick:         Number(e.tick),
      at:           e.created_at,
    }))
    return NextResponse.json({ events })
  }

  // ── Status (Treasury + Bestand je Akteur) ─────────────────────────────────
  if (action === 'status') {
    const { data: actors } = await supabase
      .from('actors')
      .select('id, display_name, decision_weights')
      .eq('kind', 'npc_firm')

    const result: Record<string, unknown>[] = []
    for (const actor of (actors ?? []) as any[]) {
      // Treasury
      const { data: ledSum } = await supabase
        .from('npc_ledger')
        .select('credit_delta')
        .eq('actor_id', actor.id)
      const treasury = (ledSum ?? []).reduce((s: number, r: any) => s + Number(r.credit_delta ?? 0), 0)

      // Bestand: Käufe + Ledger-Güter
      const { data: buyLed } = await supabase
        .from('npc_trades')
        .select('resource, amount')
        .eq('actor_id', actor.id)
      const bestand: Record<string, number> = {}
      for (const r of (buyLed ?? []) as any[]) {
        bestand[r.resource] = (bestand[r.resource] ?? 0) + Number(r.amount)
      }
      const { data: prodLed } = await supabase
        .from('npc_ledger')
        .select('resource, goods_delta')
        .eq('actor_id', actor.id)
        .not('resource', 'is', null)
      for (const r of (prodLed ?? []) as any[]) {
        if (r.resource) bestand[r.resource] = (bestand[r.resource] ?? 0) + Number(r.goods_delta ?? 0)
      }

      // Gebäude
      const { data: gebRows } = await supabase
        .from('tile_entities')
        .select('entity_id, locations(slug)')
        .eq('actor_id', actor.id)
        .eq('entity_type', 'building')
      const gebaeude = ((gebRows ?? []) as any[]).map((g: any) => ({
        entity_id: g.entity_id,
        location:  g.locations?.slug ?? null,
      }))

      result.push({
        id:              actor.id,
        name:            actor.display_name,
        treasury:        Math.round(treasury),
        bestand,
        gebaeude,
        decision_weights: actor.decision_weights,
      })
    }
    return NextResponse.json({ actors: result })
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 })
}
