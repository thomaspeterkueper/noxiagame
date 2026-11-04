'use client'

// app/earth/BankTransfer.tsx
// Überweisung am Bankschalter (Thomas, 04.11.2026: „generell Credits untereinander
// austauschen“ – entschieden: bar von Hand zu Hand und als Überweisung bei der Bank).
// An Spieler (Spielername) oder an Bewohner, deren Namen man kennt; mit Verwendungszweck.
// Darunter die letzten Ein- und Ausgänge. Gebucht über /api/game/credits.

import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { useGameStore } from '@/lib/store/gameStore'

type Transfer = { at: string; direction: 'in' | 'out'; channel: 'cash' | 'bank'; amount: number; who: string; note: string | null; place: string | null }

export default function BankTransfer({ place, onStatus }: { place: string; onStatus: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'player' | 'person'>('player')
  const [username, setUsername] = useState('')
  const [personId, setPersonId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<{ credits: number; transfers: Transfer[]; known: Array<{ id: string; name: string }> } | null>(null)

  const load = useCallback(async () => {
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/credits', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      if (response.ok) setData(await response.json())
    } catch { /* ohne Liste bleibt die Überweisung möglich */ }
  }, [])
  useEffect(() => { if (open) void load() }, [open, load])

  async function send() {
    const value = Math.round(Number(amount))
    if (busy || !Number.isFinite(value) || value < 1) { onStatus('Betrag fehlt.'); return }
    if (mode === 'player' ? !username.trim() : !personId) { onStatus('Empfänger fehlt.'); return }
    setBusy(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/credits', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'bank', amount: value, ...(mode === 'player' ? { toUsername: username.trim() } : { toPersonId: personId }), note, place, requestId: crypto.randomUUID() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.ok) { onStatus(String(result.error ?? 'Die Überweisung ging nicht durch.')); return }
      if (typeof result.credits === 'number') useGameStore.setState({ credits: result.credits })
      onStatus(`${value} Cr an ${result.toName ?? 'den Empfänger'} überwiesen. Du hast noch ${result.credits} Cr.`)
      setAmount(''); setNote('')
      void load()
    } catch { onStatus('Keine Verbindung – es wurde nichts überwiesen.') } finally { setBusy(false) }
  }

  if (!open) return <button className="open-school" onClick={() => setOpen(true)}>Überweisung – an Spieler oder Bewohner</button>
  return <div className="transfer">
    <small>ÜBERWEISUNG</small>
    <div className="for"><button className={mode === 'player' ? 'on' : ''} onClick={() => setMode('player')}>An Spieler</button><button className={mode === 'person' ? 'on' : ''} onClick={() => setMode('person')}>An Bewohner</button></div>
    {mode === 'player'
      ? <input placeholder="Spielername" value={username} maxLength={60} onChange={e => setUsername(e.target.value)} />
      : <select value={personId} onChange={e => setPersonId(e.target.value)}>
          <option value="">{data?.known.length ? 'Wen? (nur Bekannte)' : 'Du kennst noch niemanden mit Namen'}</option>
          {(data?.known ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>}
    <input type="number" min={1} max={10000} placeholder="Betrag in Cr" value={amount} onChange={e => setAmount(e.target.value)} />
    <input placeholder="Verwendungszweck (freiwillig)" value={note} maxLength={120} onChange={e => setNote(e.target.value)} />
    <button className="open-school" disabled={busy} onClick={() => void send()}>{busy ? 'Überweist …' : 'Überweisen'}</button>
    <p className="hint">An Spieler höchstens 2000 Cr am Tag. Bar gibst du jemandem direkt im Gespräch („Credits geben …“).</p>
    {data && data.transfers.length > 0 && <>
      <small>EIN- UND AUSGÄNGE</small>
      <ul>{data.transfers.slice(0, 8).map((t, i) => <li key={i} className={t.direction}>
        <span>{t.direction === 'in' ? '+' : '−'}{t.amount} Cr {t.direction === 'in' ? 'von' : 'an'} {t.who}</span>
        <em>{t.channel === 'cash' ? 'bar' : 'Überweisung'}{t.note ? ' · ' + t.note : ''} · {new Date(t.at).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}</em>
      </li>)}</ul>
    </>}
    <button className="quiet" onClick={() => setOpen(false)}>schließen</button>
    <style jsx>{`
      .transfer{display:grid;gap:6px;margin-top:8px}
      .transfer input,.transfer select{background:#061012;color:#eef;border:1px solid #40595a;border-radius:5px;padding:6px 7px;font-size:12px}
      .transfer ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
      .transfer li{display:flex;flex-direction:column;font-size:11px;color:#cbd6d2}
      .transfer li.in span{color:#8fd18f}
      .transfer li em{font-style:normal;font-size:10px;color:#9fb5b0}
      .quiet{border:0;background:none;color:#9fb5b0;font:600 10px system-ui;text-decoration:underline;cursor:pointer;justify-self:start;padding:0}
    `}</style>
  </div>
}
