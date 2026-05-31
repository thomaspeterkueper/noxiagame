// app/dashboard/DashboardClient.tsx
// Erstellt: 30.05.2026
// Aktualisiert: 31.05.2026 – Tab-Navigation, Statistiken

'use client'

import { useState, useEffect } from 'react'
import { useGameStore, ResourceType, LocationSlug } from '@/lib/store/gameStore'
import TransitPanel from './TransitPanel'
import ShipyardPanel from './ShipyardPanel'
import StatisticsTab from './StatisticsTab'
import ColonyGrid from './ColonyGrid'

// Konstanten
const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string>  = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON:       Record<string, string>  = { moon: '🌙', mars: '🔴', phobos: '🪨' }
const LOC_NAME:       Record<string, string>  = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }
const LOC_IMAGE:      Record<string, string>  = {
  moon:   '/images/locations/moon.png',
  mars:   '/images/locations/mars.png',
  phobos: '/images/locations/phobos.png',
}

// Bearer Token für direkte API-Calls aus Komponenten
async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// Toast-Benachrichtigung
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
      background: ok ? '#2a4e7a' : '#c0392b', color: '#fff',
      padding: '0.6rem 1.5rem', borderRadius: '4px',
      fontSize: '0.8rem', fontWeight: 600, zIndex: 1000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      {msg}
    </div>
  )
}

