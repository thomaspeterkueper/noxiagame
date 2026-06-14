// app/dashboard/DashboardClient.tsx
// Erstellt:     30.05.2026
// Aktualisiert: 07.06.2026
// Version:      0.4.0
//
// v0.4.0: Übersichts-Tab neu strukturiert (Feedback 07.06.):
//   - Commander-Overview-Leiste (Bevölkerung, Credits, Kolonien, Wachstum, Standort)
//   - Hero-Karte der Hauptkolonie mit Ressourcen-Ampel + größtem Engpass
//   - Größere Koloniekarten mit Ampelpunkten und Status-Wort
//   - Aufmerksamkeits-Feed (lenkt, nennt keine Lösungen) via dashboardStatus.ts
//   - Prominente „Beste Route", „FÜR DICH"-Badge an persönlichen Aufträgen
//   - Dichter, weniger Weißraum; hell behalten
// v0.3.0: Cargo-Loop-Fix (atomar in einem Call).
// v0.2.0: Vier Aufruf-Overlays ausgelagert.

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
import { worstStatus, resourceStatus, stateColor, stateLabel, attentionItems } from './dashboardStatus'

// ─── Konstanten ────────────────────────────────────────────────────────────────
const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON:       Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }
const LOC_NAME:       Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }


// ─── Design-Tokens ───────────────────────────────────────────────────────────
const T = {
  ink:      '#1b2733',
  inkSoft:  '#5a6b7b',
  inkFaint: '#94a3b8',
  blue:     '#2a4e7a',
  blueDeep: '#1d3a5f',
  gold:     '#b99b6b',
  goldHot:  '#c9a961',
  bg:       '#f4f2ed',
  surface:  '#ffffff',
  line:     '#e7e2d8',
  lineSoft: '#f0ece3',
  green:    '#2f9e6b',
  red:      '#c0563f',
  radius:   '10px',
  radiusLg: '14px',
}

// ─── Inline-SVG-Icons ─────────────────────────────────────────────────────────
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

// ─── Bearer Token ───────────────────────────────────────────────────────────
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

