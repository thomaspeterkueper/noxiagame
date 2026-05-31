// app/dashboard/StatisticsTab.tsx
// Erstellt: 31.05.2026

'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

// Konstanten für Labels und Icons
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const LOC_ICON:       Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }
const LOC_NAME:       Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }

interface Trade {
  id:           string
  from_location: string
  to_location:  string
  resource:     string
  amount:       number
  profit:       number
  traded_at:    string
}

interface Statistics {
  totalProfit:          number
  totalTrades:          number
  bestRoute:            { from: string; to: string; resource: string; profit: number } | null
  mostTradedResource:   { resource: string; amount: number } | null
  waterDelivered:       number
  energyDelivered:      number
  metalDelivered:       number
  weeklyProfit:         { date: string; profit: number }[]
  topProfitTrade:       { profit: number; resource: string; from: string; to: string } | null
}

export default function StatisticsTab({ locations }: { locations: any[] }) {
  const { credits, trades, loadTrades } = useGameStore()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  // Trades beim Mount laden
  useEffect(() => {
    async function load() {
      await loadTrades()
      setLoading(false)
    }
    load()
  }, [])

  // Statistiken berechnen wenn Trades geladen
  useEffect(() => {
    if (!trades.length) return

    let totalProfit = 0
    let waterDelivered = 0
    let energyDelivered = 0
    let metalDelivered = 0
    const routeProfit: Record<string, number> = {}
    const resourceAmount: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    let topProfitTrade: Statistics['topProfitTrade'] = null
    const dailyProfit: Record<string, number> = {}

    for (const t of trades) {
      totalProfit += t.profit

      // Bester Einzelhandel
      if (t.profit > (topProfitTrade?.profit ?? 0)) {
        topProfitTrade = {
          profit:   t.profit,
          resource: t.resource,
          from:     t.from_location,
          to:       t.to_location,
        }
      }

      // Lieferungen zählen (nur Verkäufe = positiver Profit)
      if (t.profit > 0) {
        if (t.resource === 'water')  waterDelivered  += t.amount
        if (t.resource === 'energy') energyDelivered += t.amount
        if (t.resource === 'metal')  metalDelivered  += t.amount
      }

      // Ressourcen-Mengen
      resourceAmount[t.resource] = (resourceAmount[t.resource] ?? 0) + t.amount

      // Routen-Profit
      if (t.from_location && t.to_location && t.from_location !== t.to_location) {
        const key = `${t.from_location}→${t.to_location}:${t.resource}`
        routeProfit[key] = (routeProfit[key] ?? 0) + t.profit
      }

      // Täglicher Profit
      const date = new Date(t.traded_at).toISOString().split('T')[0]
      dailyProfit[date] = (dailyProfit[date] ?? 0) + t.profit
    }

    // Beste Route
    let bestRoute: Statistics['bestRoute'] = null
    for (const [key, profit] of Object.entries(routeProfit)) {
      const parts = key.split(/[→:]/)
      if (profit > (bestRoute?.profit ?? -Infinity)) {
        bestRoute = { from: parts[0], to: parts[1], resource: parts[2], profit }
      }
    }

    // Meistgehandelte Ressource
    let mostTradedResource: Statistics['mostTradedResource'] = null
    for (const [res, amount] of Object.entries(resourceAmount)) {
      if (amount > (mostTradedResource?.amount ?? 0)) {
        mostTradedResource = { resource: res, amount }
      }
    }

    // Wochenprofit (letzte 7 Tage)
    const weeklyProfit = Object.entries(dailyProfit)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, profit]) => ({ date: date.slice(5), profit }))

    setStats({
      totalProfit,
      totalTrades:  trades.length,
      bestRoute,
      mostTradedResource,
      waterDelivered,
      energyDelivered,
      metalDelivered,
      weeklyProfit,
      topProfitTrade,
    })
  }, [trades])

  // Ladestate
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        Lade Statistiken...
      </div>
    )
  }

  // Keine Daten
  if (!stats || trades.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '0.9rem' }}>Noch keine Handelsdaten.</div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Führe deine ersten Transaktionen durch – dann erscheinen hier deine Statistiken.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Vermögensübersicht */}
      <div style={{
        background: 'linear-gradient(135deg, #2a4e7a 0%, #1a3a5a 100%)',
        borderRadius: '8px', padding: '1.5rem', color: '#fff',
      }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '3px', opacity: 0.7, marginBottom: '0.3rem' }}>
          Gesamtvermögen
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>
          {credits.toLocaleString('de')} Cr
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.25rem' }}>
          {stats.totalTrades} Transaktionen · {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toLocaleString('de')} Cr Gesamtgewinn
        </div>
      </div>

      {/* Zwei Spalten: Handelsentwicklung + Kolonienwachstum */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* Handelsentwicklung */}
        <div style={{ background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '1rem' }}>
            📈 Handelsentwicklung
          </div>

          {/* Wochenchart */}
          {stats.weeklyProfit.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Letzte 7 Tage</div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-end', height: '80px' }}>
                {stats.weeklyProfit.map((day, i) => {
                  const maxVal = Math.max(...stats.weeklyProfit.map(d => Math.abs(d.profit)), 1)
                  const height = (Math.abs(day.profit) / maxVal) * 70
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '100%', height: `${Math.max(4, height)}px`,
                        background: day.profit >= 0 ? '#27ae60' : '#c0392b',
                        borderRadius: '2px',
                      }} />
                      <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: '0.25rem' }}>{day.date}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Beste Route */}
          {stats.bestRoute && (
            <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#f4f2ed', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '0.25rem' }}>🏆 Beste Route</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2a4e7a' }}>
                {LOC_ICON[stats.bestRoute.from] ?? '●'} {LOC_NAME[stats.bestRoute.from] ?? stats.bestRoute.from}
                {' → '}
                {LOC_ICON[stats.bestRoute.to] ?? '●'} {LOC_NAME[stats.bestRoute.to] ?? stats.bestRoute.to}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {RESOURCE_ICON[stats.bestRoute.resource]} {RESOURCE_LABEL[stats.bestRoute.resource]} · +{stats.bestRoute.profit.toLocaleString('de')} Cr
              </div>
            </div>
          )}

          {/* Meistgehandelt */}
          {stats.mostTradedResource && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.4rem 0', borderTop: '1px solid #f1f1f1' }}>
              <span style={{ color: '#64748b' }}>Meist gehandelt</span>
              <span style={{ fontWeight: 600 }}>
                {RESOURCE_ICON[stats.mostTradedResource.resource]} {stats.mostTradedResource.amount.toLocaleString('de')}t
              </span>
            </div>
          )}

          {/* Bester Einzelhandel */}
          {stats.topProfitTrade && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.4rem 0', borderTop: '1px solid #f1f1f1' }}>
              <span style={{ color: '#64748b' }}>Bester Einzelhandel</span>
              <span style={{ fontWeight: 600, color: '#27ae60' }}>+{stats.topProfitTrade.profit.toLocaleString('de')} Cr</span>
            </div>
          )}
        </div>

        {/* Koloniewachstum */}
        <div style={{ background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '1rem' }}>
            🌍 Koloniewachstum
          </div>

          {/* Lieferungen */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Deine Lieferungen</div>
            {[
              { res: 'water',  label: '💧 Wasser',  amount: stats.waterDelivered,  color: '#3b82f6' },
              { res: 'energy', label: '⚡ Energie', amount: stats.energyDelivered, color: '#f59e0b' },
              { res: 'metal',  label: '⛏️ Metall',  amount: stats.metalDelivered,  color: '#8b5cf6' },
            ].filter(r => r.amount > 0).map(r => (
              <div key={r.res} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ width: '70px' }}>{r.label}</span>
                <div style={{ flex: 1, background: '#f1f1f1', borderRadius: '3px', overflow: 'hidden', height: '6px' }}>
                  <div style={{ width: `${Math.min(100, (r.amount / 500) * 100)}%`, height: '100%', background: r.color }} />
                </div>
                <span style={{ fontWeight: 600, width: '40px', textAlign: 'right' }}>{r.amount}t</span>
              </div>
            ))}
            {stats.waterDelivered === 0 && stats.energyDelivered === 0 && stats.metalDelivered === 0 && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Noch keine Lieferungen.</div>
            )}
          </div>

          {/* Kolonien-Status */}
          <div style={{ borderTop: '1px solid #f1f1f1', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Aktueller Koloniezustand</div>
            {locations.map((loc: any) => (
              <div key={loc.id} style={{ marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                  <span>{LOC_ICON[loc.slug]} {LOC_NAME[loc.slug]}</span>
                  <span style={{ color: '#64748b' }}>{loc.population.toLocaleString('de')} Einw.</span>
                </div>
                <div style={{ background: '#f1f1f1', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(loc.population / loc.population_max) * 100}%`,
                    height: '100%',
                    background: loc.is_supplied ? '#27ae60' : '#c0392b',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Erfolge */}
      <div style={{ background: '#f4f2ed', border: '1px solid #e2ddd4', borderRadius: '8px', padding: '1rem' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '1rem' }}>
          🎯 Deine Erfolge
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'space-around' }}>
          {[
            { icon: '🎯', value: stats.totalTrades.toString(), label: 'Transaktionen' },
            { icon: '💰', value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toLocaleString('de')} Cr`, label: 'Gesamtgewinn' },
            { icon: '💧', value: `${stats.waterDelivered}t`, label: 'Wasser geliefert' },
            { icon: '🚀', value: stats.bestRoute ? `${LOC_ICON[stats.bestRoute.from]}→${LOC_ICON[stats.bestRoute.to]}` : '-', label: 'Beste Route' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{item.icon}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2a4e7a' }}>{item.value}</div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.2rem' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}