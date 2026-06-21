// app/dashboard/DashboardClient.tsx
// Erstellt:     30.05.2026
// Aktualisiert: 14.06.2026
// Version:      0.5.0
//
// v0.5.0: Übersichts-Tab ortszentriert umgebaut (Schicht 1 des Dashboard-
//   Redesigns). Der aktuelle Ort ist der Fokus:
//   - HAUPTVIEW (links): aktueller Ort groß — Hero mit Ressourcen-Ampel +
//     größtem Engpass, Aktions-Buttons (Kolonie ansehen, Stationsbüro-
//     Platzhalter, Werft nur Mond), Frachtstatus, Handelszentrale des Orts.
//   - REISEZIELE (rechts): andere Orte mit größtem Bedarf + Flugzeit. Vorerst
//     alle erreichbar (reachable=true); Schicht 2 ersetzt das durch echte
//     Schiffsreichweite. Plus Beste Route + Aufmerksamkeits-Feed.
//   - DEINE ORTE (Leiste unten): Orte mit eigenen tile_entities + immer der
//     aktuelle Ort (HIER-Markierung). Skaliert für beliebig viele Orte.
//   Entfernt: Commander-Statusleiste und große Kolonien-Liste (das „überladen".
//   Kernzahlen bleiben in der Topbar; Kolonie-Details via ColonyDetail-Overlay).
//   tileEntities werden jetzt auch im Dashboard-Tab geladen (Immobilien-Leiste).
// v0.4.0: Commander-Overview, Hero-Karte, Aufmerksamkeits-Feed (ersetzt 0.5.0).
// v0.3.0: Cargo-Loop-Fix (atomar in einem Call).
// v0.2.0: Vier Aufruf-Overlays ausgelagert.

'use client'

