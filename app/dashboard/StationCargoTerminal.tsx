'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

const RESOURCES = ['water', 'energy', 'metal', 'components'] as const
type Resource = typeof RESOURCES[number]

type Inventory = {
  id: string
  owner_profile_id: string | null
  location_id: string | null
  inventory_kind: string
  storage_kind: string
  subject_type: string
  subject_id: string | null
  label: string
  capacity: number | null
  public_deposit: boolean
  public_withdraw: boolean
  active: boolean
  metadata: Record<string, unknown>
}

type SnapshotItem = {
  resource: Resource
  label: string
  unit: string
  amount: number
  available: number
  reservedOutbound: number
}

type InventorySnapshot = {
  id: string
  label: string
  capacity: number | null
  totalAmount: number
  items: SnapshotItem[]
}

type DockingConnection = {
  id: string
  station_slug: string
  port_id: string
  ship_id: string
  status: 'docked' | 'released'
  docked_at: string
  released_at: string | null
}

type MarketOffer = {
  id: string
  seller_profile_id: string
  host_inventory_id: string
  seller_inventory_id: string
  resource: Resource
  amount_total: number
  amount_remaining: number
  unit_price: number
  status: 'open' | 'filled' | 'cancelled'
}

type StorageAccount = {
  id: string
  host_inventory_id: string
  owner_profile_id: string
  inventory_id: string | null
  status: 'active' | 'closed'
}

const LABEL: Record<Resource, string> = {
  water: 'Wasser',
  energy: 'Energie',
  metal: 'Metall',
  components: 'Bauteile',
}

async function authToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function api<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as T
}

function amount(snapshot: InventorySnapshot | null, resource: Resource, available = false) {
  const item = snapshot?.items?.find(row => row.resource === resource)
  return Number(available ? item?.available ?? 0 : item?.amount ?? 0)
}

