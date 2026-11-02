'use client'
// Offene Gesprächsrunde im Raum (Thomas, 31.10.2026): Man sieht und hört, wie die Anwesenden
// miteinander reden, und kann sich einklinken. Die Beiträge der Figuren sind für alle im Raum
// gleich; was du schreibst und was darauf geantwortet wird, siehst nur du.
// Server: /api/game/round-talk, Regeln: lib/game/rounds/roundTalk.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { ROUND_MAX_CHARS, ROUND_TICK_MS } from '@/lib/game/rounds/roundTalk'

type Line = { id: number; name: string; text: string; speakerId: string | null; mine: boolean }

export default function RoundTalk({ roundKey, placeName, label, people }: {
  roundKey: string
  placeName: string
  label: string
  people: Array<{ id: string; name: string }>
}) {
  const [lines, setLines] = useState<Line[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const after = useRef(0)
  const peopleKey = people.map(person => person.id).join(',')
  const feed = useRef<HTMLDivElement | null>(null)

  const merge = useCallback((incoming: Line[]) => {
    if (!incoming.length) return
    after.current = Math.max(after.current, ...incoming.map(line => line.id))
    setLines(current => {
      const known = new Set(current.map(line => line.id))
      return [...current, ...incoming.filter(line => !known.has(line.id))].slice(-40)
    })
  }, [])

  const call = useCallback(async (extra: Record<string, unknown> = {}) => {
    const { token } = await getSessionInfo()
    if (!token) return null
    const response = await fetch('/api/game/round-talk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ roundKey, placeName, label, participants: peopleKey.split(',').filter(Boolean), after: after.current, ...extra }),
    })
    const json = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, json }
  }, [roundKey, placeName, label, peopleKey])

  // Lesen alle paar Sekunden, die Runde weiterführen im Takt – nur solange das Fenster sichtbar ist.
  useEffect(() => {
    let live = true
    const poll = async () => {
      if (document.hidden) return
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/round-talk?roundKey=' + encodeURIComponent(roundKey) + '&after=' + after.current, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        const json = await response.json().catch(() => ({}))
        if (live && response.ok) merge(json.lines ?? [])
      } catch { /* nächster Versuch */ }
    }
    const advance = async () => {
      if (document.hidden) return
      try { const result = await call(); if (live && result?.ok) merge(result.json.lines ?? []) } catch { /* nächster Versuch */ }
    }
    void advance()
    const reader = setInterval(poll, 7000)
    const driver = setInterval(advance, ROUND_TICK_MS + 2000)
    return () => { live = false; clearInterval(reader); clearInterval(driver) }
  }, [roundKey, call, merge])

  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }) }, [lines.length])

  async function say() {
    const message = text.trim()
    if (!message || sending) return
    setSending(true); setNote(null)
    try {
      const result = await call({ text: message })
      if (!result) return
      if (result.status === 429) { setNote('Langsam – gib der Runde einen Moment.'); return }
      if (!result.ok) { setNote('Die Runde kann gerade nicht antworten.'); return }
      if (result.json.help) setNote(String(result.json.help))
      else setText('')
      merge(result.json.lines ?? [])
    } finally { setSending(false) }
  }

  if (people.length < 2) return null
  return <div className="round" data-noxia-private>
    <small>DIE RUNDE</small>
    <div className="feed" ref={feed} aria-live="polite">
      {lines.length === 0 && <p className="quiet">Es ist ruhig in der Runde. Gleich kommt ein Gespräch in Gang …</p>}
      {lines.map(line => <p key={line.id} className={line.mine ? 'mine' : ''}><b>{line.mine ? 'Du' : line.name}:</b> {line.text}</p>)}
    </div>
    <div className="row">
      <input value={text} maxLength={ROUND_MAX_CHARS} disabled={sending} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void say() }} placeholder="Etwas in die Runde sagen …"/>
      <button disabled={sending || !text.trim()} onClick={() => void say()}>{sending ? '…' : 'Sagen'}</button>
    </div>
    {note && <p className="note">{note}</p>}
    <style jsx>{`
      .round{display:grid;gap:5px;margin-top:4px;padding:8px 9px;border:1px solid #5b7f6e;border-radius:7px;background:#12201a;color:#e3f0e8}
      .round small{font:800 8px monospace;letter-spacing:.12em;color:#8fd1b0}
      .feed{display:grid;gap:4px;max-height:170px;overflow:auto;font-size:11px;line-height:1.4}
      .feed p{margin:0}
      .feed .mine{color:#f1d57a}
      .feed .quiet,.note{color:#9fb5a8;font-size:10px}
      .row{display:flex;gap:5px}
      input{flex:1;min-width:0;padding:6px 7px;border:1px solid #45657c;border-radius:5px;background:#06111a;color:#eef5f8;font-size:11px}
      button{padding:6px 9px;border:1px solid #5b7f6e;border-radius:5px;background:#1c3328;color:#e3f0e8;font-size:11px;cursor:pointer}
      button:disabled{opacity:.5;cursor:default}
      .note{margin:0}
    `}</style>
  </div>
}