import { useState, useEffect } from 'react'
import { useGameStore, ResourceType, LocationSlug, effectiveRange } from '@/lib/store/gameStore'
import { baseTravelSeconds } from '@/lib/game/ships'
import { getToken, getSessionInfo } from '@/lib/supabase/auth'
import TransitPanel from './TransitPanel'
import StatisticsTab from './StatisticsTab'
import ColonyGrid from './ColonyGrid'
import MiniMap from './MiniMap'
import SolarSystem from './SolarSystem'
import ColonyStats from './ColonyStats'
import ShipyardCard from './ShipyardCard'
import ShipHeader from './ShipHeader'
import MarketAuction from './MarketAuction'
import OrderNegotiation from './OrderNegotiation'
import ColonyDetail from './ColonyDetail'
import ShipyardOverlay from './ShipyardOverlay'
import WelcomeSetup from './WelcomeSetup'
import { worstStatus, resourceStatus, stateColor, stateLabel, attentionItems } from './dashboardStatus'
import { T, Icon, Toast, SectionHead, RESOURCE_LABEL, RESOURCE_ICON, LOC_ICON, LOC_NAME } from './ui'
import BuyRow from './BuyRow'

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
    invalidate, invalidations, costBasis, shipRange,
  } = useGameStore()

  // UI-State
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics' | 'colonies' | 'system'>('dashboard')
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
  const [gridOpen, setGridOpen]             = useState(false)   // Karten-Overlay (volles ColonyGrid)

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
      const { token, userId } = await getSessionInfo()
      setUserId(userId)
      const res   = await fetch('/api/game/build', { headers: { 'Authorization': `Bearer ${token}` } })
      const data  = await res.json()
      setPlayerBuilds(data.builds ?? [])
      setTileEntities(data.entities ?? [])
      setColonyTax(data.colonyTax ?? {})
      setEntityInfo(data.entityInfo ?? {})
    } catch (err) { console.error('build fetch error:', err) }
  }
  // Builds/Bestand laden: im Kolonien-Tab (Grid) UND im Übersichts-Tab
  // (Immobilien-Leiste braucht die tile_entities des Spielers).
  useEffect(() => { if (activeTab === 'colonies' || activeTab === 'dashboard') fetchBuilds() }, [activeTab])
  // Re-Fetch nach Bau/Verkauf, ausgelöst über den Store statt Callback-Props
  useEffect(() => { if (activeTab === 'colonies' || activeTab === 'dashboard') fetchBuilds() }, [invalidations.builds])

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

  async function handleTravel(dest: string) { if (!inTransit) await travel(dest as any, stats?.tickNumber ?? 0) }

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
  const totalPop            = stats?.totalPopulation ?? locations.reduce((s: number, l: any) => s + l.population, 0)

  // Flugzeit zum Ziel — aus der EINEN Quelle (ships.baseTravelSeconds) statt
  // einer lokalen Kopie. Mit dem aktuellen Tick variiert sie orbital (25–50s).
  function flightTime(to: string): number | null {
    return baseTravelSeconds(location as any, to as any, stats?.tickNumber ?? 0)
  }

  // Effektive Reichweite: heute = statische shipRange. Die Funktion trägt schon
  // die Einstiegspunkte für Ladungsgewicht/Module (Post-Alpha-Treibstoffsystem).
  const reach = effectiveRange(shipRange, used)

  // Immobilien-Orte: Orte mit eigenen tile_entities + IMMER der aktuelle Ort.
  // Pro Ort die Gebäudezahl. Aktueller Ort wird markiert (auch ohne Gebäude).
  const propertyByLocation: Record<string, number> = {}
  for (const e of tileEntities) {
    const slug = e.locations?.slug
    if (slug) propertyByLocation[slug] = (propertyByLocation[slug] ?? 0) + 1
  }
  const propertySlugs = Array.from(new Set<string>([location, ...Object.keys(propertyByLocation)]))
  const propertyLocations = propertySlugs
    .map(slug => locations.find((l: any) => l.slug === slug))
    .filter(Boolean)

  // Aufmerksamkeits-Hinweise (lenkt, löst nicht)
  const attention = attentionItems(locations)

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
        location={location as any}
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

      {/* Karten-Overlay: volles ColonyGrid des aktuellen Orts */}
      {gridOpen && currentLocationData && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(2,4,8,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflow: 'auto' }}
          onClick={() => setGridOpen(false)}
        >
          <div style={{ maxWidth: '960px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
              <button
                onClick={() => setGridOpen(false)}
                style={{ background: 'transparent', border: '1px solid #2a4e7a', color: '#cfe0f5', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Karte schließen ✕
              </button>
            </div>
            <ColonyGrid
              slug={currentLocationData.slug} name={currentLocationData.name}
              population={currentLocationData.population} populationMax={currentLocationData.population_max}
              isSupplied={currentLocationData.is_supplied}
              userId={userId}
              tax={colonyTax[currentLocationData.id]}
              entityInfo={entityInfo}
              locationResources={currentLocationData.location_resources ?? []}
              credits={credits}
              entities={tileEntities.filter((e: any) => e.locations?.slug === currentLocationData.slug)}
              pending={playerBuilds
                .filter((b: any) => b.locations?.slug === currentLocationData.slug)
                .map((b: any) => ({
                  buildable_id: b.buildable_id,
                  tile_row:     b.tile_row,
                  tile_col:     b.tile_col,
                  status:       b.status,
                }))}
            />
          </div>
        </div>
      )}

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
            { id: 'system',     label: 'System',      icon: Icon.orbit },
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

        {activeTab === 'system' && <SolarSystem currentTick={stats?.tickNumber ?? 0} shipRange={shipRange} currentLocation={location} />}

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
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* ════════════════════════════════════════════════════════════
                ORTSZENTRIERTE ÜBERSICHT (Schicht 1)
                Hauptview (aktueller Ort) · Reiseziele rechts · Immobilien unten.
                Reichweite + Stationsbüro-NPC folgen in Schicht 2/3.
               ════════════════════════════════════════════════════════════ */}

            {/* ── HAUPTRASTER: aktueller Ort (groß) · Reiseziele (rechts) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', marginBottom: '1.5rem' }}>

              {/* ── HAUPTVIEW: der Ort, an dem du gerade bist ───────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Hero des aktuellen Orts */}
                {currentLocationData && (() => {
                  const worst = worstStatus(currentLocationData)
                  const popPct = Math.round((currentLocationData.population / currentLocationData.population_max) * 100)
                  return (
                    <div style={{
                      ...card, padding: '1.6rem 1.8rem',
                      borderLeft: `4px solid ${worst ? stateColor(worst.state, T) : T.green}`,
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ ...metricLabel, marginBottom: '0.3rem' }}>{LOC_ICON[location]} Du bist hier</div>
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
                                  <span style={{ color: T.ink }}>{RESOURCE_ICON[r.resource]} {r.stock}t · {stateLabel(s)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '160px' }}>
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

                      {/* Aktions-Buttons des Orts */}
                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.3rem', flexWrap: 'wrap' }}>
                        <button style={btnPrimary} onClick={() => setGridOpen(true)}>
                          {Icon.globe('#fff')} Karte & Bauen
                        </button>
                        {/* Stationsbüro — Platzhalter (NPC folgt in Schicht 3) */}
                        <button style={btnGhost} onClick={() => showToast('Das Stationsbüro öffnet bald — der Verwalter ist noch unterwegs.', true)}>
                          {Icon.alert(T.blue)} Stationsbüro
                        </button>
                        {location === 'moon' && (
                          <button style={btnGhost} onClick={() => setShipyardOpen(true)}>
                            {Icon.ship(T.blue)} Werft
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Mini-Karte des aktuellen Orts — Klick öffnet volles Grid */}
                {currentLocationData && (
                  <MiniMap
                    slug={location}
                    population={currentLocationData.population}
                    userId={userId}
                    entities={tileEntities.filter((e: any) => e.locations?.slug === location)}
                    pending={playerBuilds
                      .filter((b: any) => b.locations?.slug === location)
                      .map((b: any) => ({
                        buildable_id: b.buildable_id,
                        tile_row:     b.tile_row,
                        tile_col:     b.tile_col,
                        status:       b.status,
                      }))}
                    onOpen={() => setGridOpen(true)}
                  />
                )}

                {/* Frachtstatus */}
                <div style={{ ...card, padding: '0.85rem 1.4rem', display: 'flex', gap: '1.8rem', alignItems: 'center' }}>
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

                {/* Handelszentrale des aktuellen Orts */}
                <div>
                  <SectionHead title={`Handelszentrale · ${LOC_NAME[location]}`} />
                  <div style={card}>
                    {currentPrices.map((p: any, i: number) => (
                      <BuyRow key={p.id} p={p} last={i === currentPrices.length - 1}
                        cargoFree={cargoFreeSpace} owned={cargo[p.resource as ResourceType]}
                        costBasis={costBasis[p.resource as ResourceType] ?? 0}
                        onBuy={(amt, limit) => openAuction(p.resource, 'buy', amt, limit)}
                        onSell={(amt, limit) => openAuction(p.resource, 'sell', amt, limit)} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── SEITENSPALTE: Reiseziele ────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div>
                  <SectionHead title="Reiseziele" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {otherLocations.map((loc: any) => {
                      const worst = worstStatus(loc)
                      const secs  = flightTime(loc.slug)
                      // Schicht 2: Reichweiten-Check. Ziel erreichbar, wenn seine
                      // Basis-Distanz <= effektive Reichweite des Schiffs.
                      const reachable = secs != null && secs <= reach
                      return (
                        <div key={loc.id}
                          onClick={() => { if (reachable && !inTransit) handleTravel(loc.slug) }}
                          style={{
                            ...card, padding: '1rem 1.2rem',
                            borderLeft: `4px solid ${reachable ? (worst ? stateColor(worst.state, T) : T.green) : T.line}`,
                            cursor: reachable && !inTransit ? 'pointer' : 'default',
                            opacity: reachable ? 1 : 0.55,
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: reachable ? T.blueDeep : T.inkFaint }}>
                              {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: T.inkFaint, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {secs != null ? `${secs}s` : '—'} {reachable && Icon.arrow(T.inkFaint)}
                            </span>
                          </div>
                          {reachable ? (
                            <div style={{ fontSize: '0.76rem', color: worst ? stateColor(worst.state, T) : T.green }}>
                              {worst
                                ? <>braucht {RESOURCE_ICON[worst.resource]} {RESOURCE_LABEL[worst.resource]} · {stateLabel(worst)}</>
                                : 'stabil versorgt'}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.74rem', color: T.inkFaint, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.inkFaint, display: 'inline-block' }} />
                              außer Reichweite · stärkeres Schiff nötig
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {inTransit && (
                      <div style={{ fontSize: '0.74rem', color: T.inkFaint, padding: '0.3rem 0.2rem' }}>
                        Im Transit — Ziele nach der Landung wieder wählbar.
                      </div>
                    )}
                  </div>
                </div>

                {/* Beste Route bleibt als nützlicher Hinweis */}
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

                {/* Aufmerksamkeits-Feed */}
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
              </div>
            </div>

            {/* ── IMMOBILIEN-LEISTE: Orte mit eigenem Standbein ──────────── */}
            <div style={{ marginBottom: '1.5rem' }}>
              <SectionHead title="Deine Orte" />
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                {propertyLocations.map((loc: any) => {
                  const isHere   = loc.slug === location
                  const gebaeude = propertyByLocation[loc.slug] ?? 0
                  return (
                    <div key={loc.id} onClick={() => setDetailColony(loc)}
                      style={{
                        ...card, padding: '0.9rem 1.2rem', cursor: 'pointer',
                        minWidth: '150px', flex: '0 1 auto',
                        borderLeft: `4px solid ${isHere ? T.gold : T.blue}`,
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.92rem', color: T.blueDeep }}>
                        {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                        {isHere && <span style={{ fontSize: '0.52rem', background: T.gold, color: '#fff', borderRadius: '4px', padding: '2px 6px', letterSpacing: '0.05em' }}>HIER</span>}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: T.inkSoft, marginTop: '0.3rem' }}>
                        {gebaeude > 0 ? `${gebaeude} Gebäude` : 'kein Gebäude'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── AUFTRÄGE ──────────────────────────────────────────────── */}
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
          </>
        )}
      </div>
    </div>
  )
}