export default function StationCargoTerminal({ stationSlug, locationId }: { stationSlug: string; locationId: string }) {
  const shipId = useGameStore(s => s.shipId)
  const loadFromServer = useGameStore(s => s.loadFromServer)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [connection, setConnection] = useState<DockingConnection | null>(null)
  const [account, setAccount] = useState<StorageAccount | null>(null)
  const [shipSnapshot, setShipSnapshot] = useState<InventorySnapshot | null>(null)
  const [custodySnapshot, setCustodySnapshot] = useState<InventorySnapshot | null>(null)
  const [offers, setOffers] = useState<MarketOffer[]>([])
  const [resource, setResource] = useState<Resource>('metal')
  const [transferAmount, setTransferAmount] = useState(1)
  const [offerAmount, setOfferAmount] = useState(1)
  const [offerPrice, setOfferPrice] = useState(10)
  const [buyAmounts, setBuyAmounts] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const shipInventory = useMemo(
    () => inventories.find(i => i.subject_type === 'ship' && i.subject_id === shipId && i.storage_kind === 'ship_cargo') ?? null,
    [inventories, shipId],
  )

  const hostInventory = useMemo(() => {
    const depots = inventories.filter(i => i.inventory_kind === 'depot' && i.storage_kind === 'native' && i.public_deposit)
    return depots.find(i => i.metadata?.role === 'storage') ?? depots[0] ?? null
  }, [inventories])

  const refresh = useCallback(async () => {
    if (!shipId || !locationId) return
    const token = await authToken()
    if (!token) return

    const [logistics, docking] = await Promise.all([
      api<{ inventories: Inventory[] }>(`/api/game/logistics?locationId=${encodeURIComponent(locationId)}`, token),
      api<{ connection: DockingConnection | null }>(`/api/game/docking?shipId=${encodeURIComponent(shipId)}`, token),
    ])

    const nextInventories = logistics.inventories ?? []
    setInventories(nextInventories)
    setConnection(docking.connection ?? null)

    const nextShipInventory = nextInventories.find(i => i.subject_type === 'ship' && i.subject_id === shipId && i.storage_kind === 'ship_cargo') ?? null
    const depots = nextInventories.filter(i => i.inventory_kind === 'depot' && i.storage_kind === 'native' && i.public_deposit)
    const nextHost = depots.find(i => i.metadata?.role === 'storage') ?? depots[0] ?? null

    let nextAccount: StorageAccount | null = null
    let nextCustody: InventorySnapshot | null = null
    let nextOffers: MarketOffer[] = []

    if (nextHost) {
      const ensured = await api<{ account: { account: StorageAccount; inventory: InventorySnapshot } }>(
        '/api/game/market', token, {
          method: 'POST',
          body: JSON.stringify({ action: 'ensure-account', hostInventoryId: nextHost.id }),
        },
      )
      nextAccount = ensured.account.account
      nextCustody = ensured.account.inventory
      const market = await api<{ offers: MarketOffer[] }>(
        `/api/game/market?hostInventoryId=${encodeURIComponent(nextHost.id)}&status=open`, token,
      )
      nextOffers = market.offers ?? []
    }

    let nextShipSnapshot: InventorySnapshot | null = null
    if (nextShipInventory) {
      const snapshot = await api<{ inventory: InventorySnapshot }>(
        `/api/game/logistics?inventoryId=${encodeURIComponent(nextShipInventory.id)}`, token,
      )
      nextShipSnapshot = snapshot.inventory
    }

    setAccount(nextAccount)
    setCustodySnapshot(nextCustody)
    setOffers(nextOffers)
    setShipSnapshot(nextShipSnapshot)
  }, [locationId, shipId])

  useEffect(() => {
    setMessage('')
    void refresh().catch(error => setMessage(error instanceof Error ? error.message : 'Cargo-Terminal konnte nicht geladen werden.'))
  }, [refresh, stationSlug])

  const transfer = useCallback(async (direction: 'unload' | 'load') => {
    if (!connection || connection.status !== 'docked' || !shipInventory || !account?.inventory_id) {
      setMessage('Cargo-Transfer benötigt eine aktive physische Docking-Verbindung und ein Verwahrinventar.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const token = await authToken()
      if (!token) throw new Error('Bitte melde dich erneut an.')
      const sourceInventoryId = direction === 'unload' ? shipInventory.id : account.inventory_id
      const targetInventoryId = direction === 'unload' ? account.inventory_id : shipInventory.id
      await api('/api/game/logistics/handover', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'transfer-connected',
          commandId: crypto.randomUUID(),
          connectionId: connection.id,
          sourceInventoryId,
          targetInventoryId,
          resource,
          amount: transferAmount,
        }),
      })
      setMessage(direction === 'unload' ? 'Fracht ins Phobos-Depot übergeben.' : 'Fracht aus dem Phobos-Depot an Bord genommen.')
      await Promise.all([refresh(), loadFromServer()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cargo-Transfer fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [account?.inventory_id, connection, loadFromServer, refresh, resource, shipInventory, transferAmount])

  const createOffer = useCallback(async () => {
    if (!account?.inventory_id) return
    setBusy(true)
    setMessage('')
    try {
      const token = await authToken()
      if (!token) throw new Error('Bitte melde dich erneut an.')
      await api('/api/game/market', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-offer',
          commandId: crypto.randomUUID(),
          sellerInventoryId: account.inventory_id,
          resource,
          amount: offerAmount,
          unitPrice: offerPrice,
        }),
      })
      setMessage('Marktangebot aus physischem Depotbestand eingestellt.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Marktangebot fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [account?.inventory_id, offerAmount, offerPrice, refresh, resource])

  const buyOffer = useCallback(async (offer: MarketOffer) => {
    const requested = Math.max(1, Math.min(buyAmounts[offer.id] ?? 1, offer.amount_remaining))
    setBusy(true)
    setMessage('')
    try {
      const token = await authToken()
      if (!token) throw new Error('Bitte melde dich erneut an.')
      await api('/api/game/market', token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'buy-offer',
          commandId: crypto.randomUUID(),
          offerId: offer.id,
          amount: requested,
        }),
      })
      setMessage('Kauf abgeschlossen. Die Ware liegt jetzt in deiner Phobos-Verwahrung.')
      await Promise.all([refresh(), loadFromServer()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kauf fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [buyAmounts, loadFromServer, refresh])

  if (stationSlug !== 'phobos') return null

  const canTransfer = !!connection && connection.status === 'docked' && !!shipInventory && !!account?.inventory_id
  const maxUnload = amount(shipSnapshot, resource, true)
  const maxLoad = amount(custodySnapshot, resource, true)
  const maxOffer = amount(custodySnapshot, resource, true)

  return (
    <section style={{ marginTop: 12, padding: 12, border: '1px solid #315069', borderRadius: 8, background: '#08141e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: '#c9a961', fontFamily: 'monospace', letterSpacing: '.08em', fontSize: 11 }}>PHOBOS CARGO TERMINAL</strong>
          <div style={{ color: '#7890a4', fontSize: 10, marginTop: 3 }}>Schiff ↔ Docking-Connection ↔ private Verwahrung ↔ lokaler Markt</div>
        </div>
        <span style={{ color: canTransfer ? '#83c99a' : '#e0b060', fontSize: 10 }}>
          {canTransfer ? `physisch verbunden · ${connection?.port_id}` : 'kein Cargo-Handover ohne Docking'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8, marginTop: 10 }}>
        <div style={{ padding: 9, background: '#0b1924', borderRadius: 7 }}>
          <div style={{ color: '#7fb8de', fontSize: 10, fontFamily: 'monospace' }}>SCHIFF</div>
          <div style={{ color: '#d6e2ec', fontSize: 11, marginTop: 4 }}>{shipSnapshot?.label ?? shipInventory?.label ?? 'kein Schiffsinventar'}</div>
          {RESOURCES.map(r => <div key={r} style={{ fontSize: 10, color: '#8aa0b5', marginTop: 2 }}>{LABEL[r]}: {amount(shipSnapshot, r)} t</div>)}
        </div>
        <div style={{ padding: 9, background: '#0b1924', borderRadius: 7 }}>
          <div style={{ color: '#7fb8de', fontSize: 10, fontFamily: 'monospace' }}>PHOBOS-VERWAHRUNG</div>
          <div style={{ color: '#d6e2ec', fontSize: 11, marginTop: 4 }}>{custodySnapshot?.label ?? hostInventory?.label ?? 'kein Depot'}</div>
          {RESOURCES.map(r => <div key={r} style={{ fontSize: 10, color: '#8aa0b5', marginTop: 2 }}>{LABEL[r]}: {amount(custodySnapshot, r)} t · frei {amount(custodySnapshot, r, true)} t</div>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <select value={resource} onChange={e => setResource(e.target.value as Resource)} disabled={busy}>
          {RESOURCES.map(r => <option key={r} value={r}>{LABEL[r]}</option>)}
        </select>
        <input type="number" min={1} value={transferAmount} onChange={e => setTransferAmount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 72 }} disabled={busy} />
        <button disabled={busy || !canTransfer || maxUnload < transferAmount} onClick={() => void transfer('unload')}>Schiff → Depot</button>
        <button disabled={busy || !canTransfer || maxLoad < transferAmount} onClick={() => void transfer('load')}>Depot → Schiff</button>
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #20384b' }}>
        <div style={{ color: '#c9a961', fontSize: 10, fontFamily: 'monospace', marginBottom: 6 }}>MARKTANGEBOT AUS VERWAHRUNG</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#8aa0b5' }}>{LABEL[resource]}</span>
          <input type="number" min={1} value={offerAmount} onChange={e => setOfferAmount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 72 }} disabled={busy} />
          <span style={{ fontSize: 10, color: '#64788a' }}>t zu</span>
          <input type="number" min={1} value={offerPrice} onChange={e => setOfferPrice(Math.max(1, Number(e.target.value) || 1))} style={{ width: 82 }} disabled={busy} />
          <span style={{ fontSize: 10, color: '#64788a' }}>Cr/t</span>
          <button disabled={busy || maxOffer < offerAmount} onClick={() => void createOffer()}>Angebot einstellen</button>
        </div>
        <div style={{ color: '#64788a', fontSize: 9, marginTop: 5 }}>Das Angebot reserviert Ware in deiner Verwahrung; es erzeugt keinen zweiten Bestand.</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #20384b' }}>
        <div style={{ color: '#c9a961', fontSize: 10, fontFamily: 'monospace', marginBottom: 6 }}>OFFENE ANGEBOTE · PHOBOS</div>
        {offers.length === 0 ? <div style={{ fontSize: 10, color: '#64788a' }}>Noch keine physischen Marktangebote an diesem Depot.</div> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {offers.map(offer => {
              const own = offer.seller_profile_id === account?.owner_profile_id
              const qty = Math.max(1, Math.min(buyAmounts[offer.id] ?? 1, offer.amount_remaining))
              return <div key={offer.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '7px 8px', background: '#0b1924', borderRadius: 6 }}>
                <strong style={{ color: '#d6e2ec', fontSize: 10 }}>{LABEL[offer.resource]}</strong>
                <span style={{ color: '#8aa0b5', fontSize: 10 }}>{offer.amount_remaining} t · {offer.unit_price} Cr/t</span>
                {own ? <span style={{ color: '#c9a961', fontSize: 9 }}>dein Angebot</span> : <>
                  <input type="number" min={1} max={offer.amount_remaining} value={qty} onChange={e => setBuyAmounts(old => ({ ...old, [offer.id]: Math.max(1, Math.min(Number(e.target.value) || 1, offer.amount_remaining)) }))} style={{ width: 66 }} disabled={busy} />
                  <button disabled={busy} onClick={() => void buyOffer(offer)}>Kaufen</button>
                </>}
              </div>
            })}
          </div>
        )}
      </div>

      {shipSnapshot && shipSnapshot.totalAmount === 0 && <div style={{ marginTop: 8, fontSize: 9, color: '#64788a' }}>Der angedockte Frachter ist aktuell leer. Es wird bewusst keine Testfracht erzeugt.</div>}
      {message && <div style={{ marginTop: 8, fontSize: 10, color: '#d6e2ec' }}>{message}</div>}
    </section>
  )
}
