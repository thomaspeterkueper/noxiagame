'use client'

// app/admin/wuensche/page.tsx
// Admin-Bereich: Was wünschen sich die Leute, wie viele, was ist daraus geworden?
// Ablehnen, anpassen, erfüllen (Thomas, 29.10.2026). Private Anliegen aus dem echten
// Leben werden nur gezählt, nie im Wortlaut gezeigt.

import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'

type Cluster = { key: string; summary: string; category: string | null; count: number; people: number; statuses: Record<string, number>; last: string }
type Wish = { id: string; created_at: string; source: string; channel: string; status: string; reason: string | null; private?: boolean; place_name?: string | null; text?: string; category?: string | null; summary?: string | null; cluster_key?: string | null; decided_by?: string | null; fulfilment?: Record<string, unknown> | null; admin_note?: string | null; who?: string | null; sense?: number | null }

const STATUS_LABEL: Record<string, string> = { neu: 'neu', privat: 'privat', abgelehnt: 'abgelehnt', sammelt: 'sammelt Stimmen', erfuellt: 'erfüllt', in_arbeit: 'in Arbeit (Entwicklung)', angenommen: 'angenommen' }
const CATEGORIES = ['gemeinschaft', 'versorgung', 'ort', 'entwicklung', 'person', 'innerlich', 'sonstiges']
const CHANNEL_LABEL: Record<string, string> = { fuerbitte: 'Gebet/Fürbitte', gespraech: 'im Gespräch', resonanz: 'Resonanzplatz', wunschbrunnen: 'Wunschbrunnen', figur: 'Figur' }

