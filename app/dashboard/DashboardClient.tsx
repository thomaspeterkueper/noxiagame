// app/dashboard/DashboardClient.tsx
// Erstellt:     30.05.2026
// Aktualisiert: 07.06.2026
// Version:      0.3.0
//
// Haupt-Client-Komponente des Dashboards. Drei Tabs:
//   1. Übersicht   – Standort, Kolonien, Welt, Handel, Aufträge (verschlankt)
//   2. Statistiken – Handelshistorie, Wochenchart, Erfolge
//   3. Kolonien    – Kachelgrid pro Kolonie mit Bausystem
//
// v0.3.0: Cargo-Loop-Fix – handleBuy/handleSell buchen die ganze Menge in
// EINEM API-Call (Store: buy/sell mit amount-Parameter, Route bucht atomar
// mit Teilbuchung). Die 1t-for-Schleife ist entfernt.
// v0.2.0: Visuell verfeinert (hell, mehr Raum, klarere Typo). Schwere Inline-Blöcke
// in vier Aufruf-Overlays ausgelagert:
//   - MarketAuction     (Live-Auktion, ⚡-Button in der Handelszentrale)
//   - OrderNegotiation  (Auftrags-Verhandlung statt sofortigem Erfüllen)
//   - ColonyDetail      (Klick auf Kolonie-Karte → Detailansicht)
//   - ShipyardOverlay   (Werft als betretbarer Ort, nur auf Mond)
//
// Auth: Bearer Token aus Supabase-Session bei allen API-Calls.
// State: Zustand-Store (gameStore). Weltdaten alle 30s von /api/game/world.

'use client'

import { useState, useEffect } from 'react'
import { useGameStore, ResourceType, LocationSlug } from '@/lib/store/gameStore'
import TransitPanel from './TransitPanel'
import StatisticsTab from './StatisticsTab'
import ColonyGrid from './ColonyGrid'
import ColonyStats from './ColonyStats'
import ShipyardCard from './ShipyardCard'
import ShipHeader from './ShipHeader'
import MarketAuction from './MarketAuction'
import OrderNegotiation from './OrderNegotiation'
import ColonyDetail from './ColonyDetail'
import ShipyardOverlay from './ShipyardOverlay'
import WelcomeSetup from './WelcomeSetup'

// ─── Konstanten ────────────────────────────────────────────────────────────────
const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON:       Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }
const LOC_NAME:       Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }
const [profile, setProfile] = useState<any>(null)

// ─── Design-Tokens ───────────────────────────────────────────────────────────
// Zentralisierte Farben/Maße für konsistente, verfeinerte Optik.
const T = {
  ink:      '#1b2733',   // Haupttext
  inkSoft:  '#5a6b7b',   // Sekundärtext
  inkFaint: '#94a3b8',   // Labels, Hinweise
  blue:     '#2a4e7a',   // Primär (Marke)
  blueDeep: '#1d3a5f',
  gold:     '#b99b6b',   // Akzent (Marke, etwas gedämpfter fürs Helle)
  goldHot:  '#c9a961',
  bg:       '#f4f2ed',   // Warmweiß-Hintergrund
  surface:  '#ffffff',
  line:     '#e7e2d8',   // feine Trennlinie
  lineSoft: '#f0ece3',
  green:    '#2f9e6b',
  red:      '#c0563f',
  radius:   '10px',
  radiusLg: '14px',
}

// ─── Inline-SVG-Icons (schlank, fürs UI) ─────────────────────────────────────
const Icon = {
  trade: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg>,
  bolt:  (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  ship:  (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18M5 17l1-5h12l1 5M9 12V7h6v5M11 7V4h2v3"/></svg>,
  globe: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeLinecap="round"/></svg>,
  chart: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  arrow: (c = 'currentColor') => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  logout:(c = 'currentColor') => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  alert: (c = 'currentColor') => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
}

// ─── Bearer Token aus Supabase-Session ───────────────────────────────────────
async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
      background: ok ? T.blue : T.red, color: '#fff', padding: '0.7rem 1.6rem',
      borderRadius: T.radius, fontSize: '0.82rem', fontWeight: 600, zIndex: 3000,
      boxShadow: '0 8px 24px rgba(27,39,51,0.18)', letterSpacing: '0.01em',
    }}>{msg}</div>
  )
}