// ─── Abschnitts-Überschrift ─────────────────────────────────────────────────
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
    invalidate, invalidations, costBasis,
  } = useGameStore()

  // UI-State
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics' | 'colonies'>('dashboard')
  const [worldData, setWorldData] = useState<any>(null)
  const [playerBuilds, setPlayerBuilds] = useState<any[]>([])
  const [tileEntities, setTileEntities] = useState<any[]>([])
  const [colonyTax, setColonyTax] = useState<Record<string, { tax_property: number; tax_transaction: number; tax_landing: number }>>({})
  const [entityInfo, setEntityInfo] = useState<Record<string, { ertragswert: number; produktion: number | null; ressource: string | null; resourceSellPrice: number | null }>>({})
  const [userId, setUserId] = useState<string>('')
  const [profile, setProfile] = useState<any>(null)

  // Overlay-State
  const [auctionOpen, setAuctionOpen]       = useState(false)
  const [auctionConfig, setAuctionConfig]   = useState<{ resource: ResourceType; mode: 'buy' | 'sell'; qty: number; limit: number }>({ resource: 'water', mode: 'buy', qty: 10, limit: 0 })
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
      setColonyTax(data.colonyTax ?? {})
      setEntityInfo(data.entityInfo ?? {})
    } catch (err) { console.error('build fetch error:', err) }
  }
  useEffect(() => { if (activeTab === 'colonies') fetchBuilds() }, [activeTab])
  // Re-Fetch nach Bau/Verkauf, ausgelöst über den Store statt Callback-Props
  useEffect(() => { if (activeTab === 'colonies') fetchBuilds() }, [invalidations.builds])

  // ── Profil laden ────────────────────────────────────────────────────────────
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

  // ── Handel (v0.3.0: atomar in einem Call) ────────────────────────────────────
  async function handleBuy(resource: ResourceType, price: number, amount: number) {
    const result = await buy(resource, price, amount)
    showToast(result.msg, result.ok)
  }
  async function handleSell(resource: ResourceType, price: number, amount: number) {
    const result = await sell(resource, price, amount)
    showToast(result.msg, result.ok)
  }

  function openAuction(resource: ResourceType, mode: 'buy' | 'sell', qty: number, limit: number) {
    setAuctionConfig({ resource, mode, qty: Math.max(1, qty), limit })
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

  // Aufmerksamkeits-Hinweise (lenkt, löst nicht) + grobe Wachstumsschätzung
  const attention = attentionItems(locations)
  const growthPerTick = locations.reduce((s: number, l: any) => {
    // nur versorgte Kolonien wachsen (+1%/Tick), grobe Schätzung bis 0.1.5
    return s + (l.is_supplied ? (l.population ?? 0) * 0.01 : 0)
  }, 0)

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
        playerLimit={auctionConfig.limit}
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
                  tax={colonyTax[loc.id]}
                  entityInfo={entityInfo}
                  entities={tileEntities.filter((e: any) => e.locations?.slug === loc.slug)}
                  pending={playerBuilds
                    .filter((b: any) => b.locations?.slug === loc.slug)
                    .map((b: any) => ({
                      buildable_id: b.buildable_id,
                      tile_row:     b.tile_row,
                      tile_col:     b.tile_col,
                      status:       b.status,
                    }))}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* ── COMMANDER OVERVIEW ───────────────────────────────────── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px',
              background: T.line, border: `1px solid ${T.line}`, borderRadius: T.radiusLg,
              overflow: 'hidden', marginBottom: '1.5rem',
            }}>
              {[
                ['Bevölkerung', totalPop.toLocaleString('de'), T.ink],
                ['Credits', `${credits.toLocaleString('de')}`, T.blue],
                ['Kolonien', `${suppliedCount}/${locations.length} versorgt`, suppliedCount === locations.length ? T.green : T.red],
                ['Wachstum', `+${Math.round(growthPerTick)}/Tick`, T.green],
                ['Standort', LOC_NAME[location], T.gold],
              ].map(([l, v, c], i) => (
                <div key={i} style={{ background: T.surface, padding: '0.9rem 1.1rem' }}>
                  <div style={metricLabel}>{l}</div>
                  <div style={{ fontWeight: 700, color: c as string, fontSize: '1.1rem', marginTop: '3px', fontFamily: 'Georgia, serif' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* ── HERO: aktuelle Hauptkolonie ──────────────────────────── */}
            {currentLocationData && (() => {
              const worst = worstStatus(currentLocationData)
              const popPct = Math.round((currentLocationData.population / currentLocationData.population_max) * 100)
              return (
                <div style={{
                  ...card, padding: '1.6rem 1.8rem', marginBottom: '1.5rem',
                  borderLeft: `4px solid ${worst ? stateColor(worst.state, T) : T.green}`,
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ ...metricLabel, marginBottom: '0.3rem' }}>{LOC_ICON[location]} Hauptquartier</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.8rem', color: T.blueDeep, marginBottom: '0.5rem' }}>
                      {currentLocationData.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: T.inkSoft, marginBottom: '0.9rem' }}>
                      {currentLocationData.population.toLocaleString('de')} Einwohner · {popPct}% Auslastung
                    </div>
                    <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                      {(currentLocationData.location_resources ?? []).map((r: any) => {
                        const s = resourceStatus(r)
                        return (
                          <div key={r.resource} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: stateColor(s.state, T), display: 'inline-block' }} />
                            <span style={{ color: T.ink }}>{RESOURCE_ICON[r.resource]} {stateLabel(s)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '180px' }}>
                    {worst ? (
                      <>
                        <div style={{ ...metricLabel, marginBottom: '0.3rem' }}>Größter Engpass</div>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: stateColor(worst.state, T) }}>
                          {RESOURCE_ICON[worst.resource]} {stateLabel(worst)}
                        </div>
                        {worst.ticksLeft !== null && worst.ticksLeft > 0 && (
                          <div style={{ fontSize: '0.78rem', color: T.inkSoft, marginTop: '0.2rem' }}>
                            reicht noch ~{worst.ticksLeft} Ticks
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ ...metricLabel, marginBottom: '0.3rem' }}>Status</div>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: T.green }}>Alles stabil</div>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Frachtstatus — immer sichtbar */}
            <div style={{ ...card, padding: '0.85rem 1.4rem', marginBottom: '1.5rem', display: 'flex', gap: '1.8rem', alignItems: 'center' }}>
              <span style={metricLabel}>An Bord</span>
              {used > 0 ? (
                (Object.entries(cargo) as [ResourceType, number][]).filter(([, v]) => v > 0).map(([res, amt]) => (
                  <span key={res} style={{ fontSize: '0.88rem', fontWeight: 600, color: T.blue }}>{RESOURCE_ICON[res]} {RESOURCE_LABEL[res]} {amt}t</span>
                ))
              ) : (
                <span style={{ fontSize: '0.82rem', color: T.inkFaint }}>Laderaum leer — kauf etwas in der Handelszentrale.</span>
              )}
              <div style={{ marginLeft: 'auto', background: T.bg, borderRadius: '999px', padding: '0.25rem 0.8rem', fontSize: '0.72rem', color: T.inkSoft }}>{cargoFreeSpace}t frei</div>
            </div>

            {/* ── Hauptraster: Kolonien (breit) · Seitenspalte ─────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '1.5rem' }}>

              <div>
                <SectionHead title="Kolonien" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {locations.map((loc: any) => {
                    const popPct = Math.round((loc.population / loc.population_max) * 100)
                    const isHere = loc.slug === location
                    const worst  = worstStatus(loc)
                    const accent = worst ? stateColor(worst.state, T) : T.green
                    return (
                      <div key={loc.id} onClick={() => setDetailColony(loc)}
                        style={{ ...card, padding: '1.2rem 1.4rem', borderLeft: `4px solid ${accent}`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: T.blueDeep, display: 'flex', alignItems: 'center', gap: '7px' }}>
                            {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                            {isHere && <span style={{ fontSize: '0.52rem', background: T.gold, color: '#fff', borderRadius: '4px', padding: '2px 6px', letterSpacing: '0.05em' }}>HIER</span>}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: worst ? stateColor(worst.state, T) : T.green, fontWeight: 600 }}>
                            {worst ? stateLabel(worst) : 'stabil'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: T.inkFaint, marginBottom: '0.3rem' }}>
                          <span>{loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}</span>
                          <span>{popPct}%</span>
                        </div>
                        <div style={{ background: T.lineSoft, height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.8rem' }}>
                          <div style={{ width: `${popPct}%`, height: '100%', background: isHere ? T.gold : T.blue }} />
                        </div>
                        <div style={{ display: 'flex', gap: '1.1rem', fontSize: '0.74rem', color: T.inkSoft, flexWrap: 'wrap' }}>
                          {(loc.location_resources ?? []).map((r: any) => {
                            const s = resourceStatus(r)
                            return (
                              <span key={r.resource} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor(s.state, T), display: 'inline-block' }} />
                                {RESOURCE_ICON[r.resource]} {r.stock}t
                                <span style={{ color: s.netto >= 0 ? T.green : T.red, fontSize: '0.66rem' }}>
                                  ({s.netto >= 0 ? '+' : ''}{s.netto})
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div>
                  <SectionHead title="Braucht Aufmerksamkeit" />
                  <div style={{ ...card, padding: attention.length ? '0.5rem 0' : '1.2rem' }}>
                    {attention.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: T.green, padding: '0 1.2rem' }}>Das System läuft stabil.</div>
                    ) : attention.slice(0, 6).map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0.55rem 1.2rem', fontSize: '0.8rem', color: T.ink }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: a.level === 'critical' ? T.red : '#d08020' }} />
                        {a.text}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionHead title="Beste Route" />
                  {best ? (
                    <div style={{ ...card, padding: '1.4rem', borderTop: `3px solid ${T.gold}` }}>
                      <div style={{ fontSize: '0.85rem', color: T.inkSoft, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {LOC_ICON[best.from]} {LOC_NAME[best.from]} {Icon.arrow(T.inkFaint)} {LOC_ICON[best.to]} {LOC_NAME[best.to]}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: T.blueDeep, marginBottom: '0.6rem' }}>
                        {RESOURCE_ICON[best.resource]} {RESOURCE_LABEL[best.resource]}
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: T.green, fontFamily: 'Georgia, serif' }}>
                        +{best.profit}<span style={{ fontSize: '0.8rem', color: T.inkFaint, fontFamily: 'system-ui' }}> Cr/t</span>
                      </div>
                    </div>
                  ) : <div style={{ ...card, padding: '1.4rem', color: T.inkFaint, fontSize: '0.82rem' }}>Keine Arbitrage gefunden.</div>}
                </div>

                <div>
                  <SectionHead title="Letzte Ereignisse" />
                  <div style={{ ...card, padding: '1rem 1.2rem' }}>
                    {transactions.slice(0, 3).map((t: any, i: number) => (
                      <div key={`t${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: T.inkSoft }}>{t.profiles?.username ?? 'Pilot'} · {RESOURCE_LABEL[t.resource] ?? t.resource}</span>
                        <span style={{ color: t.profit > 0 ? T.green : T.red, fontWeight: 600 }}>{t.profit > 0 ? '+' : ''}{t.profit} Cr</span>
                      </div>
                    ))}
                    {news.slice(0, 2).map((n: any, i: number) => (
                      <div key={`n${i}`} style={{ fontSize: '0.74rem', marginTop: '0.3rem', color: n.type === 'danger' ? T.red : n.type === 'warning' ? '#d08020' : n.type === 'success' ? T.green : T.inkSoft }}>{n.icon} {n.text}</div>
                    ))}
                    {transactions.length === 0 && news.length === 0 && (
                      <div style={{ fontSize: '0.74rem', color: T.inkFaint }}>Noch keine Ereignisse.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Aufträge ─────────────────────────────────────────────── */}
            <div style={{ marginBottom: '1.5rem' }}>
              <SectionHead title="Dringende Aufträge" />
              <div style={card}>
                {initialOrders.length === 0 ? (
                  <div style={{ padding: '1.5rem', color: T.inkFaint, fontSize: '0.82rem', textAlign: 'center' }}>Keine offenen Aufträge.</div>
                ) : initialOrders.map((o: any, i: number) => {
                  const personal = o.for_profile_id != null
                  return (
                    <div key={o.id} style={{ padding: '1.1rem 1.35rem', borderBottom: i < initialOrders.length - 1 ? `1px solid ${T.lineSoft}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: T.blueDeep, display: 'flex', alignItems: 'center', gap: '7px' }}>
                            {LOC_ICON[o.locations?.slug]} {o.locations?.name}
                            {personal && <span style={{ fontSize: '0.5rem', background: T.gold, color: '#fff', borderRadius: '4px', padding: '2px 6px', letterSpacing: '0.05em' }}>FÜR DICH</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: T.inkSoft }}>{o.amount}t {RESOURCE_LABEL[o.resource]}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: T.gold, fontSize: '1.05rem', fontFamily: 'Georgia, serif' }}>+{o.reward.toLocaleString('de')} Cr</div>
                      </div>
                      <button style={{ ...btnGhost, width: '100%', justifyContent: 'center' }} onClick={() => setNegotiateOrder(o)}>{Icon.trade(T.blue)} Verhandeln</button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Handel + Flotte ──────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
              <div>
                <SectionHead title={`Handelszentrale · ${LOC_NAME[location]}`} />
                <div style={card}>
                  {currentPrices.map((p: any, i: number) => (
                    <BuyRow key={p.id} p={p} last={i === currentPrices.length - 1}
                      cargoFree={cargoFreeSpace} owned={cargo[p.resource as ResourceType]}
                      costBasis={costBasis[p.resource as ResourceType] ?? 0}
                      onBuy={(amt, limit) => openAuction(p.resource, 'buy', amt, limit)}
                      onSell={(amt, limit) => openAuction(p.resource, 'sell', amt, limit)} T={T} />
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
function BuyRow({ p, last, cargoFree, owned, costBasis, onBuy, onSell, T }: {
  p: any
  last: boolean
  cargoFree: number
  owned: number
  costBasis: number
  onBuy: (amt: number, limit: number) => void
  onSell: (amt: number, limit: number) => void
  T: Record<string, string>
}) {
  const [amount, setAmount] = useState(1)
  // Auktions-Vorbereitung: null = zu, sonst 'buy'/'sell' mit Limit-Eingabe offen.
  const [prep, setPrep] = useState<null | 'buy' | 'sell'>(null)
  const [limit, setLimit] = useState(0)

  const stepBtn: React.CSSProperties = { width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${T.line}`, background: T.bg, color: T.blue, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }
  const cap = Math.max(1, cargoFree)
  function setFromInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) { setAmount(1); return }
    setAmount(Math.min(cap, Math.max(1, n)))
  }

  // Limit-Grenzen je Modus: Kauf = bis buy_price (höchstes sinnvolles Gebot),
  // Verkauf = mindestens etwas über 0, höchstens buy_price.
  const limitMin = 10
  const limitMax = p.buy_price
  function openPrep(mode: 'buy' | 'sell') {
    // Default-Limit: Kauf = buy_price (sicher), Verkauf = sell_price (sicher).
    setLimit(mode === 'buy' ? p.buy_price : p.sell_price)
    setPrep(mode)
  }
  function setLimitFromInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) { setLimit(limitMin); return }
    setLimit(Math.min(limitMax, Math.max(limitMin, n)))
  }
  function confirm() {
    if (prep === 'buy') onBuy(amount, limit)
    else if (prep === 'sell') onSell(amount, limit)
    setPrep(null); setAmount(1)
  }

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T.lineSoft}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 260px', alignItems: 'center', padding: '0.9rem 1.35rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}</span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Kauf <strong style={{ color: T.red }}>{p.buy_price}</strong></span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Verk <strong style={{ color: T.green }}>{p.sell_price}</strong></span>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button style={stepBtn} onClick={() => setAmount((a: number) => Math.max(1, a - 1))}>−</button>
          <input
            type="text" inputMode="numeric" value={amount}
            onChange={e => setFromInput(e.target.value)}
            onFocus={e => e.target.select()}
            style={{ width: '44px', height: '26px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.line}`, borderRadius: '7px', color: T.ink, background: '#fff' }}
          />
          <button style={stepBtn} onClick={() => setAmount((a: number) => Math.min(cap, a + 1))}>+</button>
          <button style={{ background: T.blue, color: '#fff', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer' }} onClick={() => openPrep('buy')}>Kaufen</button>
          <button style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer', opacity: owned > 0 ? 1 : 0.4 }} onClick={() => openPrep('sell')}>Verk.</button>
        </div>
      </div>

      {/* Auktions-Vorbereitung: Limit setzen, bevor die Auktion öffnet */}
      {prep && (
        <div style={{ padding: '0.9rem 1.35rem', background: T.bg, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: T.blueDeep }}>
              {prep === 'buy' ? 'Maximalgebot' : 'Mindestpreis'} für {amount}t {RESOURCE_LABEL[p.resource]}
            </span>
            {prep === 'sell' && (
              <span style={{ fontSize: '0.7rem', color: T.inkSoft }}>
                dein Einstand: <strong style={{ color: costBasis > 0 ? T.ink : T.inkFaint }}>{costBasis > 0 ? `${costBasis} Cr/t` : '–'}</strong>
                {costBasis > 0 && limit < costBasis && (
                  <span style={{ color: T.red, marginLeft: '6px' }}>unter Einstand!</span>
                )}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <input
              type="range" min={limitMin} max={limitMax} value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: T.blue }}
            />
            <input
              type="text" inputMode="numeric" value={limit}
              onChange={e => setLimitFromInput(e.target.value)}
              onFocus={e => e.target.select()}
              style={{ width: '60px', height: '28px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.line}`, borderRadius: '7px', color: T.ink, background: '#fff' }}
            />
            <span style={{ fontSize: '0.72rem', color: T.inkFaint }}>Cr/t</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ flex: 1, background: prep === 'buy' ? T.blue : T.green, color: '#fff', border: 'none', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer' }} onClick={confirm}>
              Auktion starten ({prep === 'buy' ? 'Kauf' : 'Verkauf'})
            </button>
            <button style={{ background: 'transparent', color: T.inkSoft, border: `1px solid ${T.line}`, padding: '0.5rem 1rem', fontSize: '0.78rem', borderRadius: '7px', cursor: 'pointer' }} onClick={() => setPrep(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
