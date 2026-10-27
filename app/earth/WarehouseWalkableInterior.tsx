'use client'

// app/earth/WarehouseWalkableInterior.tsx
// Das Warenhaus als Einrichtung des allgemeinen Innenraums (NOXIA-INTERIOR-0001).
// Eigen: Lagerhalle mit Preistafel, die Disposition kennt Preise, Vorrat,
// offene Aufträge und die Fracht des Gastes; das Angebot ist die Preistafel
// und der Tresen (bestehendes WarehouseOverlay) für Kauf, Verkauf, Aufträge.

import { useMemo, useRef } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { WAREHOUSE_INTRODUCTION, WAREHOUSE_LAYOUT, warehouseKnowledge, type MarketPriceRow } from '@/lib/game/warehouse/warehouseInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = { entityId: string; buildingName: string; locationName: string; prices: any[]; openOrders: number; cargo: Record<string, number> | null; companion?: ColonyResident | null; onClose: () => void; onOpenDesk: () => void }

export default function WarehouseWalkableInterior({ entityId, buildingName, locationName, prices, openOrders, cargo, companion = null, onClose, onOpenDesk }: Props) {
  const ctxRef = useRef<InteriorContext | null>(null)
  const rows = useMemo<MarketPriceRow[]>(() => (prices ?? []).map((p: any) => ({ resource: String(p.resource), buyPrice: Number(p.buy_price ?? p.buyPrice ?? 0), sellPrice: Number(p.sell_price ?? p.sellPrice ?? 0), stock: Number(p.stock ?? 0) })), [prices])
  const knowledge = useMemo(() => warehouseKnowledge(rows.length || openOrders ? { locationName, prices: rows, openOrders, cargo } : null), [rows, openOrders, cargo, locationName])
  const layout = WAREHOUSE_LAYOUT

  const fitting: InteriorFitting = {
    kind: 'warehouse', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'HANDEL',
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'DISPOSITION' : kind === 'board' ? 'PREISE' : null,
    decor: { plants: [], rug: null },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier im Warenhaus' }),
      self.roomRole === 'staff' ? knowledge : ['Du bist selbst Kunde hier; die Preise stehen auf der Tafel'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? WAREHOUSE_INTRODUCTION : undefined,
    things: [],
    idleText: 'Die Preistafel zeigt Ankauf und Verkauf; gehandelt wird an der Disposition.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zur Disposition gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      if (!ctx.nearService) return <p className="hint">Kaufen, verkaufen und Aufträge gibt es an der Disposition.</p>
      return <div className="menu">
        <small>PREISTAFEL</small>
        {rows.length ? <dl className="notice">{rows.map(r => <span key={r.resource} style={{ display: 'contents' }}><dt>{r.resource}</dt><dd>{r.sellPrice} / {r.buyPrice} Cr{r.stock === 0 ? ' · aus' : ''}</dd></span>)}</dl> : <p>Heute steht nichts auf der Tafel.</p>}
        <p className="hint">Ankauf / Verkauf je Einheit{openOrders ? ` · ${openOrders} offene Aufträge` : ''}</p>
        <small>DISPOSITION</small>
        <button className="open-school" onClick={onOpenDesk}>Tresen öffnen – kaufen, verkaufen, Aufträge</button>
      </div>
    },
  }

  return <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
}
