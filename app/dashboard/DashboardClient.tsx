// app/dashboard/DashboardClient.tsx
// Erstellt:     30.05.2026
// Aktualisiert: 21.06.2026 21:30
// Version:      1.0.0
//
// Komplett neu: Grid-zentriertes Layout ohne Tabs.
// Alle Funktionen über Gebäude-Klicks im Grid.
// Rechte Sidebar: Schiff + Cargo + Aufmerksamkeit + Nachrichten.

'use client'

import React, { useState, useEffect } from 'react'
import { useGameStore, ResourceType, LocationSlug, effectiveRange } from '@/lib/store/gameStore'
import { baseTravelSeconds, flightEnergyCost } from '@/lib/game/ships'
import { getToken, getSessionInfo } from '@/lib/supabase/auth'
import TransitPanel     from './TransitPanel'
import ColonyGrid       from './ColonyGrid'
import StationOverlay   from './StationOverlay'
import ShipyardOverlay  from './ShipyardOverlay'
import WarehouseOverlay from './WarehouseOverlay'
import ProfileOverlay   from './ProfileOverlay'
import ColonyDetail     from './ColonyDetail'
import OrderNegotiation from './OrderNegotiation'
import MarketAuction    from './MarketAuction'
import WelcomeSetup     from './WelcomeSetup'
import { TipBanner, TipDef } from './TipSystem'
import { worstStatus, resourceStatus, stateColor, stateLabel, attentionItems } from './dashboardStatus'
import { T, Icon, Toast, RESOURCE_LABEL, RESOURCE_ICON, LOC_ICON, LOC_NAME } from './ui'

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
    cargoUsed, loadFromServer, inTransit, shipTypeId,
    invalidate, invalidations, costBasis, shipRange,
  } = useGameStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [worldData, setWorldData]   = useState<any>(null)
  const [playerBuilds, setPlayerBuilds] = useState<any[]>([])
  const [tileEntities, setTileEntities] = useState<any[]>([])
  const [colonyTax, setColonyTax]   = useState<Record<string, any>>({})
  const [entityInfo, setEntityInfo] = useState<Record<string, any>>({})
  const [userId, setUserId]         = useState('')
  const [profile, setProfile]       = useState<any>(null)

  // Overlays
  const [shipyardOpen,   setShipyardOpen]   = useState(false)
  const [warehouseOpen,  setWarehouseOpen]  = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [detailColony,   setDetailColony]   = useState<any>(null)
  const [negotiateOrder, setNegotiateOrder] = useState<any>(null)
  const [auctionOpen,    setAuctionOpen]    = useState(false)
  const [auctionConfig,  setAuctionConfig]  = useState<{
    resource: ResourceType; mode: 'buy' | 'sell'; qty: number; limit: number
  }>({ resource: 'water', mode: 'buy', qty: 10, limit: 0 })

  // ── Laden ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadFromServer() }, [])

  const prevLocationRef = React.useRef(location)
  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location
      loadFromServer()
    }
  }, [location])

  useEffect(() => {
    async function fetchWorld() {
      try { setWorldData(await (await fetch('/api/game/world')).json()) }
      catch {}
    }
    fetchWorld()
    const iv = setInterval(fetchWorld, 30000)
    return () => clearInterval(iv)
  }, [])

  async function fetchBuilds() {
    try {
      const { token, userId: uid } = await getSessionInfo()
      setUserId(uid)
      const data = await (await fetch('/api/game/build', { headers: { Authorization: `Bearer ${token}` } })).json()
      setPlayerBuilds(data.builds ?? [])
      setTileEntities(data.entities ?? [])
      setColonyTax(data.colonyTax ?? {})
      setEntityInfo(data.entityInfo ?? {})
    } catch {}
  }
  useEffect(() => { fetchBuilds() }, [])
  useEffect(() => { fetchBuilds() }, [invalidations.builds])

  async function fetchProfile() {
    try {
      const token = await getToken()
      const data = await (await fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` } })).json()
      setProfile(data.profile)
    } catch {}
  }
  useEffect(() => { fetchProfile() }, [])

  // ── Abgeleitete Daten ──────────────────────────────────────────────────────
  const locations           = worldData?.locations ?? initialLocations
  const news                = worldData?.news ?? []
  const stats               = worldData?.stats
  const currentLocationData = locations.find((l: any) => l.slug === location)
  const currentPrices       = prices.filter((p: any) => p.locations?.slug === location)
  const used                = cargoUsed()
  const cargoFree           = cargoMax - used
  const reach               = effectiveRange(shipRange, used)
  const attention           = attentionItems(locations)
  const totalPop            = stats?.totalPopulation ?? locations.reduce((s: number, l: any) => s + l.population, 0)

  const propertyByLocation: Record<string, number> = {}
  for (const e of tileEntities) {
    const slug = e.locations?.slug
    if (slug) propertyByLocation[slug] = (propertyByLocation[slug] ?? 0) + 1
  }
  const propertySlugs    = Array.from(new Set<string>([location, ...Object.keys(propertyByLocation)]))
  const propertyLocations = propertySlugs.map(s => locations.find((l: any) => l.slug === s)).filter(Boolean)

  // Beste Route
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

  // ── Handler ────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 2500)
  }

  function openAuction(resource: ResourceType, mode: 'buy' | 'sell', qty: number, limit: number) {
    setAuctionConfig({ resource, mode, qty: Math.max(1, qty), limit })
    setAuctionOpen(true)
  }

  async function handleTravel(dest: string) {
    if (!inTransit) await travel(dest as LocationSlug, stats?.tickNumber ?? 0)
  }

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    await (await import('@/lib/supabase/client')).createClient().auth.signOut()
    window.location.href = '/auth/login'
  }

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg }
  const metricLabel: React.CSSProperties = { fontSize: '0.6rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: 'system-ui, sans-serif' }}>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      <TransitPanel onArrival={() => {}} />

      {profile && !profile.onboarded && (
        <WelcomeSetup onDone={() => { fetchProfile(); window.location.reload() }} />
      )}

      {/* ── OVERLAYS ──────────────────────────────────────────────────────── */}
      {auctionOpen && (
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
          onTrade={async (resource, mode, amount, price) => {
            const result = mode === 'buy'
              ? await buy(resource, price, amount)
              : await sell(resource, price, amount)
            showToast(result.msg, result.ok)
            return result.ok
          }}
        />
      )}

      {warehouseOpen && (
        <WarehouseOverlay
          locationSlug={location as LocationSlug}
          locationName={currentLocationData?.name ?? LOC_NAME[location]}
          prices={prices}
          resources={currentLocationData?.location_resources ?? []}
          orders={initialOrders.filter((o: any) => o.locations?.slug === location)}
          cargo={cargo}
          cargoMax={cargoMax}
          credits={credits}
          onTrade={async (resource, mode, amount, price) => {
            const result = mode === 'buy'
              ? await buy(resource, price, amount)
              : await sell(resource, price, amount)
            showToast(result.msg, result.ok)
            return result.ok
          }}
          onFulfillOrder={async (orderId, agreedReward) => {
            const token = await getToken()
            const res = await fetch(
              `/api/game/orders?action=fulfill&orderId=${orderId}&agreedReward=${Math.round(agreedReward)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            const data = await res.json()
            if (data.ok) { showToast(`Auftrag erfüllt! +${data.reward?.toLocaleString('de')} Cr`, true); await loadFromServer() }
            else showToast(data.error, false)
            return data.ok
          }}
          onClose={() => setWarehouseOpen(false)}
        />
      )}

      {profileOpen && profile && (
        <ProfileOverlay
          username={profile.username ?? '?'}
          avatar={profile.avatar ?? 'pilot_01'}
          credits={credits}
          onClose={() => setProfileOpen(false)}
        />
      )}

      <ColonyDetail
        colony={detailColony}
        isHere={detailColony?.slug === location}
        cargo={cargo}
        onClose={() => setDetailColony(null)}
        onTravel={handleTravel}
      />

      <ShipyardOverlay
        open={shipyardOpen}
        onClose={() => setShipyardOpen(false)}
        currentShipTypeId={shipTypeId ?? 'freighter_mk1'}
        credits={credits}
        onBuyShip={async (type) => {
          const token = await getToken()
          const data = await (await fetch(`/api/game/ships?action=buy&shipTypeId=${type}`, { headers: { Authorization: `Bearer ${token}` } })).json()
          if (data.ok) { showToast(`${type} gekauft!`, true); await loadFromServer(); setShipyardOpen(false) }
          else showToast(data.error ?? 'Kauf fehlgeschlagen', false)
        }}
      />

      <OrderNegotiation
        order={negotiateOrder ? {
          ...negotiateOrder,
          stock: currentLocationData?.location_resources?.find((r: any) => r.resource === negotiateOrder.resource)?.stock,
        } : null}
        onClose={() => setNegotiateOrder(null)}
        canFulfill={negotiateOrder?.locations?.slug === location && (cargo[negotiateOrder?.resource as ResourceType] ?? 0) >= negotiateOrder?.amount}
        fulfillHint={negotiateOrder?.locations?.slug !== location ? 'Falscher Standort.' : 'Nicht genug Ladung.'}
        onAccept={async (id, bonus) => {
          const token = await getToken()
          const data = await (await fetch(`/api/game/orders?action=fulfill&orderId=${id}&agreedReward=${Math.round(bonus)}`, { headers: { Authorization: `Bearer ${token}` } })).json()
          if (data.ok) { showToast(`Auftrag erfüllt! +${data.reward?.toLocaleString('de')} Cr`, true); await loadFromServer() }
          else showToast(data.error, false)
          return data.ok
        }}
      />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header style={{
        background: T.surface, borderBottom: `1px solid ${T.line}`,
        padding: '0 2rem', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.14em', color: T.blue, fontSize: '1.3rem', margin: 0 }}>
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          <span style={{ fontSize: '0.5rem', letterSpacing: '0.3em', color: T.gold, marginLeft: '1rem', verticalAlign: 'middle', textTransform: 'uppercase' }}>Alpha 0.1</span>
        </h1>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {[
            ['Credits',    `${credits.toLocaleString('de')} Cr`],
            ['Frachter',   `${used} / ${cargoMax} t`],
            ['Standort',   `${LOC_ICON[location]} ${LOC_NAME[location]}`],
            ['Bevölkerung', totalPop.toLocaleString('de')],
          ].map(([l, v], i) => (
            <div key={i}>
              <div style={metricLabel}>{l}</div>
              <div style={{ fontWeight: 700, color: T.blue, fontSize: '0.88rem', marginTop: '2px' }}>{v}</div>
            </div>
          ))}

          {/* Avatar → Profil */}
          <button
            onClick={() => setProfileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            title="Profil öffnen"
          >
            {profile?.avatar
              ? <img src={`/images/avatars/${profile.avatar}.png`} alt=""
                  style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${T.gold}` }} />
              : <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.blue, border: `2px solid ${T.gold}` }} />
            }
          </button>

          <button
            onClick={handleLogout}
            style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: T.radius, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {Icon.logout(T.blue)} Abmelden
          </button>
        </div>
      </header>

      {/* ── HAUPTINHALT ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1.5rem 3rem', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LINKE SPALTE: Grid + Tipps + Orte ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Tipps */}
          {(() => {
            const localEntities = tileEntities.filter((e: any) => e.locations?.slug === location)
            const hasSchool = localEntities.some((e: any) => e.entity_id === 'school')
            const hasAdmin  = localEntities.some((e: any) => e.entity_id === 'admin')
            const ownBuilds = tileEntities.filter((e: any) => e.profile_id === userId).length
            const tips: TipDef[] = [
              { id: 'tip_energy',    icon: '⚡', condition: cargo.energy === 0 && !inTransit,                              text: 'Keine Energie an Bord. Klicke auf das Warenhaus im Grid um Energie zu kaufen.' },
              { id: 'tip_school',    icon: '🎓', condition: hasSchool,                                                      text: 'Klicke auf die Akademie im Grid um Aufgaben zu lösen und das Handbuch zu lesen.' },
              { id: 'tip_admin',     icon: '🏛️', condition: hasAdmin,                                                       text: 'Klicke auf die Verwaltung im Grid für Koloniedetails und Aufträge.' },
              { id: 'tip_build',     icon: '🏗️', condition: ownBuilds === 0,                                               text: 'Noch keine Gebäude. Klicke auf eine freie Kachel im Grid um zu bauen.' },
              { id: 'tip_prometheus',icon: '🛸', condition: location === 'earth',                                           text: 'Prometheus (L5) ist nur 11s entfernt — ideal als erste Zwischenstation.' },
            ]
            return <TipBanner tips={tips} />
          })()}

          {/* Grid oder Station */}
          {currentLocationData?.location_type === 'station' || location === 'prometheus' ? (
            <StationOverlay
              slug={location}
              name={currentLocationData?.name ?? 'Station'}
              population={currentLocationData?.population ?? 0}
              populationMax={currentLocationData?.population_max ?? 1}
              userId={userId}
              locationId={currentLocationData?.id ?? ''}
              locationResources={currentLocationData?.location_resources ?? []}
              credits={credits}
              entities={tileEntities.filter((e: any) => e.locations?.slug === location)}
              onChanged={async () => { await loadFromServer(); invalidate('builds') }}
            />
          ) : (
            <ColonyGrid
              slug={location}
              name={currentLocationData?.name ?? location}
              population={currentLocationData?.population ?? 0}
              populationMax={currentLocationData?.population_max ?? 1}
              isSupplied={currentLocationData?.is_supplied ?? false}
              userId={userId}
              tax={colonyTax[currentLocationData?.id ?? '']}
              entityInfo={entityInfo}
              locationResources={currentLocationData?.location_resources ?? []}
              credits={credits}
              allLocations={locations.filter((l: any) => l.slug !== location)}
              cargo={cargo as unknown as Record<string, number>}
              shipRange={shipRange}
              currentTick={stats?.tickNumber ?? 0}
              inTransit={inTransit}
              onTravel={handleTravel}
              onOpenShipyard={() => setShipyardOpen(true)}
              onOpenWarehouse={() => setWarehouseOpen(true)}
              onChanged={async () => { await loadFromServer(); invalidate('builds') }}
              entities={tileEntities.filter((e: any) => e.locations?.slug === location && e.tile_row != null)}
              pending={playerBuilds
                .filter((b: any) => b.locations?.slug === location)
                .map((b: any) => ({ buildable_id: b.buildable_id, tile_row: b.tile_row, tile_col: b.tile_col, status: b.status }))}
            />
          )}

          {/* Deine Orte */}
          {propertyLocations.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: '0.5rem' }}>Deine Orte</div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {propertyLocations.map((loc: any) => {
                  const isHere   = loc.slug === location
                  const gebaeude = propertyByLocation[loc.slug] ?? 0
                  return (
                    <div key={loc.id} onClick={() => setDetailColony(loc)}
                      style={{ ...card, padding: '0.65rem 1rem', cursor: 'pointer', borderLeft: `3px solid ${isHere ? T.gold : T.blue}`, minWidth: '120px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: T.blueDeep, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}
                        {isHere && <span style={{ fontSize: '0.48rem', background: T.gold, color: '#fff', borderRadius: '3px', padding: '1px 5px' }}>HIER</span>}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: T.inkFaint, marginTop: '2px' }}>{gebaeude > 0 ? `${gebaeude} Gebäude` : 'kein Gebäude'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RECHTE SIDEBAR ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '76px' }}>

          {/* Kolonie-Status */}
          {currentLocationData && (() => {
            const worst  = worstStatus(currentLocationData)
            const popPct = Math.round((currentLocationData.population / Math.max(1, currentLocationData.population_max)) * 100)
            return (
              <div style={{ ...card, padding: '0.9rem 1rem', borderLeft: `3px solid ${worst ? stateColor(worst.state, T) : T.green}` }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', color: T.blueDeep, marginBottom: '0.35rem' }}>
                  {LOC_ICON[location]} {currentLocationData.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: T.inkSoft, marginBottom: '0.5rem' }}>
                  {currentLocationData.population.toLocaleString('de')} Einwohner · {popPct}% Auslastung
                </div>
                {(currentLocationData.location_resources ?? []).map((r: any) => {
                  const s = resourceStatus(r)
                  return (
                    <div key={r.resource} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor(s.state, T), flexShrink: 0 }} />
                      <span>{RESOURCE_ICON[r.resource]} {r.stock}t · {stateLabel(s)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Schiff & Cargo */}
          <div style={{ ...card, padding: '0.9rem 1rem' }}>
            <div style={metricLabel}>An Bord · {shipTypeId ?? 'Frachter'}</div>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {used > 0
                ? (Object.entries(cargo) as [ResourceType, number][]).filter(([, v]) => v > 0).map(([res, amt]) => (
                  <div key={res} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span>{RESOURCE_ICON[res]} {RESOURCE_LABEL[res]}</span>
                    <span style={{ fontWeight: 700, color: T.blue }}>{amt}t</span>
                  </div>
                ))
                : <span style={{ fontSize: '0.75rem', color: T.inkFaint }}>Laderaum leer</span>
              }
            </div>
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${T.lineSoft}`, fontSize: '0.68rem', color: T.inkFaint, display: 'flex', justifyContent: 'space-between' }}>
              <span>Frei</span>
              <span style={{ fontWeight: 600 }}>{cargoFree}t / {cargoMax}t</span>
            </div>
          </div>

          {/* Beste Route */}
          {best && (
            <div style={{ ...card, padding: '0.9rem 1rem', borderTop: `3px solid ${T.gold}` }}>
              <div style={metricLabel}>Beste Route</div>
              <div style={{ fontSize: '0.75rem', color: T.inkSoft, margin: '0.35rem 0 0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {LOC_ICON[best.from]} {LOC_NAME[best.from]} {Icon.arrow(T.inkFaint)} {LOC_ICON[best.to]} {LOC_NAME[best.to]}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: T.blueDeep }}>{RESOURCE_ICON[best.resource]} {RESOURCE_LABEL[best.resource]}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: T.green, fontFamily: 'Georgia, serif' }}>
                +{best.profit}<span style={{ fontSize: '0.7rem', color: T.inkFaint, fontFamily: 'system-ui' }}> Cr/t</span>
              </div>
            </div>
          )}

          {/* Aufmerksamkeit */}
          {attention.length > 0 && (
            <div style={{ ...card, padding: '0.75rem 1rem' }}>
              <div style={metricLabel}>Braucht Aufmerksamkeit</div>
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {attention.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', color: T.ink }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: a.level === 'critical' ? T.red : '#d08020' }} />
                    {a.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nachrichten */}
          {news.length > 0 && (
            <div style={{ ...card, padding: '0.75rem 1rem' }}>
              <div style={metricLabel}>Nachrichten</div>
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {news.slice(0, 4).map((n: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.73rem', color: T.inkSoft, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <span>{n.icon}</span><span>{n.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
