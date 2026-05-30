import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 30

async function getGameData() {
  const supabase = createServiceClient()

  const [{ data: locations }, { data: prices }, { data: orders }] = await Promise.all([
    supabase
      .from('locations')
      .select('*, location_resources(resource, stock, consumption, production)')
      .order('slug'),
    supabase
      .from('market_prices')
      .select('*, locations(slug, name)')
      .order('locations(slug)'),
    supabase
      .from('trade_orders')
      .select('*, locations(slug, name)')
      .eq('status', 'open')
      .order('reward', { ascending: false })
      .limit(3),
  ])

  return { locations: locations ?? [], prices: prices ?? [], orders: orders ?? [] }
}

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON: Record<string, string>  = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON: Record<string, string>       = { moon: '🌙', mars: '🔴', phobos: '🪨' }

// Beste Handelschance berechnen
function bestTradeRoute(prices: any[]) {
  let best: { from: string, to: string, resource: string, profit: number } | null = null
  const byResource: Record<string, any[]> = {}

  for (const p of prices) {
    const res = p.resource
    if (!byResource[res]) byResource[res] = []
    byResource[res].push(p)
  }

  for (const [res, locs] of Object.entries(byResource)) {
    for (const a of locs) {
      for (const b of locs) {
        if (a.locations?.slug === b.locations?.slug) continue
        const profit = b.sell_price - a.buy_price
        if (profit > (best?.profit ?? 0)) {
          best = {
            from: a.locations?.slug,
            to: b.locations?.slug,
            resource: res,
            profit,
          }
        }
      }
    }
  }

  return best
}

// Weltmeldungen generieren
function generateWorldNews(locations: any[]) {
  const news: string[] = []
  for (const loc of locations) {
    const name = loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : 'Phobos'
    const icon = LOC_ICON[loc.slug] ?? '●'
    if (!loc.is_supplied) {
      news.push(`${icon} ${name} meldet Versorgungsengpass`)
    }
    if (loc.population > loc.population_max * 0.8) {
      news.push(`${icon} ${name} nähert sich Bevölkerungsgrenze`)
    }
    const water = loc.location_resources?.find((r: any) => r.resource === 'water')
    if (water && water.stock < 100) {
      news.push(`${icon} ${name}: Wasserreserven kritisch (${water.stock}t)`)
    }
  }
  if (news.length === 0) {
    news.push('🟢 Alle Kolonien stabil versorgt')
    news.push('📈 Handelsvolumen im Sonnensystem steigt')
  }
  return news.slice(0, 4)
}