export default function DashboardClient({ locations: initialLocations, prices, orders: initialOrders }: {
  locations: any[]
  prices: any[]
  orders: any[]
}) {
  const {
    credits, cargo, cargoMax, location, buy, sell, travel,
    cargoUsed, loaded, loadFromServer, inTransit,
  } = useGameStore()

  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [amounts, setAmounts]   = useState<Record<string, number>>({ water: 1, energy: 1, metal: 1 })
  const [worldData, setWorldData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics'>('dashboard')

  // Spielstand laden beim ersten Render
  useEffect(() => {
    if (!loaded) loadFromServer()
  }, [])

  // Weltdaten alle 30 Sekunden aktualisieren
  useEffect(() => {
    async function fetchWorld() {
      try {
        const res = await fetch('/api/game/world')
        const data = await res.json()
        setWorldData(data)
      } catch (err) {
        console.error('world fetch error:', err)
      }
    }
    fetchWorld()
    const interval = setInterval(fetchWorld, 30000)
    return () => clearInterval(interval)
  }, [])

  // Abgeleitete Daten
  const locations    = worldData?.locations ?? initialLocations
  const news         = worldData?.news ?? []
  const stats        = worldData?.stats
  const transactions = worldData?.transactions ?? []

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // Kaufen (mehrere Tonnen)
  async function handleBuy(resource: ResourceType, price: number, amount: number) {
    let bought = 0
    for (let j = 0; j < amount; j++) {
      const result = await buy(resource, price)
      if (!result.ok) { showToast(result.msg, false); break }
      bought++
    }
    if (bought > 0) showToast(`${bought}t ${RESOURCE_LABEL[resource]} gekauft · ${bought * price} Cr`, true)
  }

  // Verkaufen (mehrere Tonnen)
  async function handleSell(resource: ResourceType, price: number, amount: number) {
    let sold = 0
    for (let j = 0; j < amount; j++) {
      const result = await sell(resource, price)
      if (!result.ok) { showToast(result.msg, false); break }
      sold++
    }
    if (sold > 0) showToast(`${sold}t ${RESOURCE_LABEL[resource]} verkauft · +${sold * price} Cr`, true)
  }

  // Fliegen
  async function handleTravel(dest: LocationSlug) {
    if (inTransit) return
    await travel(dest)
  }

  // Abmelden
  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  // Auftrag erfüllen
  async function handleFulfillOrder(orderId: string, reward: number) {
    const token = await getToken()
    const res = await fetch(`/api/game/orders?action=fulfill&orderId=${orderId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`Auftrag erfüllt! +${data.reward.toLocaleString('de')} Cr`, true)
      await loadFromServer()
    } else {
      showToast(data.error, false)
    }
  }

  // Berechnungen
  const currentPrices      = prices.filter((p: any) => p.locations?.slug === location)
  const otherLocations     = locations.filter((l: any) => l.slug !== location)
  const currentLocationData = locations.find((l: any) => l.slug === location)
  const used               = cargoUsed()
  const cargoFreeSpace     = cargoMax - used
  const suppliedCount      = locations.filter((l: any) => l.is_supplied).length
  const totalPop           = stats?.totalPopulation ?? locations.reduce((s: number, l: any) => s + l.population, 0)

  // Beste Handelschance berechnen
  let best: { from: string; to: string; resource: string; profit: number } | null = null
  const byResource: Record<string, any[]> = {}
  for (const p of prices) {
    if (!byResource[p.resource]) byResource[p.resource] = []
    byResource[p.resource].push(p)
  }
  for (const [, locs] of Object.entries(byResource)) {
    for (const a of locs) {
      for (const b of locs) {
        if (a.locations?.slug === b.locations?.slug) continue
        const profit = b.sell_price - a.buy_price
        if (profit > (best?.profit ?? 0)) {
          best = { from: a.locations?.slug, to: b.locations?.slug, resource: a.resource, profit }
        }
      }
    }
  }

  // Style-Objekte
  const s = {
    label:        { fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '0.75rem', display: 'block' },
    card:         { background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px' },
    btnPrimary:   { background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' },
    btnSecondary: { background: '#f4f2ed', color: '#2a4e7a', border: '1px solid #d4cec4', padding: '0.3rem 0.8rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f2ed', color: '#1e2a36', fontFamily: 'system-ui, sans-serif' }}>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      <TransitPanel onArrival={() => {}} />

      {/* TOPBAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2ddd4', padding: '0 2rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.15em', color: '#2a4e7a', fontSize: '1.3rem', margin: 0 }}>
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          <span style={{ fontSize: '0.5rem', letterSpacing: '4px', color: '#b99b6b', marginLeft: '1rem', verticalAlign: 'middle', textTransform: 'uppercase' }}>Alpha 0.1</span>
        </h1>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Credits</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>{credits.toLocaleString('de')} Cr</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Frachter</div>
            <div style={{ fontWeight: 700, color: used > 0 ? '#2a4e7a' : '#94a3b8' }}>{used} / {cargoMax} t</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Standort</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>{LOC_ICON[location]} {LOC_NAME[location]}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Gesamtbevölkerung</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>{totalPop.toLocaleString('de')}</div>
          </div>
          <button style={{ ...s.btnSecondary, fontSize: '0.65rem' }} onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </header>

      {/* WELTMELDUNGEN */}
      <div style={{ background: '#2a4e7a', color: '#fff', padding: '0.6rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '2rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          {news.length > 0
            ? news.map((n: any, i: number) => <span key={i} style={{ opacity: i === 0 ? 1 : 0.75 }}>{n.icon} {n.text}</span>)
            : <span>🟢 Sonnensystem stabil</span>
          }
        </div>
      </div>

      {/* TAB-NAVIGATION */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2ddd4', padding: '0 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex' }}>
          {[
            { id: 'dashboard',  label: 'Übersicht' },
            { id: 'statistics', label: '📊 Statistiken' },
            { id: 'colonies', label: '🌍 Kolonien' }, 
          ].map(tab => (
            <button
              key={tab.id}
              style={{
                padding: '0.75rem 1.5rem', border: 'none', background: 'none',
                fontSize: '0.75rem', fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? '#2a4e7a' : '#94a3b8',
                borderBottom: activeTab === tab.id ? '2px solid #2a4e7a' : '2px solid transparent',
                cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '1px',
              }}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* HAUPTINHALT */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>

        {/* STATISTIKEN TAB */}
        {activeTab === 'statistics' && (
          <StatisticsTab locations={locations} />
        )}

        {activeTab === 'colonies' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
    {locations.map((loc: any) => (
      <ColonyGrid
        key={loc.id}
        slug={loc.slug}
        name={loc.name}
        population={loc.population}
        populationMax={loc.population_max}
        isSupplied={loc.is_supplied}
        buildings={[]}
      />
    ))}
  </div>
)}

        {/* ÜBERSICHT TAB */}
        {activeTab === 'dashboard' && (
          <>
            {/* AKTUELLER ORT */}
            <div style={{ ...s.card, marginBottom: '1.5rem', overflow: 'hidden', display: 'flex', height: '140px', background: '#0a0f1a' }}>
              <img src={LOC_IMAGE[location]} alt={LOC_NAME[location]} style={{ width: '220px', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ padding: '1.25rem', flex: 1, background: '#0a0f1a' }}>
                <div style={{ fontSize: '0.65rem', color: '#5a7a9a', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '0.5rem' }}>Aktueller Standort</div>
                <div style={{ fontSize: '1.4rem', fontFamily: 'Georgia, serif', fontWeight: 300, color: '#c9a961', marginBottom: '0.3rem' }}>
                  {LOC_ICON[location]} {LOC_NAME[location]}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a9ab8' }}>{currentLocationData?.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#5a7a9a', marginTop: '0.3rem' }}>{currentLocationData?.description}</div>
              </div>
            </div>

            {/* FRACHTSTATUS – nur wenn beladen */}
            {used > 0 && (
              <div style={{ ...s.card, padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>An Bord:</span>
                {(Object.entries(cargo) as [ResourceType, number][]).filter(([, v]) => v > 0).map(([res, amt]) => (
                  <span key={res} style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2a4e7a' }}>
                    {RESOURCE_ICON[res]} {RESOURCE_LABEL[res]} {amt}t
                  </span>
                ))}
                <div style={{ marginLeft: 'auto', background: '#f4f2ed', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                  {cargoFreeSpace}t frei
                </div>
              </div>
            )}

            {/* KOLONIEN + WELTENTWICKLUNG */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={s.label}>Kolonien – Weltstatus</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {locations.map((loc: any) => {
                    const popPct = Math.round((loc.population / loc.population_max) * 100)
                    const isHere = loc.slug === location
                    return (
                      <div key={loc.id} style={{ ...s.card, padding: '1rem 1.25rem', borderLeft: `4px solid ${isHere ? '#b99b6b' : loc.is_supplied ? '#27ae60' : '#c0392b'}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto', alignItems: 'center', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2a4e7a' }}>
                              {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                              {isHere && <span style={{ fontSize: '0.55rem', background: '#b99b6b', color: '#fff', borderRadius: '3px', padding: '1px 5px', marginLeft: '5px' }}>HIER</span>}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{loc.name}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                              <span>Bevölkerung</span>
                              <span style={{ color: '#1e2a36' }}>{loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}</span>
                            </div>
                            <div style={{ background: '#f1f1f1', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${popPct}%`, height: '100%', background: isHere ? '#b99b6b' : '#2a4e7a' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b' }}>
                            {(loc.location_resources ?? []).map((r: any) => {
                              const bal = r.production - r.consumption
                              return (
                                <span key={r.resource}>
                                  {RESOURCE_ICON[r.resource]} {r.stock}t
                                  <span style={{ color: bal >= 0 ? '#27ae60' : '#c0392b', marginLeft: '2px', fontSize: '0.65rem' }}>
                                    ({bal >= 0 ? '+' : ''}{bal})
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                          <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: loc.is_supplied ? '#27ae60' : '#c0392b' }}>
                            {loc.is_supplied ? '✓' : '⚠'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* WELTENTWICKLUNG */}
              <div>
                <span style={s.label}>Weltentwicklung</span>
                <div style={{ ...s.card, padding: '1rem' }}>
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f1f1' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Sonnensystem</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#64748b' }}>Gesamtbevölkerung</span>
                      <span style={{ fontWeight: 600 }}>{totalPop.toLocaleString('de')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#64748b' }}>Versorgte Kolonien</span>
                      <span style={{ fontWeight: 600, color: suppliedCount === locations.length ? '#27ae60' : '#c0392b' }}>
                        {suppliedCount} / {locations.length}
                      </span>
                    </div>
                    {stats?.tickNumber > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>Tick</span>
                        <span style={{ fontWeight: 600 }}>#{stats.tickNumber}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f1f1' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Letzte Transaktionen</div>
                    {transactions.slice(0, 4).map((t: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#64748b' }}>{t.profiles?.username ?? 'Pilot'} · {RESOURCE_LABEL[t.resource] ?? t.resource}</span>
                        <span style={{ color: t.profit > 0 ? '#27ae60' : '#c0392b', fontWeight: 600 }}>
                          {t.profit > 0 ? '+' : ''}{t.profit} Cr
                        </span>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Noch keine Transaktionen.</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Meldungen</div>
                    {news.slice(0, 3).map((n: any, i: number) => (
                      <div key={i} style={{ fontSize: '0.72rem', marginBottom: '0.3rem', color: n.type === 'danger' ? '#c0392b' : n.type === 'warning' ? '#e67e22' : n.type === 'success' ? '#27ae60' : '#64748b' }}>
                        {n.icon} {n.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* BESTE HANDELSCHANCE + AUFTRÄGE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={s.label}>Beste Handelschance</span>
                {best ? (
                  <div style={{ ...s.card, padding: '1.25rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2a4e7a', marginBottom: '0.3rem' }}>
                      {RESOURCE_ICON[best.resource]} {RESOURCE_LABEL[best.resource]}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                      {LOC_ICON[best.from]} {LOC_NAME[best.from]} → {LOC_ICON[best.to]} {LOC_NAME[best.to]}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#27ae60', marginBottom: '0.5rem' }}>
                      +{best.profit} Cr / t
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Kaufen auf {LOC_NAME[best.from]} · Verkaufen auf {LOC_NAME[best.to]}
                    </div>
                  </div>
                ) : (
                  <div style={{ ...s.card, padding: '1.25rem', color: '#94a3b8', fontSize: '0.8rem' }}>Keine Arbitrage gefunden.</div>
                )}
              </div>
              <div>
                <span style={s.label}>Dringende Aufträge</span>
                <div style={s.card}>
                  {initialOrders.length === 0 ? (
                    <div style={{ padding: '1.25rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
                      Keine offenen Aufträge.
                    </div>
                  ) : initialOrders.map((o: any, i: number) => (
                    <div key={o.id} style={{ padding: '1rem 1.25rem', borderBottom: i < initialOrders.length - 1 ? '1px solid #f1f1f1' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2a4e7a' }}>{LOC_ICON[o.locations?.slug]} {o.locations?.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{o.amount}t {RESOURCE_LABEL[o.resource]}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#b99b6b', fontSize: '1rem' }}>+{o.reward.toLocaleString('de')} Cr</div>
                      </div>
                      <button
                        style={{ ...s.btnPrimary, width: '100%', padding: '0.4rem', fontSize: '0.65rem' }}
                        onClick={() => handleFulfillOrder(o.id, o.reward)}
                      >
                        Erfüllen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* WERFT (nur wenn Kolonie eine Werft hat) */}
            <ShipyardPanel onPurchase={() => loadFromServer()} locations={locations} />

            {/* HANDELSZENTRALE + FLOTTENKONTROLLE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem' }}>
              <div>
                <span style={s.label}>Handelszentrale – {LOC_ICON[location]} {LOC_NAME[location]}</span>
                <div style={s.card}>
                  {currentPrices.map((p: any, i: number) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 220px', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: i < currentPrices.length - 1 ? '1px solid #f1f1f1' : 'none' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Kauf <strong style={{ color: '#c0392b' }}>{p.buy_price} Cr</strong>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Verk <strong style={{ color: '#27ae60' }}>{p.sell_price} Cr</strong>
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button style={{ ...s.btnSecondary, padding: '0.3rem 0.6rem' }}
                          onClick={() => setAmounts(a => ({ ...a, [p.resource]: Math.max(1, a[p.resource] - 1) }))}>−</button>
                        <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>{amounts[p.resource]}</span>
                        <button style={{ ...s.btnSecondary, padding: '0.3rem 0.6rem' }}
                          onClick={() => setAmounts(a => ({ ...a, [p.resource]: Math.min(Math.max(1, cargoFreeSpace), a[p.resource] + 1) }))}>+</button>
                        <button style={s.btnPrimary}
                          onClick={() => handleBuy(p.resource as ResourceType, p.buy_price, amounts[p.resource])}>
                          Kaufen
                        </button>
                        <button style={{ ...s.btnSecondary, opacity: cargo[p.resource as ResourceType] > 0 ? 1 : 0.4 }}
                          onClick={() => handleSell(p.resource as ResourceType, p.sell_price, amounts[p.resource])}>
                          Verk.
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FLOTTENKONTROLLE */}
              <div>
                <span style={s.label}>Flottenkontrolle</span>
                <div style={{ ...s.card, padding: '1.25rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.3rem' }}>Frachtraum</div>
                    <div style={{ background: '#f1f1f1', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                      <div style={{ width: `${(used / cargoMax) * 100}%`, height: '100%', background: '#2a4e7a', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{used} / {cargoMax} t · {cargoFreeSpace}t frei</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Fliegen nach</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {otherLocations.map((loc: any) => (
                        <button key={loc.id}
                          style={{ ...s.btnSecondary, width: '100%', padding: '0.6rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: inTransit ? 0.5 : 1 }}
                          disabled={inTransit}
                          onClick={() => handleTravel(loc.slug as LocationSlug)}>
                          <span>{LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>Sofortflug →</span>
                        </button>
                      ))}
                    </div>
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