export default function WishesAdminPage() {
  const [data, setData] = useState<{ totals: Record<string, number>; clusters: Cluster[]; wishes: Wish[] } | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ summary: '', category: '', clusterKey: '', note: '' })
  const [busy, setBusy] = useState(false)

  const fetchData = useCallback(async () => {
    const { token } = await getSessionInfo()
    const response = await fetch('/api/admin/wishes', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
    const json = await response.json().catch(() => ({}))
    return response.ok ? { data: json, error: '' } : { data: null, error: String(json.error ?? 'Nicht erreichbar') }
  }, [])
  const load = useCallback(async () => {
    const result = await fetchData()
    setError(result.error)
    if (result.data) setData(result.data)
  }, [fetchData])
  useEffect(() => {
    let live = true
    void fetchData().then(result => { if (!live) return; setError(result.error); if (result.data) setData(result.data) })
    return () => { live = false }
  }, [fetchData])

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/admin/wishes', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, ...extra }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) setError(json.error ?? 'Fehlgeschlagen')
      setEditing(null)
      await load()
    } finally { setBusy(false) }
  }

  const shown = (data?.wishes ?? []).filter(wish => !filter || wish.status === filter || wish.cluster_key === filter)

  return <main className="admin">
    <header><h1>Wünsche und Gebete</h1><p>Was sich Spieler und Figuren wünschen, wie viele es tragen, und was die Welt daraus gemacht hat. Kleine, sinnvolle Wünsche erfüllt das Spiel sofort; große erst, wenn sie von mindestens drei getragen werden. Private Anliegen aus dem echten Leben bleiben unsichtbar.</p></header>
    {error && <p className="error">{error}</p>}
    {!data && !error && <p>Lädt …</p>}
    {data && <>
      <section className="totals">{Object.entries(data.totals).map(([status, n]) => <button key={status} className={filter === status ? 'on' : ''} onClick={() => setFilter(filter === status ? '' : status)}><b>{n}</b> {STATUS_LABEL[status] ?? status}</button>)}</section>
      <section><h2>Bündel</h2>
        {data.clusters.length === 0 && <p className="muted">Noch keine Wünsche.</p>}
        <table><thead><tr><th>Wunsch</th><th>Art</th><th>Menschen</th><th>Stand</th><th>zuletzt</th></tr></thead><tbody>
          {data.clusters.map(cluster => <tr key={cluster.key} className={filter === cluster.key ? 'on' : ''} onClick={() => setFilter(filter === cluster.key ? '' : cluster.key)}>
            <td>{cluster.summary}<small>{cluster.key}</small></td><td>{cluster.category ?? '–'}</td><td>{cluster.people} ({cluster.count})</td>
            <td>{Object.entries(cluster.statuses).map(([s, n]) => `${STATUS_LABEL[s] ?? s} ${n}`).join(' · ')}</td><td>{new Date(cluster.last).toLocaleString('de-DE')}</td>
          </tr>)}
        </tbody></table>
      </section>
      <section><h2>Einzelne Wünsche{filter ? ` · ${STATUS_LABEL[filter] ?? filter}` : ''}</h2>
        {shown.map(wish => <article key={wish.id} className={'wish ' + wish.status}>
          <div className="meta"><span className="status">{STATUS_LABEL[wish.status] ?? wish.status}</span><span>{CHANNEL_LABEL[wish.channel] ?? wish.channel}</span>{wish.place_name && <span>{wish.place_name}</span>}{wish.who && <span>{wish.who}</span>}<span>{new Date(wish.created_at).toLocaleString('de-DE')}</span>{wish.decided_by && <span>entschieden: {wish.decided_by}</span>}</div>
          {wish.private ? <p className="muted">Privates Anliegen – nicht angezeigt. {wish.reason}</p> : <>
            <p className="text">„{wish.text}“</p>
            <p className="muted">{wish.category ?? '–'} · {wish.summary}{typeof wish.sense === 'number' ? ` · Sinn ${Math.round(wish.sense * 100)} %` : ''}{wish.reason ? ` · ${wish.reason}` : ''}</p>
            {wish.fulfilment && <p className="done">Erfüllt: {describe(wish.fulfilment)}</p>}
            {wish.admin_note && <p className="muted">Notiz: {wish.admin_note}</p>}
            {editing === wish.id ? <div className="edit">
              <input value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="Kurzfassung" maxLength={80}/>
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <input value={draft.clusterKey} onChange={e => setDraft({ ...draft, clusterKey: e.target.value })} placeholder="Bündel (z. B. baeckerei-sundern)" maxLength={40}/>
              <input value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Notiz" maxLength={300}/>
              <div className="row"><button disabled={busy} onClick={() => void act(wish.id, 'adjust', draft)}>Anpassen und neu entscheiden</button><button disabled={busy} onClick={() => void act(wish.id, 'fulfil', draft)}>Anpassen und erfüllen</button><button onClick={() => setEditing(null)}>Abbrechen</button></div>
            </div> : <div className="row">
              <button disabled={busy} onClick={() => { setEditing(wish.id); setDraft({ summary: wish.summary ?? '', category: wish.category ?? 'sonstiges', clusterKey: wish.cluster_key ?? '', note: wish.admin_note ?? '' }) }}>Anpassen …</button>
              {wish.status !== 'abgelehnt' && <button disabled={busy} onClick={() => { const note = window.prompt('Warum ablehnen? (optional)') ?? ''; void act(wish.id, 'reject', { note }) }}>Ablehnen</button>}
              {wish.status !== 'erfuellt' && <button disabled={busy} onClick={() => void act(wish.id, 'fulfil')}>Erfüllen</button>}
            </div>}
          </>}
        </article>)}
      </section>
    </>}
    <style jsx>{`
      .admin{max-width:1100px;margin:0 auto;padding:24px 16px;font-family:system-ui;color:#1d2a30;background:#f6f4ee;min-height:100vh}
      h1{margin:0 0 4px} h2{margin:24px 0 8px;font-size:16px}
      header p,.muted{color:#5d6b70;font-size:13px}
      .error{color:#a3271f}
      .totals{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
      .totals button,.row button{border:1px solid #c9c2b0;background:#fff;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px}
      .totals button.on{background:#1f4f54;color:#fff;border-color:#1f4f54}
      table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
      th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e6e1d4;vertical-align:top}
      td small{display:block;color:#8a958f;font-size:10px}
      tr{cursor:pointer} tr.on{background:#e8f2ef}
      .wish{background:#fff;border:1px solid #e6e1d4;border-radius:8px;padding:10px 12px;margin-bottom:8px}
      .wish.erfuellt{border-left:4px solid #3c8a5a} .wish.abgelehnt{border-left:4px solid #a3271f} .wish.sammelt{border-left:4px solid #c9a447} .wish.in_arbeit{border-left:4px solid #3a6ea5} .wish.privat{opacity:.7}
      .meta{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#6b767a}
      .status{font-weight:700;color:#1d2a30}
      .text{margin:6px 0;font-size:14px}
      .done{color:#2f6e48;font-size:12px}
      .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
      .edit{display:grid;gap:6px;margin-top:6px}
      .edit input,.edit select{padding:5px 7px;border:1px solid #c9c2b0;border-radius:5px;font:inherit;font-size:12px}
      @media (max-width:640px){table{font-size:11px} th:nth-child(5),td:nth-child(5){display:none}}
    `}</style>
  </main>
}

function describe(f: Record<string, unknown>) {
  if (f.kind === 'gathering') return `Zusammenkunft ${f.place ? 'in ' + f.place : ''}${typeof f.startsHour === 'number' ? ` um ${f.startsHour} Uhr` : ''}${f.joined ? ' (an bestehende angeschlossen)' : ''}`
  if (f.kind === 'delivery') return `Lieferung: ${f.amount} ${f.resource} nach ${f.location}`
  return JSON.stringify(f)
}
