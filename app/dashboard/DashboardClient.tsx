'use client'

// app/dashboard/DashboardClient.tsx
// Erstellt:     30.05.2026
// Aktualisiert: 20.07.2026 — Journey→Einweisung, Button-Style, Avatar-Fallback
// Version:      2.20.0

import { useAblyChannel } from '@/lib/ably/client'
import ChatOverlay from './ChatOverlay'
import FriendsDrawer from './FriendsDrawer'
import FoundLocationOverlay from './FoundLocationOverlay'
import ShipWalkable from './ShipWalkable'
import CockpitView from './CockpitView'
import { ABLY_CHANNELS, ABLY_EVENTS } from '@/lib/ably/channels'

import React, { useState, useEffect } from 'react'
import { useGameStore, ResourceType, LocationSlug } from '@/lib/store/gameStore'
import { getToken, getSessionInfo } from '@/lib/supabase/auth'
import TransitPanel from './TransitPanel'
import ColonyGrid from './ColonyGrid'
import StationOverlay from './StationOverlay'
import StationTravelDock from './StationTravelDock'
import ShipyardOverlay from './ShipyardOverlay'
import WarehouseOverlay from './WarehouseOverlay'
import ProfileOverlay from './ProfileOverlay'
import ColonyDetail from './ColonyDetail'
import OrderNegotiation from './OrderNegotiation'
import MarketAuction from './MarketAuction'
import WelcomeSetup from './WelcomeSetup'
import SsfStatusCard from './SsfStatusCard'
import JourneyDrawer from './JourneyDrawer'
import { TipBanner, TipDef } from './TipSystem'
import { attentionItems } from './dashboardStatus'
import { T, Icon, Toast, RESOURCE_LABEL, RESOURCE_ICON, LOC_ICON, LOC_NAME } from './ui'

const SHIP_LABEL: Record<string, string> = {
  freighter_mk1: 'Frachter Mk.I',
  fast_courier: 'Schnellfrachter',
  heavy_hauler: 'Schwerfrachter',
}

