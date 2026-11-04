'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'

type Player = {
  id: string
  username: string
  created_at: string | null
  last_session_at: string | null
  last_seen_at: string | null
  sessions: number
  actions: number
  is_admin: boolean
}
type Overview = {
  observed_at: string
  definition: string
  complete: boolean
  metrics: {
    registered_accounts: number; player_profiles: number
    registrations_24h: number; registrations_7d: number; registrations_30d: number
    online_2m: number; active_5m: number; active_24h: number; active_7d: number
    admins: number; session_records: number
  }
  players: Player[]
}
const cards: Array<[keyof Overview['metrics'], string]> = [
  ['registered_accounts', 'Registrierte Konten'],
  ['player_profiles', 'Spielerprofile'],
  ['online_2m', 'Jetzt online (2 Min.)'],
  ['active_5m', 'Spielsitzung (5 Min.)'],
  ['active_24h', 'Aktiv in 24 Stunden'],
  ['active_7d', 'Aktiv in 7 Tagen'],
  ['registrations_7d', 'Neue Konten (7 Tage)'],
]
const modules = [
  { href: '/admin/wuensche', title: 'Wünsche & Gebete', description: 'Wünsche prüfen und bearbeiten' },
]
const time = (s: string | null) => s ? new Date(s).toLocaleString('de-DE') : 'Keine Aktivität erfasst'

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const { token } = await getSessionInfo()
      if (!token) { setError('Bitte zuerst mit deinem NOXIA-Spielerkonto anmelden.'); return }
      const response = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { setError(String(result.error ?? 'Admin-Daten nicht erreichbar')); return }
      setData(result as Overview)
      setError('')
    } catch {
      setError('Verbindung zur Verwaltung fehlgeschlagen.')
    } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const players = (data?.players ?? []).filter(p => p.username.toLowerCase().includes(filter.toLowerCase()))
  const online = (s: string | null) => Boolean(s && Date.now() - Date.parse(s) >= 0 && Date.now() - Date.parse(s) < 120000)

  return <main className="min-h-screen bg-[#f6f4ee] px-4 py-10 text-[#1d2a30]">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-[#53777a]">noχ¹ᐃ · Control Center</p>
          <h1 className="mt-2 text-3xl font-bold">Adminbereich</h1>
          <p className="mt-2 text-sm text-[#5d6b70]">Spieler und Testaktivität · Daten nur für autorisierte Administratoren</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? 'Lädt …' : 'Aktualisieren'}
        </button>
      </header>
      {error && <div role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        {error} <Link className="underline" href="/auth/login">Spielanmeldung</Link>
      </div>}
      {data && <>
        {!data.complete && <p role="status" className="mb-4 text-amber-900">Datensatzgrenze erreicht – die Werte können unvollständig sein.</p>}
        <section aria-label="Spielerkennzahlen" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {cards.map(([key, label]) => <article key={key} className="rounded-xl border border-[#ded9ca] bg-white p-4">
            <p className="text-xs text-[#63737a]">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{data.metrics[key]}</p>
          </article>)}
        </section>
        <p className="mb-7 text-xs text-[#63737a]">
          {data.definition} Admin-Konten werden aus den Aktivitätskennzahlen ausgeschlossen.
          Stand: {time(data.observed_at)}. Neue Konten: 24 Std. {data.metrics.registrations_24h} · 30 Tage {data.metrics.registrations_30d}.
        </p>
        <section className="mb-8 rounded-xl border border-[#ded9ca] bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Spielerübersicht</h2>
              <p className="text-xs text-[#63737a]">Online: Heartbeat eines sichtbaren Spiel-Dashboards (max. zwei Minuten alt). Sitzungsaktivität ist separat ausgewiesen.</p></div>
            <input aria-label="Spieler suchen" placeholder="Spielername suchen" value={filter}
              onChange={e => setFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b text-[#63737a]"><th className="py-2">Spieler</th><th>Letzter Heartbeat</th><th>Letzte Spielsitzung</th><th>Sitzungen</th><th>Aktionen</th><th>Status</th></tr></thead>
            <tbody>{players.map(p => <tr className="border-b border-[#eee9df]" key={p.id}>
              <td className="py-3 font-medium">{p.username}{p.is_admin ? ' · Admin' : ''}</td>
              <td>{time(p.last_seen_at)}</td><td>{time(p.last_session_at)}</td><td>{p.sessions}</td><td>{p.actions}</td>
              <td>{online(p.last_seen_at) ? 'Online' : 'Offline / unbekannt'}</td>
            </tr>)}</tbody>
          </table></div>
          {players.length === 0 && <p className="py-3 text-sm text-[#63737a]">Keine passenden Spieler.</p>}
        </section>
      </>}
      <section>
        <h2 className="mb-3 text-xl font-bold">Verwaltungsmodule</h2>
        <nav aria-label="Adminfunktionen" className="grid gap-3 sm:grid-cols-2">
          {modules.map(item => <Link key={item.href} href={item.href}
            className="rounded-xl border border-[#dcd7ca] bg-white p-5 transition hover:border-[#53777a] focus-visible:outline-2 focus-visible:outline-[#1f4f54]">
            <h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm text-[#63737a]">{item.description}</p>
          </Link>)}
        </nav>
      </section>
    </div>
  </main>
}
