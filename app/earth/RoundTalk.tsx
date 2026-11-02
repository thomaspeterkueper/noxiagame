'use client'
// Offene Gesprächsrunde im Raum (Thomas, 31.10.2026): Man sieht und hört, wie die Anwesenden
// miteinander reden, und kann sich einklinken. Die Beiträge der Figuren sind für alle im Raum
// gleich; was du schreibst und was darauf geantwortet wird, siehst nur du.
// Zustand: useRoundTalk.ts, Sprechblasen über den Figuren: RoundBubbles.tsx.

import { useEffect, useRef, useState } from 'react'
import { ROUND_MAX_CHARS } from '@/lib/game/rounds/roundTalk'
import type { RoundLine } from './useRoundTalk'

export default function RoundTalk({ lines, sending, note, say }: {
  lines: RoundLine[]
  sending: boolean
  note: string | null
  say: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const feed = useRef<HTMLDivElement | null>(null)
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }) }, [lines.length])
  async function submit() { if (await say(text)) setText('') }

  return <div className="round" data-noxia-private>
    <small>DIE RUNDE</small>
    <div className="feed" ref={feed} aria-live="polite">
      {lines.length === 0 && <p className="quiet">Es ist ruhig in der Runde. Gleich kommt ein Gespräch in Gang …</p>}
      {lines.map(line => <p key={line.id} className={line.mine ? 'mine' : ''}><b>{line.mine ? 'Du' : line.name}:</b> {line.text}</p>)}
    </div>
    <div className="row">
      <input value={text} maxLength={ROUND_MAX_CHARS} disabled={sending} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void submit() }} placeholder="Etwas in die Runde sagen …"/>
      <button disabled={sending || !text.trim()} onClick={() => void submit()}>{sending ? '…' : 'Sagen'}</button>
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
