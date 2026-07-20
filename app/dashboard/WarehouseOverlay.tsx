'use client'

// app/dashboard/WarehouseOverlay.tsx
// Erstellt:     21.06.2026 21:20
// Aktualisiert: 21.06.2026 21:20
// Version:      1.0.0
//
// Warenhaus-Overlay — öffnet sich beim Klick auf warehouse/market im Grid.
// Enthält Marktpreise (Kauf/Verkauf-Auktion) und Auftrags-Verhandlung.
// Ersetzt die inline Handelszentrale im Dashboard-Übersicht-Tab.

import { useState } from 'react'
import BuyRow           from './BuyRow'
import MarketAuction    from './MarketAuction'
import OrderNegotiation from './OrderNegotiation'
import { LOC_ICON, LOC_NAME } from './ui'
import type { ResourceType, LocationSlug } from '@/lib/store/gameStore'

const MONO = "'Courier Prime', monospace"
const RES_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const RES_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }

interface MarketRow {
  id:         string
  resource:   ResourceType
  buy_price:  number
  sell_price: number
  stock:      number
}

interface OrderData {
  id:          string
  resource:    string
  amount:      number
  reward:      number
  expires_at?: string
  locations?:  { slug?: string; name?: string }
  stock?:      number
}

interface WarehouseOverlayProps {
  locationSlug:   LocationSlug
  locationName:   string
  prices:         any[]
  resources:      { resource: string; stock: number; consumption: number }[]
  orders:         OrderData[]
  cargo:          Record<ResourceType, number>
  cargoMax:       number
  credits:        number
  onTrade:        (resource: ResourceType, mode: 'buy' | 'sell', amount: number, price: number) => Promise<boolean>
  onFulfillOrder: (orderId: string, agreedReward: number) => Promise<boolean>
  onClose:        () => void
}

type Tab = 'markt' | 'auftraege'

