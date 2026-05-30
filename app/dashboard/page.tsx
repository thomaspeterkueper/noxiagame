import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 30  // alle 30 Sekunden neu laden

async function getGameData() {
  const supabase = createServiceClient()

  const [{ data: locations }, { data: prices }, { data: orders }] = await Promise.all([
    supabase
      .from('locations')
      .select('*, location_resources(resource, stock, consumption, production)')
      .order('slug'),
    supabase
      .from('market_prices')
      .select('*, locations(slug)'),
    supabase
      .from('trade_orders')
      .select('*, locations(slug, name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return { locations: locations ?? [], prices: prices ?? [], orders: orders ?? [] }
}

export default async function Dashboard() {
  const { locations, prices, orders } = await getGameData()

  return (
    <main className="min-h-screen bg-[#040910] text-[#b8d4e8] p-6">

      {/* Topbar */}
      <div className="flex items-center justify-between mb-8 border-b border-[#162f4a] pb-4">
        <h1 className="font-mono text-xl font-black tracking-[0.3em] text-[#00c8ff]">
          NOX<span className="text-[#ff6b2b]">IA</span>
        </h1>
        <span className="text-[#3a6080] text-xs tracking-widest uppercase">Alpha 0.1</span>
      </div>

      {/* Kolonien */}
      <section className="mb-10">
        <h2 className="text-xs tracking-widest uppercase text-[#3a6080] mb-4">Kolonien</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {locations.map((loc: any) => {
            const popPct = Math.round((loc.population / loc.population_max) * 100)
            return (
              <div key={loc.id} className="border border-[#162f4a] bg-[#08121e] p-5 rounded">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-sm text-[#00c8ff] tracking-widest">
                      {loc.slug.toUpperCase()}
                    </div>
                    <div className="text-xs text-[#3a6080] mt-0.5">{loc.name}</div>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded font-mono ${
                    loc.is_supplied
                      ? 'bg-[#00ff9d22] text-[#00ff9d]'
                      : 'bg-[#ff224422] text-[#ff2244]'
                  }`}>
                    {loc.is_supplied ? 'VERSORGT' : 'MANGEL'}
                  </div>
                </div>

                {/* Bevölkerung */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#3a6080]">Bevölkerung</span>
                    <span className="font-mono">{loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}</span>
                  </div>
                  <div className="h-1 bg-[#162f4a] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#00c8ff] rounded"
                      style={{ width: `${popPct}%` }}
                    />
                  </div>
                </div>

                {/* Ressourcen */}
                <div className="space-y-1.5">
                  {(loc.location_resources ?? []).map((r: any) => {
                    const icon = r.resource === 'water' ? '💧' : r.resource === 'energy' ? '⚡' : '⛏️'
                    const label = r.resource === 'water' ? 'Wasser' : r.resource === 'energy' ? 'Energie' : 'Metall'
                    const balance = r.production - r.consumption
                    return (
                      <div key={r.resource} className="flex items-center justify-between text-xs">
                        <span className="text-[#3a6080]">{icon} {label}</span>
                        <div className="flex gap-3 font-mono">
                          <span>{r.stock}t</span>
                          <span className={balance >= 0 ? 'text-[#00ff9d]' : 'text-[#ff2244]'}>
                            {balance >= 0 ? '+' : ''}{balance}/Tick
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Marktpreise */}
      <section className="mb-10">
        <h2 className="text-xs tracking-widest uppercase text-[#3a6080] mb-4">Marktpreise</h2>
        <div className="border border-[#162f4a] bg-[#08121e] rounded overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#162f4a] text-[#3a6080]">
                <th className="text-left p-3">Ort</th>
                <th className="text-left p-3">Ressource</th>
                <th className="text-right p-3">Kaufen</th>
                <th className="text-right p-3">Verkaufen</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p: any) => (
                <tr key={p.id} className="border-b border-[#162f4a] last:border-0 hover:bg-[#0c1928]">
                  <td className="p-3 text-[#00c8ff]">{p.locations?.slug?.toUpperCase()}</td>
                  <td className="p-3 capitalize">{p.resource}</td>
                  <td className="p-3 text-right text-[#ff2244]">{p.buy_price} Cr</td>
                  <td className="p-3 text-right text-[#00ff9d]">{p.sell_price} Cr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Offene Aufträge */}
      <section>
        <h2 className="text-xs tracking-widest uppercase text-[#3a6080] mb-4">Offene Aufträge</h2>
        {orders.length === 0 ? (
          <div className="border border-[#162f4a] bg-[#08121e] rounded p-6 text-center text-[#3a6080] text-xs">
            Keine offenen Aufträge – Ressourcen sind ausreichend vorhanden.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.id} className="border border-[#162f4a] bg-[#08121e] rounded p-4 flex items-center justify-between">
                <div>
                  <span className="text-[#00c8ff] font-mono text-sm">
                    {o.locations?.name}
                  </span>
                  <span className="text-[#3a6080] text-xs ml-3">
                    benötigt {o.amount}t {o.resource}
                  </span>
                </div>
                <div className="text-[#00ff9d] font-mono text-sm">
                  +{o.reward.toLocaleString('de')} Cr
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  )
}