export default async function Dashboard() {
  const { locations, prices, orders } = await getGameData()
  const best = bestTradeRoute(prices)
  const news = generateWorldNews(locations)
  const currentLocation = locations.find((l: any) => l.slug === 'moon')
  const currentPrices = prices.filter((p: any) => p.locations?.slug === 'moon')
  const totalPop = locations.reduce((s: number, l: any) => s + l.population, 0)
  const suppliedCount = locations.filter((l: any) => l.is_supplied).length

  const s = {
    page: { minHeight: '100vh', background: '#f4f2ed', color: '#1e2a36', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
    header: { background: '#fff', borderBottom: '1px solid #e2ddd4', padding: '0 2rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 100 } as React.CSSProperties,
    logo: { fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.15em', color: '#2a4e7a', fontSize: '1.3rem', margin: 0 } as React.CSSProperties,
    section: { marginBottom: '1.5rem' } as React.CSSProperties,
    label: { fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '0.75rem', display: 'block' } as React.CSSProperties,
    card: { background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px' } as React.CSSProperties,
    btnPrimary: { background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' } as React.CSSProperties,
    btnSecondary: { background: '#f4f2ed', color: '#2a4e7a', border: '1px solid #d4cec4', padding: '0.3rem 0.8rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' } as React.CSSProperties,
  }

  return (
    <main style={s.page}>

      {/* TOPBAR */}
      <header style={s.header}>
        <h1 style={s.logo}>
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          <span style={{ fontSize: '0.5rem', letterSpacing: '4px', color: '#b99b6b', marginLeft: '1rem', verticalAlign: 'middle', textTransform: 'uppercase' }}>Alpha 0.1</span>
        </h1>

        {/* Spielerstatus */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Credits</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>5.000 Cr</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Frachter</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>0 / 100 t</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Kolonien versorgt</div>
            <div style={{ fontWeight: 700, color: suppliedCount === locations.length ? '#27ae60' : '#c0392b' }}>
              {suppliedCount} / {locations.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Bevölkerung</div>
            <div style={{ fontWeight: 700, color: '#2a4e7a' }}>{totalPop.toLocaleString('de')}</div>
          </div>
        </div>
      </header>

      {/* WELTMELDUNGEN */}
      <div style={{ background: '#2a4e7a', color: '#fff', padding: '0.6rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '2rem', fontSize: '0.75rem', flexWrap: 'wrap' as const }}>
          {news.map((n, i) => (
            <span key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>{n}</span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>

        {/* 1. KOLONIEN ALS KARTEN */}
        <div style={s.section}>
          <span style={s.label}>Kolonien – Weltstatus</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {locations.map((loc: any) => {
              const popPct = Math.round((loc.population / loc.population_max) * 100)
              const water  = loc.location_resources?.find((r: any) => r.resource === 'water')
              const energy = loc.location_resources?.find((r: any) => r.resource === 'energy')
              const metal  = loc.location_resources?.find((r: any) => r.resource === 'metal')
              const growthPct = loc.is_supplied
                ? `+${(loc.growth_rate * 100).toFixed(1)}%`
                : `-${(loc.decline_rate * 100).toFixed(1)}%`

              const resourceStatus = (r: any) => {
                if (!r) return { label: '—', color: '#94a3b8' }
                const bal = r.production - r.consumption
                if (r.stock < 50)  return { label: 'Kritisch', color: '#c0392b' }
                if (bal < 0)       return { label: 'Sinkend',  color: '#e67e22' }
                if (bal > 0)       return { label: 'Überschuss', color: '#27ae60' }
                return { label: 'Stabil', color: '#64748b' }
              }

              return (
                <div key={loc.id} style={{ ...s.card, padding: '1.25rem', borderTop: `3px solid ${loc.is_supplied ? '#27ae60' : '#c0392b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2a4e7a' }}>
                        {LOC_ICON[loc.slug]} {loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : 'Phobos'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{loc.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Wachstum</div>
                      <div style={{ fontWeight: 700, color: loc.is_supplied ? '#27ae60' : '#c0392b', fontSize: '0.9rem' }}>
                        {growthPct} / Tick
                      </div>
                    </div>
                  </div>

                  {/* Bevölkerung */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.3rem' }}>
                      <span>Bevölkerung</span>
                      <span style={{ fontWeight: 600, color: '#1e2a36' }}>
                        {loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}
                      </span>
                    </div>
                    <div style={{ background: '#f1f1f1', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${popPct}%`, height: '100%', background: '#2a4e7a', borderRadius: '3px' }} />
                    </div>
                  </div>

                  {/* Ressourcenstatus */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { r: water,  label: '💧 Wasser' },
                      { r: energy, label: '⚡ Energie' },
                      { r: metal,  label: '⛏️ Metall' },
                    ].map(({ r, label }) => {
                      const st = resourceStatus(r)
                      return (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                          <span style={{ color: '#64748b' }}>{label}</span>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ color: '#1e2a36' }}>{r?.stock ?? 0}t</span>
                            <span style={{ color: st.color, fontWeight: 600, fontSize: '0.65rem' }}>{st.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f1f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: loc.is_supplied ? '#27ae60' : '#c0392b' }}>
                      {loc.is_supplied ? '✓ Versorgt' : '⚠ Mangel'}
                    </span>
                    <button style={s.btnSecondary}>Details →</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. BESTE HANDELSCHANCE + AUFTRÄGE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Beste Handelschance */}
          <div style={s.section}>
            <span style={s.label}>Beste Handelschance</span>
            {best ? (
              <div style={{ ...s.card, padding: '1.25rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2a4e7a', marginBottom: '0.5rem' }}>
                  {RESOURCE_ICON[best.resource]} {RESOURCE_LABEL[best.resource]}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                  {LOC_ICON[best.from]} {best.from.toUpperCase()} → {LOC_ICON[best.to]} {best.to.toUpperCase()}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#27ae60', marginBottom: '1rem' }}>
                  +{best.profit} Cr / t
                </div>
                <button style={{ ...s.btnPrimary, width: '100%', padding: '0.5rem' }}>
                  Diese Route starten
                </button>
              </div>
            ) : (
              <div style={{ ...s.card, padding: '1.25rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                Keine Arbitrage-Möglichkeit gefunden.
              </div>
            )}
          </div>

          {/* Offene Aufträge */}
          <div style={s.section}>
            <span style={s.label}>Dringende Aufträge</span>
            <div style={s.card}>
              {orders.length === 0 ? (
                <div style={{ padding: '1.25rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
                  Keine offenen Aufträge.<br />
                  <span style={{ fontSize: '0.7rem' }}>Alle Kolonien ausreichend versorgt.</span>
                </div>
              ) : (
                orders.map((o: any, i: number) => (
                  <div key={o.id} style={{
                    padding: '1rem 1.25rem',
                    borderBottom: i < orders.length - 1 ? '1px solid #f1f1f1' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2a4e7a' }}>
                        {LOC_ICON[o.locations?.slug]} {o.locations?.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                        {o.amount}t {RESOURCE_LABEL[o.resource]} · Versorgung kritisch
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#b99b6b', fontSize: '1rem' }}>
                        +{o.reward.toLocaleString('de')} Cr
                      </div>
                      <button style={{ ...s.btnPrimary, marginTop: '0.3rem', fontSize: '0.6rem' }}>
                        Annehmen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. MARKT + AKTIONEN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem' }}>

          {/* Marktpreise aktuelle Kolonie */}
          <div style={s.section}>
            <span style={s.label}>Handelszentrale – Mond / Shackleton</span>
            <div style={s.card}>
              {currentPrices.map((p: any, i: number) => (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 1fr 130px',
                  alignItems: 'center', padding: '0.75rem 1.25rem',
                  borderBottom: i < currentPrices.length - 1 ? '1px solid #f1f1f1' : 'none',
                }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Kauf <strong style={{ color: '#c0392b' }}>{p.buy_price} Cr</strong>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Verk <strong style={{ color: '#27ae60' }}>{p.sell_price} Cr</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <button style={s.btnPrimary}>Kaufen</button>
                    <button style={s.btnSecondary}>Verk.</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flottenkontrolle */}
          <div style={s.section}>
            <span style={s.label}>Flottenkontrolle</span>
            <div style={{ ...s.card, padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.3rem' }}>Frachtraum</div>
                <div style={{ background: '#f1f1f1', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                  <div style={{ width: '0%', height: '100%', background: '#2a4e7a' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>0 / 100 t beladen</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Ziel wählen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {locations.filter((l: any) => l.slug !== 'moon').map((loc: any) => (
                    <button key={loc.id} style={{
                      ...s.btnSecondary,
                      width: '100%', padding: '0.5rem',
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem',
                    }}>
                      <span>{LOC_ICON[loc.slug]} {loc.slug === 'mars' ? 'Mars' : 'Phobos'}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>Sofortflug</span>
                    </button>
                  ))}
                </div>
              </div>

              <button style={{ ...s.btnPrimary, width: '100%', padding: '0.6rem' }}>
                🚀 Abflug starten
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}