function KompetenzBar({ icon, wert, max, farbe }: { icon: string; wert: number; max: number; farbe: string }) {
  const pct = Math.min(100, Math.round((wert / max) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '0.8rem', width: '1.2rem' }}>{icon}</span>
      <div style={{ flex: 1, background: '#e8e4dc', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: farbe, borderRadius: '3px', transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

export default function DashboardClient({ locations: initialLocations, prices, orders: initialOrders }: { locations: any[]; prices: any[]; orders: any[] }) {
  const { credits, cargo, cargoMax, location, buy, sell, travel, cargoUsed, loadFromServer, inTransit, shipTypeId, invalidate, invalidations, shipRange } = useGameStore()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [worldData, setWorldData] = useState<any>(null)
  const [playerBuilds, setPlayerBuilds] = useState<any[]>([])
  const [tileEntities, setTileEntities] = useState<any[]>([])
  const [colonyTax, setColonyTax] = useState<Record<string, any>>({})
  const [entityInfo, setEntityInfo] = useState<Record<string, any>>({})
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [ships, setShips] = useState<any[]>([])
  const [playerStats, setPlayerStats] = useState({ trades: 0, flights: 0, knowledge: 0 })
  const [journeyOpen, setJourneyOpen]           = useState(false)
  const [journeyHints, setJourneyHints]         = useState<string[]>([])
  const [unreadDMs, setUnreadDMs]               = useState(0)
  const [unlocks, setUnlocks]                   = useState<string[]>([])
  const [gates, setGates]                       = useState<Record<string, boolean>>({})
  const [chatWith, setChatWith]                 = useState<{ id: string; username: string } | null>(null)
  const [friends, setFriends]                   = useState<{ id: string; username: string }[]>([])
  const [friendsOpen, setFriendsOpen]           = useState(false)
  const [foundingOpen, setFoundingOpen]         = useState(false)
  const [shipInterior, setShipInterior]         = useState(false)
  const [cockpitOpen, setCockpitOpen]           = useState(false)
  const [journeyDest,  setJourneyDest]          = useState<string | undefined>(undefined)
  const GRID_TILE_SIZE = 64
  const [shipyardOpen, setShipyardOpen] = useState(false)
  const [warehouseOpen, setWarehouseOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [detailColony, setDetailColony] = useState<any>(null)
  const [negotiateOrder, setNegotiateOrder] = useState<any>(null)
  const [auctionOpen, setAuctionOpen] = useState(false)
  const [auctionConfig] = useState<{ resource: ResourceType; mode: 'buy' | 'sell'; qty: number; limit: number }>({ resource: 'water', mode: 'buy', qty: 10, limit: 0 })

  useEffect(() => { loadFromServer() }, [])
  const prevLocationRef = React.useRef(location)
  useEffect(() => { if (prevLocationRef.current !== location) { prevLocationRef.current = location; loadFromServer() } }, [location])
  useEffect(() => { async function fetchWorld() { try { setWorldData(await (await fetch('/api/game/world')).json()) } catch {} } fetchWorld(); const iv = setInterval(fetchWorld, 30000); return () => clearInterval(iv) }, [])

  async function fetchBuilds() {
    try {
      const { token, userId: uid } = await getSessionInfo(); setUserId(uid)
      const data = await (await fetch('/api/game/build', { headers: { Authorization: `Bearer ${token}` } })).json()
      setPlayerBuilds(data.builds ?? []); setTileEntities(data.entities ?? []); setColonyTax(data.colonyTax ?? {}); setEntityInfo(data.entityInfo ?? {})
    } catch {}
  }
  useEffect(() => { fetchBuilds() }, [])
  useEffect(() => { fetchBuilds() }, [invalidations.builds])

  // Unlocks + Feature-Gates laden
  useEffect(() => {
    async function loadUnlocks() {
      try {
        const token = await getToken()
        const res = await fetch('/api/game/unlocks', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json() as { unlocks: string[]; gates: Record<string, boolean> }
        setUnlocks(data.unlocks ?? [])
        setGates(data.gates ?? {})
      } catch {}
    }
    loadUnlocks()
  }, [])

  // Freunde laden
  useEffect(() => {
    async function loadFriends() {
      try {
        const token = await getToken()
        const res = await fetch('/api/game/friends', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json() as { friends: { id: string; username: string }[] }
        setFriends(data.friends ?? [])
      } catch {}
    }
    loadFriends()
  }, [])

  // ── Ably Realtime Subscriptions ─────────────────────────────────────────
  // Preise: neu laden wenn Cron Preise aktualisiert hat
  useAblyChannel(ABLY_CHANNELS.prices, ABLY_EVENTS.prices.updated, () => {
    invalidate('prices')
  })

  // Transaktionen: World-Ticker neu laden
  useAblyChannel(ABLY_CHANNELS.transactions, ABLY_EVENTS.transaction.new, () => {
    // WorldData neu holen für Ticker
    fetch('/api/game/world').then(r => r.json()).then(d => setWorldData(d)).catch(() => {})
  })

  // Eigene Builds: fertige Bauten / Verkäufe
  useAblyChannel(
    userId ? ABLY_CHANNELS.builds(userId) : '',
    ABLY_EVENTS.build.completed,
    () => { invalidate('builds'); showToast('🏗️ Bau abgeschlossen!', true) }
  )
  useAblyChannel(
    userId ? ABLY_CHANNELS.builds(userId) : '',
    ABLY_EVENTS.build.sold,
    () => { invalidate('builds'); showToast('💰 Verkauf abgeschlossen!', true) }
  )

  // Eingehende Direktnachricht
  useAblyChannel(
    userId ? ABLY_CHANNELS.dm(userId) : '',
    ABLY_EVENTS.dm.message,
    (data: any) => {
      setUnreadDMs(n => n + 1)
      showToast(`💬 ${data?.senderUsername ?? 'Jemand'}: ${(data?.content ?? '').slice(0, 40)}${(data?.content ?? '').length > 40 ? '…' : ''}`, false)
    }
  )

  useEffect(() => { async function fetchAll() { try {
    const token = await getToken()
    const [pR, kR, tR, sR] = await Promise.all([
      fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/game/knowledge', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/game/trade?action=getTrades', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/game/ships?action=list', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const pd = await pR.json(); const kd = await kR.json(); const td = await tR.json(); const sd = await sR.json()
    setProfile(pd.profile); const trades = td.trades ?? []
    setPlayerStats({ trades: trades.length, flights: pd.profile?.flight_count ?? 0, knowledge: kd.knowledge_points ?? 0 })
    if (sd.ships) setShips(sd.ships)
  } catch {} } fetchAll() }, [])

  const locations = worldData?.locations ?? initialLocations
  const news = worldData?.news ?? []
  const stats = worldData?.stats
  const worldEntities = (worldData?.entities ?? []).map((e: any) => ({
    ...e,
    actor_name: e.actors?.display_name ?? null,
  }))
  const currentLocationData = locations.find((l: any) => l.slug === location)
  const currentPrices = prices.filter((p: any) => p.locations?.slug === location)
  const used = cargoUsed(); const cargoFree = cargoMax - used
  const attention = attentionItems(locations)
  const totalPop = stats?.totalPopulation ?? locations.reduce((s: number, l: any) => s + l.population, 0)
  // Merge: worldEntities (alle Spieler, alle Standorte) für ColonyGrid
  // tileEntities (build/route) bleibt für eigene pending builds
  const currentLocationId = currentLocationData?.id

  // Merge: worldEntities (alle Spieler, alle Standorte) + tileEntities (eigene + STATE, immer verfügbar)
  // tileEntities ist Basis — immer vorhanden. worldEntities ergänzt fremde Spieler.
  const worldForLocation = worldEntities.filter((e: any) =>
    e.locations?.slug === location ||
    (e.location_id != null && e.location_id === currentLocationId)
  )
  // Merge: worldForLocation als Basis, tileEntities als Fallback wenn world noch leer
  const allEntitiesForLocation = worldForLocation.length > 0
    ? worldForLocation
    : tileEntities.filter((e: any) =>
        e.locations?.slug === location ||
        e.location_id === currentLocationId
      )

  const propertyByLocation: Record<string, number> = {}
  for (const e of tileEntities) { const slug = e.locations?.slug; if (slug && e.profile_id === userId) propertyByLocation[slug] = (propertyByLocation[slug] ?? 0) + 1 }
  const propertySlugs = Array.from(new Set<string>([location, ...Object.keys(propertyByLocation)]))
  const propertyLocations = propertySlugs.map(s => locations.find((l: any) => l.slug === s)).filter(Boolean)
  const best = React.useMemo(() => { let r: { from: string; to: string; resource: string; profit: number } | null = null; const by: Record<string, any[]> = {}; for (const p of prices) { (by[p.resource] ??= []).push(p) } for (const [, ls] of Object.entries(by)) for (const a of ls) for (const b of ls) { if (a.locations?.slug === b.locations?.slug) continue; const profit = b.sell_price - a.buy_price; if (profit > (r?.profit ?? 0)) r = { from: a.locations?.slug, to: b.locations?.slug, resource: a.resource, profit } } return r }, [prices])
  type FeedItem = { type: 'critical' | 'warning' | 'route' | 'news'; icon: string; text: string }
  const feed = React.useMemo((): FeedItem[] => [
    ...attention.map(a => ({ type: a.level === 'critical' ? 'critical' as const : 'warning' as const, icon: a.level === 'critical' ? '🔴' : '🟡', text: a.text })),
    ...(best ? [{ type: 'route' as const, icon: '⚡', text: `Beste Route: ${LOC_NAME[best.from]} → ${LOC_NAME[best.to]} · ${RESOURCE_LABEL[best.resource]} +${best.profit} Cr/t` }] : []),
    ...news.slice(0, 3).map((n: any) => ({ type: 'news' as const, icon: n.icon ?? '📰', text: n.text })),
  ], [attention, best, news])

  function showToast(msg: string, ok: boolean) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2500) }
  async function handleTravel(dest: string) { if (!inTransit) await travel(dest as LocationSlug, stats?.tickNumber ?? 0) }
  async function handleLogout() { const { createClient } = await import('@/lib/supabase/client'); await createClient().auth.signOut(); window.location.href = '/' }
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg }
  const sectionLabel: React.CSSProperties = { fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.4rem' }
  // Journey-Destination-Mapper: welches Reiseziel je Schritt hervorheben?
  const JOURNEY_STEP_DESTINATIONS: Record<string, string> = {
    'moon-2': 'moon',
    'merchant-3': 'mars',
  }

  // Journey-Hint-Mapper: welche entity_ids je Schritt hervorheben?
  const JOURNEY_STEP_HINTS: Record<string, string[]> = {
    'moon-1':   ['shipyard'],
    'moon-2':   [],
    'moon-3':   ['solar', 'ice_drill'],
    'moon-4':   ['habitat'],
    'merchant-1': ['shipyard'],
    'merchant-2': ['warehouse'],
    'research-1': ['school'],
    'research-2': ['school'],
    'industry-1': ['mine', 'solar'],
  }

  const JOURNEY_COMPLETE_MSGS: Record<string, string> = {
    'moon_colony': '🌙 Mondbasis gegründet! Energie und Wasser gesichert. Das Sonnensystem öffnet sich.',
    'merchant':    '📦 Erstes Handelsnetz aufgebaut. Mehr Routen warten auf Sie.',
    'research':    '🔬 Erste Wissensgrundlage gelegt. Die SSF wartet auf weitere Entdeckungen.',
    'industry':    '🏭 Erste Produktion läuft. Der Aufbau beginnt.',
  }

  function handleJourneyCompleted(journeyKey: string) {
    const msg = JOURNEY_COMPLETE_MSGS[journeyKey]
    if (msg) showToast(msg, true)
    // Hints leeren wenn Journey abgeschlossen
    setJourneyHints([])
    setJourneyDest(undefined)
  }

  function handleActiveStepChange(stepId: string | null) {
    const hints = stepId ? (JOURNEY_STEP_HINTS[stepId] ?? []) : []
    const dest  = stepId ? JOURNEY_STEP_DESTINATIONS[stepId] : undefined
    setJourneyHints(hints)
    setJourneyDest(dest)
  }

  const journeyActions = {
    onOpenShipyard: () => { setJourneyOpen(false); setShipyardOpen(true) },
    onOpenWarehouse: () => { setJourneyOpen(false); setWarehouseOpen(true) },
    onOpenTravel: () => { setJourneyOpen(false); window.scrollTo({ top: 70, behavior: 'smooth' }) },
    onFocusGrid: () => { setJourneyOpen(false); window.scrollTo({ top: 120, behavior: 'smooth' }) },
    onOpenAcademyHint: () => { setJourneyOpen(false); showToast('Klicke auf die Akademie im Grid, um Wissen zu sammeln.', true) },
    onActiveStepChange: handleActiveStepChange,
    onStepCompleted: (title: string) => showToast(`✓ Geschafft: ${title}`, true),
    onJourneyCompleted: handleJourneyCompleted,
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      <TransitPanel onArrival={() => {}} />
      {shipInterior && (() => {
        const activeShip = ships.find((s: any) => s.is_active)
        const shipModules = (activeShip?.modules ?? []).map((m: any, i: number) => ({
          slotIndex: m.slot ?? i,
          moduleId:  m.entity_id ?? 'cargo',
          condition: m.condition ?? 100,
          status:    (m.status ?? 'active') as 'active' | 'damaged' | 'disabled',
        }))
        return (
          <ShipWalkable
            frameId={activeShip?.frameId ?? activeShip?.ship_type ?? 'mk1'}
            modules={shipModules}
            credits={credits}
            inTransit={inTransit}
            onClose={() => setShipInterior(false)}
            onCockpit={() => { setShipInterior(false); setCockpitOpen(true) }}
          />
        )
      })()}
      {cockpitOpen && (() => {
        const destLoc = locations.find((l: any) => l.slug !== location)
        return (
          <CockpitView
            inTransit={inTransit}
            progress={0.5}
            originName={currentLocationData?.name ?? location}
            destName={destLoc?.name ?? 'Unbekannt'}
            destType={destLoc?.location_type === 'station' ? 'station' : 'planet'}
            onClose={() => setCockpitOpen(false)}
            onOpenShip={() => { setCockpitOpen(false); setShipInterior(true) }}
          />
        )
      })()}
      {foundingOpen && (
        <FoundLocationOverlay
          credits={credits}
          onClose={() => setFoundingOpen(false)}
          onFounded={(slug, name) => {
            showToast(`🚀 ${name} gegründet!`, true)
            invalidate('world')
          }}
        />
      )}
      <FriendsDrawer
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        onOpenChat={(f) => { setChatWith(f); setFriendsOpen(false) }}
        unreadDMs={unreadDMs}
      />
      {chatWith && (
        <ChatOverlay
          userId={userId ?? ''}
          username={profile?.username ?? ''}
          otherId={chatWith.id}
          otherName={chatWith.username}
          onClose={() => setChatWith(null)}
          onUnreadChange={setUnreadDMs}
        />
      )}
      <JourneyDrawer open={journeyOpen} currentLocation={location} onClose={() => setJourneyOpen(false)} {...journeyActions} onActiveStepChange={handleActiveStepChange} onStepCompleted={(title) => showToast(`✓ Geschafft: ${title}`, true)} onJourneyCompleted={handleJourneyCompleted} />
      {profile && !profile.onboarded && <WelcomeSetup onDone={(opts) => { if (opts?.openJourney) setJourneyOpen(true); window.location.reload(); }} />}
      {/* gates verfügbar für: gates.bankCredit, gates.spectralSensor etc. */}
      {auctionOpen && <MarketAuction open={auctionOpen} onClose={() => setAuctionOpen(false)} location={location as LocationSlug} locationName={currentLocationData?.name ?? LOC_NAME[location]} rows={currentPrices.map((p: any) => ({ resource: p.resource, buy_price: p.buy_price, sell_price: p.sell_price, stock: currentLocationData?.location_resources?.find((r: any) => r.resource === p.resource)?.stock ?? 100 }))} credits={credits} cargo={cargo} cargoMax={cargoMax} initialResource={auctionConfig.resource} initialMode={auctionConfig.mode} initialQty={auctionConfig.qty} playerLimit={auctionConfig.limit} onTrade={async (resource, mode, amount, price) => { const result = mode === 'buy' ? await buy(resource, price, amount) : await sell(resource, price, amount); showToast(result.msg, result.ok); return result.ok }} />}
      {warehouseOpen && <WarehouseOverlay locationSlug={location as LocationSlug} locationName={currentLocationData?.name ?? LOC_NAME[location]} prices={prices} resources={currentLocationData?.location_resources ?? []} orders={initialOrders.filter((o: any) => o.locations?.slug === location)} cargo={cargo} cargoMax={cargoMax} credits={credits} onTrade={async (resource, mode, amount, price) => { const result = mode === 'buy' ? await buy(resource, price, amount) : await sell(resource, price, amount); showToast(result.msg, result.ok); return result.ok }} onFulfillOrder={async (orderId, agreedReward) => { const token = await getToken(); const data = await (await fetch(`/api/game/orders?action=fulfill&orderId=${orderId}&agreedReward=${Math.round(agreedReward)}`, { headers: { Authorization: `Bearer ${token}` } })).json(); if (data.ok) { showToast(`Auftrag erfüllt! +${data.reward?.toLocaleString('de')} Cr`, true); await loadFromServer() } else showToast(data.error, false); return data.ok }} onClose={() => setWarehouseOpen(false)} />}
      {profileOpen && profile && <ProfileOverlay username={profile.username ?? '?'} avatar={profile.avatar ?? 'pilot_01'} credits={credits} onClose={() => setProfileOpen(false)} />}
      <ColonyDetail colony={detailColony} isHere={detailColony?.slug === location} cargo={cargo} onClose={() => setDetailColony(null)} onTravel={handleTravel} />
      <ShipyardOverlay open={shipyardOpen} onClose={() => setShipyardOpen(false)} currentShipTypeId={shipTypeId ?? 'freighter_mk1'} credits={credits} onBuyShip={async (type) => { const token = await getToken(); const data = await (await fetch(`/api/game/ships?action=buy&shipTypeId=${type}`, { headers: { Authorization: `Bearer ${token}` } })).json(); if (data.ok) { showToast(`${type} gekauft!`, true); await loadFromServer(); setShipyardOpen(false) } else showToast(data.error ?? 'Kauf fehlgeschlagen', false) }} />
      <OrderNegotiation order={negotiateOrder ? { ...negotiateOrder, stock: currentLocationData?.location_resources?.find((r: any) => r.resource === negotiateOrder.resource)?.stock } : null} onClose={() => setNegotiateOrder(null)} canFulfill={negotiateOrder?.locations?.slug === location && (cargo[negotiateOrder?.resource as ResourceType] ?? 0) >= negotiateOrder?.amount} fulfillHint={negotiateOrder?.locations?.slug !== location ? 'Falscher Standort.' : 'Nicht genug Ladung.'} onAccept={async (id, bonus) => { const token = await getToken(); const data = await (await fetch(`/api/game/orders?action=fulfill&orderId=${id}&agreedReward=${Math.round(bonus)}`, { headers: { Authorization: `Bearer ${token}` } })).json(); if (data.ok) { showToast(`Auftrag erfüllt! +${data.reward?.toLocaleString('de')} Cr`, true); await loadFromServer() } else showToast(data.error, false); return data.ok }} />

      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: '0 2rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1200, flexShrink: 0, boxShadow: '0 1px 8px rgba(27,39,51,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.14em', color: T.blue, fontSize: '1.3rem', margin: 0 }}>noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ<span style={{ fontSize: '0.5rem', letterSpacing: '0.3em', color: T.gold, marginLeft: '1rem', verticalAlign: 'middle', textTransform: 'uppercase' }}>Alpha 0.1</span></h1>
          <button onClick={() => setJourneyOpen(true)} style={{ background: 'transparent', color: T.blueDeep, border: `1px solid ${T.line}`, borderRadius: T.radius, padding: '0.45rem 0.8rem', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' }}>☰ Einweisung</button>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {([['Credits', `${credits.toLocaleString('de')} Cr`], ['Frachter', `${used} / ${cargoMax} t`], ['Standort', `${LOC_ICON[location] ?? '🪐'} ${LOC_NAME[location] ?? location}`], ['Bevölkerung', totalPop.toLocaleString('de')]] as [string,string][]).map(([l, v], i) => <div key={i}><div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>{l}</div><div style={{ fontWeight: 700, color: T.blue, fontSize: '0.88rem', marginTop: '2px' }}>{v}</div></div>)}
          <button onClick={() => setFoundingOpen(true)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', color: T.inkSoft, fontSize: '0.78rem' }}>
            🚀 Gründen
          </button>
          <button onClick={() => setFriendsOpen(true)} style={{ position: 'relative', background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', color: T.inkSoft, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            💬 Freunde
            {unreadDMs > 0 && <span style={{ background: '#e05050', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: '0.6rem', fontWeight: 700 }}>{unreadDMs > 9 ? '9+' : unreadDMs}</span>}
          </button>
          <button onClick={() => setProfileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: T.blue, border: `2px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', overflow: 'hidden' }}>{(profile?.avatar || 'pilot_01') ? <img src={`/images/avatars/${profile?.avatar ?? 'pilot_01'}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} /> : (profile?.username?.[0]?.toUpperCase() ?? '?')}</div></button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: T.radius, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.logout(T.blue)} Abmelden</button>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: '1800px', width: '100%', margin: '0 auto', padding: '1.25rem 1.5rem 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {(() => { const localEntities = tileEntities.filter((e: any) => e.locations?.slug === location); const hasSchool = localEntities.some((e: any) => e.entity_id === 'school'); const hasAdmin = localEntities.some((e: any) => e.entity_id === 'admin'); const ownBuilds = tileEntities.filter((e: any) => e.profile_id === userId).length; const tips: TipDef[] = [{ id: 'tip_energy', icon: '⚡', condition: cargo.energy === 0 && !inTransit, text: 'Keine Energie an Bord. Klicke auf das Warenhaus im Grid um Energie zu kaufen.' }, { id: 'tip_school', icon: '🎓', condition: hasSchool, text: 'Klicke auf die Akademie im Grid um Wissen und SSF-Module zu öffnen.' }, { id: 'tip_admin', icon: '🏛️', condition: hasAdmin, text: 'Klicke auf die Verwaltung im Grid für Koloniedetails und Aufträge.' }, { id: 'tip_build', icon: '🏗️', condition: ownBuilds === 0, text: 'Noch keine Gebäude. Klicke auf eine freie Kachel im Grid um zu bauen.' }]; return <TipBanner tips={tips} /> })()}
          {currentLocationData?.location_type === 'station' || location === 'prometheus' ? <><StationTravelDock journeyDestination={journeyDest} currentLocation={location} locations={locations.filter((l: any) => l.slug !== location)} cargo={cargo as unknown as Record<string, number>} shipRange={shipRange} currentTick={stats?.tickNumber ?? 0} inTransit={inTransit} onTravel={handleTravel} /><StationOverlay slug={location} name={currentLocationData?.name ?? 'Station'} population={currentLocationData?.population ?? 0} populationMax={currentLocationData?.population_max ?? 1} userId={userId} locationId={currentLocationData?.id ?? ''} locationResources={currentLocationData?.location_resources ?? []} credits={credits} entities={tileEntities.filter((e: any) => e.locations?.slug === location)} onChanged={async () => { await loadFromServer(); invalidate('builds') }} onOpenWarehouse={() => setWarehouseOpen(true)} /></> : <ColonyGrid gates={gates} highlightEntityIds={journeyHints} slug={location} name={currentLocationData?.name ?? location} population={currentLocationData?.population ?? 0} populationMax={currentLocationData?.population_max ?? 1} isSupplied={currentLocationData?.is_supplied ?? false} userId={userId} tax={colonyTax[currentLocationData?.id ?? '']} entityInfo={entityInfo} locationResources={currentLocationData?.location_resources ?? []} entities={allEntitiesForLocation.length > 0 ? allEntitiesForLocation : tileEntities.filter((e: any) => e.locations?.slug === location || e.location_id === currentLocationData?.id)} credits={credits} allLocations={locations.filter((l: any) => l.slug !== location)} cargo={cargo as unknown as Record<string, number>} shipRange={shipRange} currentTick={stats?.tickNumber ?? 0} inTransit={inTransit} onTravel={handleTravel} onOpenShipyard={() => setShipyardOpen(true)} onOpenWarehouse={() => setWarehouseOpen(true)} onChanged={async () => { await loadFromServer(); invalidate('builds') }} tileSize={GRID_TILE_SIZE} pending={playerBuilds.filter((b: any) => b.locations?.slug === location).map((b: any) => ({ buildable_id: b.buildable_id, tile_row: b.tile_row, tile_col: b.tile_col, status: b.status }))} />}
          <div><div style={sectionLabel}>Deine Orte</div><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{propertyLocations.map((loc: any) => { const isHere = loc.slug === location; return <div key={loc.id} onClick={() => setDetailColony(loc)} style={{ ...card, padding: '0.55rem 0.9rem', cursor: 'pointer', borderLeft: `3px solid ${isHere ? T.gold : T.blue}`, minWidth: '110px' }}><div style={{ fontWeight: 700, fontSize: '0.8rem', color: T.blueDeep, display: 'flex', alignItems: 'center', gap: '4px' }}>{LOC_ICON[loc.slug] ?? '🪐'} {LOC_NAME[loc.slug] ?? loc.slug}{isHere && <span style={{ fontSize: '0.46rem', background: T.gold, color: '#fff', borderRadius: '3px', padding: '1px 4px' }}>HIER</span>}</div><div style={{ fontSize: '0.65rem', color: T.inkFaint, marginTop: '2px' }}>{(propertyByLocation[loc.slug] ?? 0) > 0 ? `${propertyByLocation[loc.slug]} Gebäude` : 'kein Gebäude'}</div></div> })}</div></div>
          {ships.length > 0 && <div><div style={sectionLabel}>Deine Schiffe</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>{ships.map((s: any) => <div key={s.id} onClick={() => setShipyardOpen(true)} style={{ ...card, padding: '0.55rem 0.9rem', cursor: 'pointer', borderLeft: `3px solid ${s.is_active ? T.gold : T.line}` }}><div style={{ fontWeight: 700, fontSize: '0.75rem', color: T.blueDeep, display: 'flex', justifyContent: 'space-between' }}><span>🚀 {SHIP_LABEL[s.ship_type_id] ?? s.ship_type_id}</span>{s.is_active && <span style={{ fontSize: '0.4rem', background: T.gold, color: '#fff', borderRadius: '3px', padding: '1px 4px', whiteSpace: 'nowrap' as const }}>AKTIV</span>}</div><div style={{ fontSize: '0.6rem', color: T.inkFaint, marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span>{LOC_ICON[s.location] ?? '🪐'} {LOC_NAME[s.location] ?? s.location}</span><span>{s.cargo_max}t</span></div></div>)}</div></div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'sticky', top: '76px', height: 'calc(100vh - 90px)' }}>
          <div style={{ ...card, padding: '0.9rem 1rem', cursor: 'pointer', flexShrink: 0 }} onClick={() => setProfileOpen(true)}><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}><div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${T.gold}`, overflow: 'hidden', flexShrink: 0, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={`/images/avatars/${profile?.avatar ?? 'pilot_01'}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: '0.9rem', color: T.blueDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{profile?.username ?? '…'}</div><div style={{ fontSize: '0.62rem', color: T.inkFaint, marginTop: '1px' }}>{credits.toLocaleString('de')} Cr · 🧠 {playerStats.knowledge} Wissen</div></div><span style={{ fontSize: '0.65rem', color: T.inkFaint }}>→</span></div><div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}><KompetenzBar icon="⚖️" wert={playerStats.trades} max={200} farbe={T.gold} /><KompetenzBar icon="🚀" wert={playerStats.flights} max={75} farbe="#5aaeff" /><KompetenzBar icon="🧠" wert={playerStats.knowledge} max={2000} farbe="#b48ce8" /></div><div style={{ fontSize: '0.58rem', color: T.inkFaint, marginTop: '0.4rem', textAlign: 'center' }}>Klick für Vollprofil & Kompetenzen</div></div>
          <SsfStatusCard />
          <div style={{ ...card, padding: '0.85rem 1rem', flexShrink: 0 }}><div style={sectionLabel}>An Bord · {SHIP_LABEL[shipTypeId ?? ''] ?? shipTypeId ?? 'Schiff'}</div><div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '0.4rem' }}>{used > 0 ? (Object.entries(cargo) as [ResourceType, number][]).filter(([, v]) => v > 0).map(([res, amt]) => <div key={res} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}><span>{RESOURCE_ICON[res]} {RESOURCE_LABEL[res]}</span><span style={{ fontWeight: 700, color: T.blue }}>{amt}t</span></div>) : <span style={{ fontSize: '0.72rem', color: T.inkFaint }}>Laderaum leer</span>}</div><div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: `1px solid ${T.lineSoft}`, fontSize: '0.65rem', color: T.inkFaint, display: 'flex', justifyContent: 'space-between' }}><span>Frei</span><span style={{ fontWeight: 600 }}>{cargoFree}t / {cargoMax}t</span></div></div>
          <div style={{ ...card, padding: '0.85rem 1rem', flex: 1, overflowY: 'auto', minHeight: 0 }}><div style={sectionLabel}>Feed</div>{feed.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '4rem' }}><span style={{ fontSize: '0.65rem', color: T.inkFaint }}>Die Kolonie ist ruhig.</span></div>}<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '0.35rem' }}>{feed.map((item, i) => <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', fontSize: '0.72rem', color: item.type === 'critical' ? T.red : item.type === 'warning' ? '#c07020' : T.inkSoft, paddingBottom: i < feed.length - 1 ? '5px' : 0, borderBottom: i < feed.length - 1 ? `1px solid ${T.lineSoft}` : 'none' }}><span style={{ flexShrink: 0, marginTop: '1px' }}>{item.icon}</span><span style={{ lineHeight: 1.4 }}>{item.text}</span></div>)}</div></div>
        </div>
      </div>
      <footer style={{ borderTop: `1px solid ${T.line}`, marginTop: '2rem', padding: '0.65rem 2rem', display: 'flex', justifyContent: 'center', gap: '2rem', alignItems: 'center', background: T.surface, flexShrink: 0 }}>{([['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Nutzungsbedingungen', '/nutzungsbedingungen'], ['Kontakt', 'mailto:info@noxiagame.com']] as [string,string][]).map(([label, href]) => <a key={label} href={href} style={{ fontSize: '0.62rem', color: T.inkFaint, textDecoration: 'none' }}>{label}</a>)}<span style={{ fontSize: '0.62rem', color: T.inkFaint }}>· © 2026 Thomas Küper · noχ¹ᐃ Alpha 0.1</span></footer>
    </div>
  )
}