// ─── Kleine Bausteine ─────────────────────────────────────────────────────────
// Abschnitts-Überschrift mit Georgia-Akzent + optionaler Aktion rechts.
function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: '1.05rem', color: T.blueDeep, margin: 0, letterSpacing: '0.01em' }}>{title}</h2>
      {action}
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function DashboardClient({
  locations: initialLocations,
  prices,
  orders: initialOrders,
}: {
  locations: any[]
  prices:    any[]
  orders:    any[]
}) {
  const {
    credits, cargo, cargoMax, location, buy, sell, travel,
    cargoUsed, loaded, loadFromServer, inTransit, shipTypeId,
  } = useGameStore()

  // UI-State
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics' | 'colonies'>('dashboard')
  const [worldData, setWorldData] = useState<any>(null)
  const [playerBuilds, setPlayerBuilds] = useState<any[]>([])
  const [tileEntities, setTileEntities] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')

  // Overlay-State
  const [auctionOpen, setAuctionOpen]       = useState(false)
  const [auctionConfig, setAuctionConfig]   = useState<{ resource: ResourceType; mode: 'buy' | 'sell'; qty: number }>({ resource: 'water', mode: 'buy', qty: 10 })
  const [negotiateOrder, setNegotiateOrder] = useState<any>(null)
  const [detailColony, setDetailColony]     = useState<any>(null)
  const [shipyardOpen, setShipyardOpen]     = useState(false)

  // ── Spielstand laden ────────────────────────────────────────────────────────
  useEffect(() => { if (!loaded) loadFromServer() }, [])

  // ── Weltdaten alle 30s ──────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchWorld() {
      try {
        const res  = await fetch('/api/game/world')
        setWorldData(await res.json())
      } catch (err) { console.error('world fetch error:', err) }
    }
    fetchWorld()
    const interval = setInterval(fetchWorld, 30000)
    return () => clearInterval(interval)
  }, [])

  // ── Spieler-Builds + Bestand laden ─────────────────────────────────────────
  async function fetchBuilds() {
    try {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? '')

      const token = session?.access_token ?? null
      const res   = await fetch('/api/game/build', { headers: { 'Authorization': `Bearer ${token}` } })
      const data  = await res.json()
      setPlayerBuilds(data.builds ?? [])
      setTileEntities(data.entities ?? [])
    } catch (err) { console.error('build fetch error:', err) }
  }
  useEffect(() => { if (activeTab === 'colonies') fetchBuilds() }, [activeTab])

