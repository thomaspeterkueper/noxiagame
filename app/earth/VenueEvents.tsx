'use client'

// app/earth/VenueEvents.tsx
// Aushang im Lokal (Second-Life-Mechanik, Teil 5, 05.11.2026): was hier läuft und
// angekündigt ist, „Was ist los?“ anderswo, und für den Eigentümer das Ankündigen.
// Gespeichert über /api/game/hospitality/events (venue_events), echte Uhrzeit.

import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { VENUE_EVENT_KINDS, eventLine, eventRunning, upcoming, type VenueEvent, type VenueEventKind } from '@/lib/game/hospitality/venueEvents'

async function call(method: 'GET' | 'POST', query: string, body?: Record<string, unknown>) {
  const { token } = await getSessionInfo()
  if (!token) return null
  const r = await fetch('/api/game/hospitality/events' + query, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  return { ok: r.ok, data: await r.json().catch(() => ({})) }
}

/** Termine dieses Lokals und anderswo; alle 60 s neu. */
export function useVenueEvents(tileEntityId: string) {
  const [state, setState] = useState<{ events: VenueEvent[]; elsewhere: VenueEvent[]; canEdit: boolean }>({ events: [], elsewhere: [], canEdit: false })
  const load = useCallback(async () => {
    try {
      const r = await call('GET', '?tileEntityId=' + encodeURIComponent(tileEntityId))
      if (r?.ok && Array.isArray(r.data.events)) setState({ events: r.data.events, elsewhere: Array.isArray(r.data.elsewhere) ? r.data.elsewhere : [], canEdit: r.data.canEdit === true })
    } catch { /* ohne Verbindung bleibt der Aushang leer */ }
  }, [tileEntityId])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 60_000); return () => clearInterval(id) }, [load])
  return { ...state, reload: load }
}

function localInput(ms: number) {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type Props = { tileEntityId: string; data: ReturnType<typeof useVenueEvents>; onStatus: (text: string) => void }

export default function VenueEvents({ tileEntityId, data, onStatus }: Props) {
  const now = Date.now()
  const here = upcoming(data.events, now)
  const there = upcoming(data.elsewhere, now, 4)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<VenueEventKind>('dj')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [start, setStart] = useState(() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 2); return localInput(d.getTime()) })
  const [minutes, setMinutes] = useState(180)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true); setError(null)
    const r = await call('POST', '', { action: 'create', tileEntityId, kind, title, note, startsAt: new Date(start).toISOString(), minutes }).catch(() => null)
    setBusy(false)
    if (!r?.ok) { setError(String(r?.data?.error ?? 'Keine Verbindung.')); return }
    setOpen(false); setTitle(''); setNote('')
    onStatus('Angekündigt – der Aushang hängt.')
    void data.reload()
  }
  async function cancel(e: VenueEvent) {
    const r = await call('POST', '', { action: 'cancel', id: e.id }).catch(() => null)
    if (!r?.ok) { onStatus(String(r?.data?.error ?? 'Nicht abgesagt.')); return }
    onStatus('Abgesagt.'); void data.reload()
  }

  if (!here.length && !there.length && !data.canEdit) return null
  return <div className="menu events">
    <small>AUSHANG</small>
    {here.length ? here.map(e => <div key={e.id} className={'event' + (eventRunning(e, now) ? ' now' : '')}>
      <span>{VENUE_EVENT_KINDS[e.kind].icon}</span>
      <p><b>{eventLine(e, now)}</b>{e.note && <><br /><em>{e.note}</em></>}</p>
      {data.canEdit && <button className="x" title="Absagen" onClick={() => void cancel(e)}>absagen</button>}
    </div>) : <p className="hint">Noch nichts angekündigt.</p>}
    {there.length > 0 && <>
      <small>WAS IST LOS? · ANDERSWO</small>
      {there.map(e => <p key={e.id} className="hint">{VENUE_EVENT_KINDS[e.kind].icon} {e.venueName ?? 'ein Lokal'}: {eventLine(e, now)}</p>)}
    </>}
    {data.canEdit && (!open
      ? <button className="open-school" onClick={() => setOpen(true)}>Veranstaltung ankündigen …</button>
      : <div className="event-form">
        <label>Art<select value={kind} onChange={e => setKind(e.target.value as VenueEventKind)}>{(Object.keys(VENUE_EVENT_KINDS) as VenueEventKind[]).map(k => <option key={k} value={k}>{VENUE_EVENT_KINDS[k].label}</option>)}</select></label>
        <label>Titel<input value={title} maxLength={60} placeholder={VENUE_EVENT_KINDS[kind].label} onChange={e => setTitle(e.target.value)} /></label>
        <label>Beginn<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Dauer<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[30, 60, 90, 120, 180, 240, 300, 360, 480].map(m => <option key={m} value={m}>{m < 60 ? m + ' Min.' : m / 60 + ' Std.'}</option>)}</select></label>
        <label>Notiz<input value={note} maxLength={160} placeholder="z. B. Eintritt frei, Achtziger" onChange={e => setNote(e.target.value)} /></label>
        {error && <p className="hint warn">{error}</p>}
        <div className="moves"><button disabled={busy} onClick={() => void create()}>{busy ? 'Speichert …' : 'Aushängen'}</button><button disabled={busy} onClick={() => setOpen(false)}>Abbrechen</button></div>
      </div>)}
    <style jsx>{`
      .event{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start;margin-top:6px;padding:6px 8px;border:1px solid #2d4445;border-radius:6px;background:#0f2224}
      .event.now{border-color:#f1d57a;background:#2a2410}
      .event p{margin:0;font-size:11px}.event em{color:#9fb5b0;font-style:normal}
      .event .x{border:0;background:none;color:#7f9591;font-size:10px;text-decoration:underline;cursor:pointer}
      .event-form{display:grid;gap:6px;margin-top:8px}
      .event-form label{display:grid;grid-template-columns:60px 1fr;align-items:center;gap:6px;font-size:11px;color:#9fb5b0}
      .event-form input,.event-form select{min-width:0;background:#061012;color:#eef;border:1px solid #40595a;border-radius:4px;padding:4px 6px}
    `}</style>
  </div>
}