export default function WarehouseOverlay({
  locationSlug, locationName, prices, resources, orders,
  cargo, cargoMax, credits, onTrade, onFulfillOrder, onClose,
}: WarehouseOverlayProps) {
  const [tab, setTab]               = useState<Tab>('markt')
  const [auctionConfig, setAuction] = useState<{
    resource: ResourceType; mode: 'buy' | 'sell'; qty: number; limit: number
  } | null>(null)
  const [negotiateOrder, setNegotiate] = useState<OrderData | null>(null)

  const cargoUsed = (Object.values(cargo) as number[]).reduce((a, b) => a + b, 0)
  const cargoFree = cargoMax - cargoUsed

  // Marktpreise mit Stock anreichern
  const currentPrices: MarketRow[] = prices
    .filter((p: any) => p.locations?.slug === locationSlug)
    .map((p: any) => {
      const res = resources.find(r => r.resource === p.resource)
      return {
        id:         p.id,
        resource:   p.resource,
        buy_price:  p.buy_price,
        sell_price: p.sell_price,
        stock:      res?.stock ?? 0,
      }
    })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Auktions-Modal */}
      {auctionConfig && (
        <MarketAuction
          open={true}
          onClose={() => setAuction(null)}
          location={locationSlug}
          locationName={locationName}
          rows={currentPrices}
          credits={credits}
          cargo={cargo}
          cargoMax={cargoMax}
          onTrade={onTrade}
          initialResource={auctionConfig.resource}
          initialMode={auctionConfig.mode}
          initialQty={auctionConfig.qty}
          playerLimit={auctionConfig.limit}
        />
      )}

      {/* Auftrags-Verhandlung */}
      {negotiateOrder && (
        <OrderNegotiation
          order={negotiateOrder}
          onClose={() => setNegotiate(null)}
          onAccept={async (orderId, agreedReward) => {
            const ok = await onFulfillOrder(orderId, agreedReward)
            if (ok) setNegotiate(null)
            return ok
          }}
          canFulfill={(cargo[negotiateOrder.resource as ResourceType] ?? 0) >= negotiateOrder.amount}
          fulfillHint={
            (cargo[negotiateOrder.resource as ResourceType] ?? 0) < negotiateOrder.amount
              ? `Zu wenig ${RES_LABEL[negotiateOrder.resource] ?? negotiateOrder.resource} an Bord`
              : undefined
          }
        />
      )}

      <div style={{
        background: '#f4f2ed', borderRadius: '14px',
        width: 'min(560px, 95vw)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, sans-serif',
        color: '#1a2a3a', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem', background: '#2a4e7a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#c9a961', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', fontFamily: MONO }}>
              🏪 Warenhaus · {LOC_ICON[locationSlug] ?? '🪐'} {locationName}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>Handelszentrale</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#c9a961', fontFamily: MONO }}>{credits.toLocaleString('de')} Cr</div>
            <div style={{ fontSize: '0.65rem', color: '#8ab0d0', fontFamily: MONO }}>📦 {cargoUsed}/{cargoMax}t</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8ab0d0', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e0ddd6', background: '#f4f2ed' }}>
          {(['markt', 'auftraege'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.6rem 1.25rem', border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'system-ui',
              fontSize: '0.78rem', fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#2a4e7a' : '#6a7a8a',
              borderBottom: tab === t ? '2px solid #2a4e7a' : '2px solid transparent',
              marginBottom: '-2px',
            }}>
              {t === 'markt' ? '📊 Markt' : `📋 Aufträge${orders.length > 0 ? ` (${orders.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Markt */}
          {tab === 'markt' && (
            <div>
              {currentPrices.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#8a9ab0', fontSize: '0.8rem' }}>Keine Marktpreise verfügbar.</div>
              ) : currentPrices.map((p, i) => (
                // @ts-ignore — key is valid React prop
                <BuyRow
                  key={p.id}
                  p={p}
                  last={i === currentPrices.length - 1}
                  cargoFree={cargoFree}
                  owned={cargo[p.resource as ResourceType] ?? 0}
                  costBasis={0}
                  onBuy={(amt, limit) => setAuction({ resource: p.resource as ResourceType, mode: 'buy',  qty: amt, limit })}
                  onSell={(amt, limit) => setAuction({ resource: p.resource as ResourceType, mode: 'sell', qty: amt, limit })}
                />
              ))}
            </div>
          )}

          {/* Aufträge */}
          {tab === 'auftraege' && (
            <div style={{ padding: '1rem 1.25rem' }}>
              {orders.length === 0 ? (
                <div style={{ color: '#8a9ab0', fontSize: '0.8rem', padding: '1rem 0', textAlign: 'center' }}>Keine offenen Aufträge.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {orders.map(o => {
                    const hasGoods = (cargo[o.resource as ResourceType] ?? 0) >= o.amount
                    return (
                      <div key={o.id} style={{ background: '#fff', border: '1px solid #e0ddd6', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            {RES_ICON[o.resource]} {o.amount}t {RES_LABEL[o.resource] ?? o.resource}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#6a7a8a', marginTop: '3px' }}>
                            {o.reward.toLocaleString('de')} Cr/t{o.expires_at ? ` · bis ${new Date(o.expires_at).toLocaleDateString('de')}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => setNegotiate(o)}
                          disabled={!hasGoods}
                          style={{ background: hasGoods ? '#2a4e7a' : '#e0ddd6', color: hasGoods ? '#fff' : '#8a9ab0', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.73rem', fontWeight: 700, cursor: hasGoods ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' as const }}
                        >
                          Erfüllen →
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '0.5rem 1.4rem', borderTop: '1px solid #e0ddd6', fontSize: '0.58rem', color: '#8a9ab0', textAlign: 'center', fontFamily: MONO }}>
          Preise reagieren auf Kauf und Verkauf · Steuern je nach Koloniepolitik
        </div>
      </div>
    </div>
  )
}