async function fetchProfile() {
  try {
    const token = await getToken()
    const res = await fetch('/api/game/profile', { headers: { 'Authorization': `Bearer ${token}` } })
    const data = await res.json()
    setProfile(data.profile)
  } catch (err) { console.error('profile fetch error:', err) }
}
useEffect(() => { fetchProfile() }, [])

  
  // ── Abgeleitete Daten ───────────────────────────────────────────────────────
  const locations    = worldData?.locations ?? initialLocations
  const news         = worldData?.news ?? []
  const stats        = worldData?.stats
  const transactions = worldData?.transactions ?? []

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 2500)
  }

  // ── Handel ──────────────────────────────────────────────────────────────────
  // v0.3.0: ganze Menge in EINEM API-Call (Cargo-Loop-Fix). Der Server bucht
  // atomar und ggf. eine Teilmenge; result.msg enthält die korrekte Anzeige.
  async function handleBuy(resource: ResourceType, price: number, amount: number) {
    const result = await buy(resource, price, amount)
    showToast(result.msg, result.ok)
  }
  async function handleSell(resource: ResourceType, price: number, amount: number) {
    const result = await sell(resource, price, amount)
    showToast(result.msg, result.ok)
  }

  // Öffnet die Auktion mit Ressource, Rolle (Kauf/Verkauf) und Menge aus der Handelszentrale.
  function openAuction(resource: ResourceType, mode: 'buy' | 'sell', qty: number) {
    setAuctionConfig({ resource, mode, qty: Math.max(1, qty) })
    setAuctionOpen(true)
  }

  async function handleTravel(dest: LocationSlug) { if (!inTransit) await travel(dest) }

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  async function handleFulfillOrder(orderId: string, agreedReward?: number) {
    const token = await getToken()
    const url   = `/api/game/orders?action=fulfill&orderId=${orderId}` +
      (agreedReward != null ? `&agreedReward=${Math.round(agreedReward)}` : '')
    const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    const data  = await res.json()
    if (data.ok) { showToast(`Auftrag erfüllt! +${data.reward.toLocaleString('de')} Cr`, true); await loadFromServer() }
    else showToast(data.error, false)
  }

  // ── Berechnungen ──────────────────────────────────────────────────────────
  const currentPrices       = prices.filter((p: any) => p.locations?.slug === location)
  const otherLocations      = locations.filter((l: any) => l.slug !== location)
  const currentLocationData = locations.find((l: any) => l.slug === location)
  const used                = cargoUsed()
  const cargoFreeSpace      = cargoMax - used
  const suppliedCount       = locations.filter((l: any) => l.is_supplied).length
  const totalPop            = stats?.totalPopulation ?? locations.reduce((s: number, l: any) => s + l.population, 0)

  let best: { from: string; to: string; resource: string; profit: number } | null = null
  const byResource: Record<string, any[]> = {}
  for (const p of prices) { (byResource[p.resource] ??= []).push(p) }
  for (const [, locs] of Object.entries(byResource)) {
    for (const a of locs) for (const b of locs) {
      if (a.locations?.slug === b.locations?.slug) continue
      const profit = b.sell_price - a.buy_price
      if (profit > (best?.profit ?? 0)) best = { from: a.locations?.slug, to: b.locations?.slug, resource: a.resource, profit }
    }
  }

  // ── Wiederverwendbare Styles ────────────────────────────────────────────────
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg }
  const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.blue, color: '#fff', border: 'none', padding: '0.5rem 0.95rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: T.radius, cursor: 'pointer' }
  const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.5rem 0.95rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: T.radius, cursor: 'pointer' }
  const metricLabel: React.CSSProperties = { fontSize: '0.6rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      <TransitPanel onArrival={() => {}} />


{profile && !profile.onboarded && (
  <WelcomeSetup onDone={() => { fetchProfile(); window.location.reload() }} />
)}
      
      {/* Overlays */}
      <MarketAuction
        open={auctionOpen}
        onClose={() => setAuctionOpen(false)}
        location={location as LocationSlug}
        locationName={currentLocationData?.name ?? LOC_NAME[location]}
        rows={currentPrices.map((p: any) => ({
          resource: p.resource, buy_price: p.buy_price, sell_price: p.sell_price,
          stock: currentLocationData?.location_resources?.find((r: any) => r.resource === p.resource)?.stock ?? 100,
        }))}
        credits={credits} cargo={cargo} cargoMax={cargoMax}
        initialResource={auctionConfig.resource}
        initialMode={auctionConfig.mode}
        initialQty={auctionConfig.qty}
        onTrade={async (resource, m, amount, price) => {
          if (m === 'buy') await handleBuy(resource, price, amount)
          else await handleSell(resource, price, amount)
          return true
        }}
      />
      <OrderNegotiation
        order={negotiateOrder ? { ...negotiateOrder, stock: currentLocationData?.location_resources?.find((r: any) => r.resource === negotiateOrder.resource)?.stock } : null}
        onClose={() => setNegotiateOrder(null)}
        canFulfill={negotiateOrder?.locations?.slug === location && cargo[negotiateOrder?.resource as ResourceType] >= negotiateOrder?.amount}
        fulfillHint={negotiateOrder?.locations?.slug !== location ? 'Falscher Standort — hierhin fliegen.' : 'Nicht genug Ladung an Bord.'}
        onAccept={async (id, bonus) => { await handleFulfillOrder(id, bonus); return true }}
      />
      <ColonyDetail
        colony={detailColony}
        isHere={detailColony?.slug === location}
        cargo={cargo}
        onClose={() => setDetailColony(null)}
        onTravel={(dest) => handleTravel(dest)}
      />
      <ShipyardOverlay
        open={shipyardOpen}
        onClose={() => setShipyardOpen(false)}
        currentShipTypeId={shipTypeId ?? 'freighter_mk1'}
        credits={credits}
        onBuyShip={async (type) => {
          const token = await getToken()
          const res = await fetch(`/api/game/ships?action=buy&shipTypeId=${type}`, { headers: { 'Authorization': `Bearer ${token}` } })
          const data = await res.json()
          if (data.ok) { showToast(`${type} gekauft!`, true); await loadFromServer(); setShipyardOpen(false) }
          else showToast(data.error ?? 'Kauf fehlgeschlagen', false)
        }}
      />

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: '0 2.5rem', height: '66px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.14em', color: T.blue, fontSize: '1.4rem', margin: 0 }}>
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          <span style={{ fontSize: '0.5rem', letterSpacing: '0.3em', color: T.gold, marginLeft: '1rem', verticalAlign: 'middle', textTransform: 'uppercase' }}>Alpha 0.1</span>
        </h1>
        <div style={{ display: 'flex', gap: '2.2rem', alignItems: 'center' }}>
          {[
            ['Credits', `${credits.toLocaleString('de')} Cr`, T.blue],
            ['Frachter', `${used} / ${cargoMax} t`, used > 0 ? T.blue : T.inkFaint],
            ['Standort', `${LOC_ICON[location]} ${LOC_NAME[location]}`, T.blue],
            ['Bevölkerung', totalPop.toLocaleString('de'), T.blue],
          ].map(([l, v, c], i) => (
            <div key={i}>
              <div style={metricLabel}>{l}</div>
              <div style={{ fontWeight: 700, color: c as string, fontSize: '0.92rem', marginTop: '2px' }}>{v}</div>
            </div>
          ))}
         {profile?.avatar && (
  <img src={`/images/avatars/${profile.avatar}.png`} alt=""
    style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${T.gold}` }} />
)}
          <button style={btnGhost} onClick={handleLogout}>{Icon.logout(T.blue)} Abmelden</button>
        </div>
      </header>

      {/* ── TICKER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: T.blue, color: '#fff', padding: '0.55rem 2.5rem' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'flex', gap: '2.5rem', fontSize: '0.76rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {news.length > 0
            ? news.map((n: any, i: number) => <span key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>{n.icon} {n.text}</span>)
            : <span style={{ opacity: 0.85 }}>🟢 Sonnensystem stabil</span>}
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: '0 2.5rem' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'flex', gap: '0.5rem' }}>
          {[
            { id: 'dashboard',  label: 'Übersicht',   icon: Icon.trade },
            { id: 'statistics', label: 'Statistiken', icon: Icon.chart },
            { id: 'colonies',   label: 'Kolonien',    icon: Icon.globe },
          ].map(tab => {
            const on = activeTab === tab.id
            return (
              <button key={tab.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '0.9rem 1.1rem', border: 'none', background: 'none', fontSize: '0.82rem', fontWeight: on ? 700 : 500, color: on ? T.blue : T.inkFaint, borderBottom: on ? `2px solid ${T.gold}` : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}
                onClick={() => setActiveTab(tab.id as any)}>
                {tab.icon(on ? T.blue : T.inkFaint)} {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── INHALT ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>

        {activeTab === 'statistics' && <StatisticsTab locations={locations} />}

        {activeTab === 'colonies' && (
          <div>
            <ColonyStats locations={locations} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1.5rem' }}>
              {locations.map((loc: any) => (
                <ColonyGrid key={loc.id} slug={loc.slug} name={loc.name}
                  population={loc.population} populationMax={loc.population_max} isSupplied={loc.is_supplied}
                  userId={userId}
                  entities={tileEntities.filter((e: any) => e.locations?.slug === loc.slug)}
                  pending={playerBuilds
                    .filter((b: any) => b.locations?.slug === loc.slug)
                    .map((b: any) => ({
                      buildable_id: b.buildable_id,
                      tile_row:     b.tile_row,
                      tile_col:     b.tile_col,
                      status:       b.status,
                    }))}
                  onChanged={fetchBuilds}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* Standort-Header */}
            <div style={{ marginBottom: '2rem', borderRadius: T.radiusLg, overflow: 'hidden' }}>
              <ShipHeader
                location={location as 'moon' | 'mars' | 'phobos'}
                locationName={currentLocationData?.name ?? LOC_NAME[location]}
                locationDesc={currentLocationData?.description ?? ''}
                shipType={(shipTypeId ?? 'freighter_mk1') as any}
                credits={credits} inTransit={inTransit}
              />
            </div>

            {/* Frachtstatus */}
            {used > 0 && (
              <div style={{ ...card, padding: '0.85rem 1.4rem', marginBottom: '2rem', display: 'flex', gap: '1.8rem', alignItems: 'center' }}>
                <span style={metricLabel}>An Bord</span>
                {(Object.entries(cargo) as [ResourceType, number][]).filter(([, v]) => v > 0).map(([res, amt]) => (
                  <span key={res} style={{ fontSize: '0.88rem', fontWeight: 600, color: T.blue }}>{RESOURCE_ICON[res]} {RESOURCE_LABEL[res]} {amt}t</span>
                ))}
                <div style={{ marginLeft: 'auto', background: T.bg, borderRadius: '999px', padding: '0.25rem 0.8rem', fontSize: '0.72rem', color: T.inkSoft }}>{cargoFreeSpace}t frei</div>
              </div>
            )}

            {/* Kolonien + Welt */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <SectionHead title="Kolonien" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {locations.map((loc: any) => {
                    const popPct = Math.round((loc.population / loc.population_max) * 100)
                    const isHere = loc.slug === location
                    const accent = isHere ? T.gold : loc.is_supplied ? T.green : T.red
                    return (
                      <div key={loc.id} onClick={() => setDetailColony(loc)}
                        style={{ ...card, padding: '1.1rem 1.35rem', borderLeft: `3px solid ${accent}`, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto auto', alignItems: 'center', gap: '1.1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: T.blueDeep, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                              {isHere && <span style={{ fontSize: '0.52rem', background: T.gold, color: '#fff', borderRadius: '4px', padding: '2px 6px', letterSpacing: '0.05em' }}>HIER</span>}
                            </div>
                            <div style={{ fontSize: '0.66rem', color: T.inkFaint, marginTop: '2px' }}>{loc.name}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: T.inkFaint, marginBottom: '0.3rem' }}>
                              <span>Bevölkerung</span><span style={{ color: T.ink }}>{loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}</span>
                            </div>
                            <div style={{ background: T.lineSoft, height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${popPct}%`, height: '100%', background: isHere ? T.gold : T.blue }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.72rem', color: T.inkSoft }}>
                            {(loc.location_resources ?? []).map((r: any) => {
                              const bal = r.production - r.consumption
                              return (
                                <span key={r.resource}>{RESOURCE_ICON[r.resource]} {r.stock}t
                                  <span style={{ color: bal >= 0 ? T.green : T.red, marginLeft: '3px', fontSize: '0.64rem' }}>({bal >= 0 ? '+' : ''}{bal})</span>
                                </span>
                              )
                            })}
                          </div>
                          <div style={{ color: loc.is_supplied ? T.green : T.red, display: 'flex' }}>
                            {loc.is_supplied ? Icon.arrow(T.green) : Icon.alert(T.red)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <SectionHead title="Weltentwicklung" />
                <div style={{ ...card, padding: '1.2rem' }}>
                  <div style={{ marginBottom: '1.1rem', paddingBottom: '1.1rem', borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ ...metricLabel, marginBottom: '0.6rem' }}>Sonnensystem</div>
                    {[
                      ['Gesamtbevölkerung', totalPop.toLocaleString('de'), T.ink],
                      ['Versorgte Kolonien', `${suppliedCount} / ${locations.length}`, suppliedCount === locations.length ? T.green : T.red],
                      ...(stats?.tickNumber > 0 ? [['Tick', `#${stats.tickNumber}`, T.ink]] : []),
                    ].map(([l, v, c], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: T.inkSoft }}>{l}</span><span style={{ fontWeight: 600, color: c as string }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: '1.1rem', paddingBottom: '1.1rem', borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ ...metricLabel, marginBottom: '0.6rem' }}>Letzte Transaktionen</div>
                    {transactions.slice(0, 4).map((t: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: T.inkSoft }}>{t.profiles?.username ?? 'Pilot'} · {RESOURCE_LABEL[t.resource] ?? t.resource}</span>
                        <span style={{ color: t.profit > 0 ? T.green : T.red, fontWeight: 600 }}>{t.profit > 0 ? '+' : ''}{t.profit} Cr</span>
                      </div>
                    ))}
                    {transactions.length === 0 && <div style={{ fontSize: '0.72rem', color: T.inkFaint }}>Noch keine Transaktionen.</div>}
                  </div>
                  <div>
                    <div style={{ ...metricLabel, marginBottom: '0.6rem' }}>Meldungen</div>
                    {news.slice(0, 3).map((n: any, i: number) => (
                      <div key={i} style={{ fontSize: '0.72rem', marginBottom: '0.35rem', color: n.type === 'danger' ? T.red : n.type === 'warning' ? '#d08020' : n.type === 'success' ? T.green : T.inkSoft }}>{n.icon} {n.text}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Beste Chance + Aufträge */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <SectionHead title="Beste Handelschance" />
                {best ? (
                  <div style={{ ...card, padding: '1.5rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: T.blueDeep, marginBottom: '0.3rem' }}>{RESOURCE_ICON[best.resource]} {RESOURCE_LABEL[best.resource]}</div>
                    <div style={{ fontSize: '0.85rem', color: T.inkSoft, marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {LOC_ICON[best.from]} {LOC_NAME[best.from]} {Icon.arrow(T.inkFaint)} {LOC_ICON[best.to]} {LOC_NAME[best.to]}
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 700, color: T.green, fontFamily: 'Georgia, serif' }}>+{best.profit} Cr<span style={{ fontSize: '0.8rem', color: T.inkFaint, fontFamily: 'system-ui' }}> / t</span></div>
                  </div>
                ) : <div style={{ ...card, padding: '1.5rem', color: T.inkFaint, fontSize: '0.82rem' }}>Keine Arbitrage gefunden.</div>}
              </div>

              <div>
                <SectionHead title="Dringende Aufträge" />
                <div style={card}>
                  {initialOrders.length === 0 ? (
                    <div style={{ padding: '1.5rem', color: T.inkFaint, fontSize: '0.82rem', textAlign: 'center' }}>Keine offenen Aufträge.</div>
                  ) : initialOrders.map((o: any, i: number) => (
                    <div key={o.id} style={{ padding: '1.1rem 1.35rem', borderBottom: i < initialOrders.length - 1 ? `1px solid ${T.lineSoft}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: T.blueDeep }}>{LOC_ICON[o.locations?.slug]} {o.locations?.name}</div>
                          <div style={{ fontSize: '0.72rem', color: T.inkSoft }}>{o.amount}t {RESOURCE_LABEL[o.resource]}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: T.gold, fontSize: '1.05rem', fontFamily: 'Georgia, serif' }}>+{o.reward.toLocaleString('de')} Cr</div>
                      </div>
                      <button style={{ ...btnGhost, width: '100%', justifyContent: 'center' }} onClick={() => setNegotiateOrder(o)}>{Icon.trade(T.blue)} Verhandeln</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Handel + Flotte */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
              <div>
                <SectionHead title={`Handelszentrale · ${LOC_NAME[location]}`} />
                <div style={card}>
                  {currentPrices.map((p: any, i: number) => (
                    <BuyRow key={p.id} p={p} last={i === currentPrices.length - 1}
                      cargoFree={cargoFreeSpace} owned={cargo[p.resource as ResourceType]}
                      onBuy={(amt) => openAuction(p.resource, 'buy', amt)}
                      onSell={(amt) => openAuction(p.resource, 'sell', amt)} T={T} />
                  ))}
                </div>
              </div>

              <div>
                <SectionHead title="Flotte"
                  action={location === 'moon' ? <button style={{ ...btnGhost, padding: '0.45rem 0.85rem', fontSize: '0.74rem' }} onClick={() => setShipyardOpen(true)}>{Icon.ship(T.blue)} Werft</button> : undefined} />
                <ShipyardCard
                  shipType={(shipTypeId ?? 'freighter_mk1') as any}
                  location={location as 'moon' | 'mars' | 'phobos'}
                  cargoUsed={used} cargoMax={cargoMax} credits={credits}
                  hasShipyard={locations.find((l: any) => l.slug === 'moon')?.has_shipyard ?? false}
                  onBuyShip={async (type) => {
                    const token = await getToken()
                    const res = await fetch(`/api/game/ships?action=buy&shipTypeId=${type}`, { headers: { 'Authorization': `Bearer ${token}` } })
                    const data = await res.json()
                    if (data.ok) { showToast(`${type} gekauft!`, true); await loadFromServer() }
                    else showToast(data.error ?? 'Kauf fehlgeschlagen', false)
                  }}
                />
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ ...metricLabel, marginBottom: '0.6rem' }}>Fliegen nach</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {otherLocations.map((loc: any) => (
                      <button key={loc.id} disabled={inTransit}
                        style={{ ...btnGhost, width: '100%', justifyContent: 'space-between', opacity: inTransit ? 0.5 : 1 }}
                        onClick={() => handleTravel(loc.slug as LocationSlug)}>
                        <span>{LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}</span>
                        <span style={{ color: T.inkFaint, fontSize: '0.66rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Sofortflug {Icon.arrow(T.inkFaint)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Handelszeile (Kauf/Verkauf einer Ressource) ─────────────────────────────
function BuyRow({ p, last, cargoFree, owned, onBuy, onSell, T }: {
  p: any
  last: boolean
  cargoFree: number
  owned: number
  onBuy: (amt: number) => void
  onSell: (amt: number) => void
  T: Record<string, string>
}) {
  const [amount, setAmount] = useState(1)
  const stepBtn: React.CSSProperties = { width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${T.line}`, background: T.bg, color: T.blue, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 230px', alignItems: 'center', padding: '0.9rem 1.35rem', borderBottom: last ? 'none' : `1px solid ${T.lineSoft}` }}>
      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}</span>
      <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Kauf <strong style={{ color: T.red }}>{p.buy_price}</strong></span>
      <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Verk <strong style={{ color: T.green }}>{p.sell_price}</strong></span>
      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button style={stepBtn} onClick={() => setAmount((a: number) => Math.max(1, a - 1))}>−</button>
        <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>{amount}</span>
        <button style={stepBtn} onClick={() => setAmount((a: number) => Math.min(Math.max(1, cargoFree), a + 1))}>+</button>
        <button style={{ background: T.blue, color: '#fff', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer' }} onClick={() => onBuy(amount)}>Kaufen</button>
        <button style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer', opacity: owned > 0 ? 1 : 0.4 }} onClick={() => onSell(amount)}>Verk.</button>
      </div>
    </div>
  )
}
