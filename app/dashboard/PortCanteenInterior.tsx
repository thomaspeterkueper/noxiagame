'use client'

// app/dashboard/PortCanteenInterior.tsx
// Die Hafenkantine von innen: Ausgabe, Wasser und Ration, kein Sitzplatz.
// Kleine Kantinen haben einen stummen Automaten mit Anzeige, größere den
// Kantinenschwarm – vernetzte Roboter, die sich an echte Bestellungen
// erinnern und im Plural sprechen (lib/game/hospitality/canteen.ts). Kein freies Gespräch.
// Bestellt wird über dieselbe Route wie im Lokal.

import { useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { useGameStore } from '@/lib/store/gameStore'
import HospitalityItemIcon from '@/app/earth/HospitalityItemIcon'
import { CANTEEN_QUESTIONS, CANTEEN_SERVICE_NAME, automatDisplay, canteenAnswer, canteenGreeting, canteenServiceKind, type CanteenMenuItem, type CanteenQuestion, type SwarmMemory } from '@/lib/game/hospitality/canteen'

type Props = { parentEntityId: string; portTypeId?: string | null; onClose?: () => void }
type MenuItem = CanteenMenuItem & { affordable: boolean }
type Line = { from: 'you' | 'device'; text: string }

export default function PortCanteenInterior({ parentEntityId, portTypeId: portTypeIdProp = null, onClose }: Props) {
  const [state, setState] = useState<'loading' | 'none' | 'ready' | 'failed'>('loading')
  const [canteenId, setCanteenId] = useState<string | null>(null)
  const [portTypeId, setPortTypeId] = useState<string | null>(portTypeIdProp)
  const [menu, setMenu] = useState<{ credits: number; items: MenuItem[] } | null>(null)
  const [ordering, setOrdering] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<{ itemCode: string; id: string } | null>(null)
  const [served, setServed] = useState<string[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [status, setStatus] = useState('')
  const [memory, setMemory] = useState<SwarmMemory | null>(null)
  const kind = canteenServiceKind(portTypeId)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        const headers = { Authorization: 'Bearer ' + token }
        const found = await fetch('/api/game/hospitality/canteen?parentEntityId=' + encodeURIComponent(parentEntityId), { headers, cache: 'no-store' })
        const data = await found.json()
        if (!live) return
        if (!found.ok) { setState('failed'); return }
        setPortTypeId(String(data.portTypeId ?? portTypeIdProp ?? ''))
        if (!data.canteen) { setState('none'); return }
        setCanteenId(data.canteen.id)
        const remembered = data.memory && typeof data.memory === 'object' ? data.memory as SwarmMemory : null
        setMemory(remembered)
        const card = await fetch('/api/game/hospitality/order?tileEntityId=' + encodeURIComponent(data.canteen.id), { headers, cache: 'no-store' })
        const cardData = await card.json()
        if (!live) return
        if (card.ok && Array.isArray(cardData.items)) setMenu({ credits: Number(cardData.credits ?? 0), items: cardData.items })
        setState('ready')
        setLines([{ from: 'device', text: canteenGreeting(remembered) }])
      } catch { if (live) setState('failed') }
    })()
    return () => { live = false }
  }, [parentEntityId, portTypeIdProp])

  function ask(question: CanteenQuestion) {
    const text = CANTEEN_QUESTIONS.find(entry => entry.id === question)?.text ?? ''
    const answer = canteenAnswer(question, { menu: menu?.items ?? [], portTypeId, rationAvailable: false, memory })
    setLines(current => [...current, { from: 'you' as const, text }, { from: 'device' as const, text: answer }].slice(-8))
  }

  async function order(item: MenuItem) {
    if (!canteenId || ordering || !item.affordable) return
    const pending = requestId?.itemCode === item.itemCode ? requestId : { itemCode: item.itemCode, id: crypto.randomUUID() }
    setRequestId(pending)
    setOrdering(item.itemCode)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/hospitality/order', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileEntityId: canteenId, itemCode: item.itemCode, requestId: pending.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status < 500) setRequestId(null)
      if (response.ok && data.ok) {
        const credits = Number(data.credits ?? 0)
        setMenu(current => current ? { credits, items: current.items.map(entry => ({ ...entry, affordable: credits >= entry.priceCredits })) } : current)
        if (!data.duplicate) { setServed(current => [...current, item.itemCode].slice(-6)); setMemory(current => ({ visits: (current?.visits ?? 0) + 1, lastVisitAgoS: 0, lastItem: item.label, guestsToday: current?.guestsToday ?? 0, rationsToday: current?.rationsToday ?? 0 })) }
        useGameStore.setState({ credits })
        setStatus(item.label + ' – ' + item.priceCredits + ' Credits abgebucht. Du hast noch ' + credits + ' Credits.')
        setLines(current => [...current, { from: 'device' as const, text: kind === 'robot' ? item.label + '. Bitte entnehmen.' : 'AUSGABE · ' + item.label.toUpperCase() }].slice(-8))
      } else {
        setStatus(String(data.error ?? 'Nicht gebucht. Es wurde nichts abgebucht.'))
        if (data.code === 'NOXIA_CREDITS_INSUFFICIENT') setMenu(current => current ? { ...current, items: current.items.map(entry => entry.itemCode === item.itemCode ? { ...entry, affordable: false } : entry) } : current)
      }
    } catch {
      setStatus('Keine Verbindung. Ob gebucht wurde, ist offen – noch einmal wählen bucht nicht doppelt.')
    } finally { setOrdering(null) }
  }

  return <div className="canteen">
    <div className="room">
      <div className="wall"><span className="sign">HAFENKANTINE · RUND UM DIE UHR</span></div>
      <div className="hatch">
        {kind === 'robot'
          ? <div className="swarm"><svg className="robot" viewBox="0 0 60 90" width="60" height="90" aria-label="Ausgaberoboter"><rect x="16" y="6" width="28" height="22" rx="5" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="22" y="13" width="16" height="7" rx="2" fill="#2fd0c3" /><rect x="12" y="32" width="36" height="34" rx="6" fill="#b4bcbe" stroke="#3b4447" strokeWidth="2" /><circle cx="30" cy="49" r="5" fill="#5f6a6d" /><rect x="2" y="36" width="9" height="26" rx="4" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="49" y="36" width="9" height="26" rx="4" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="20" y="68" width="20" height="16" rx="3" fill="#737d80" stroke="#3b4447" strokeWidth="2" /><path d="M14 30h32" stroke="#6b5a2b" strokeWidth="2" strokeDasharray="3 3" /></svg><svg className="robot second" viewBox="0 0 60 90" width="60" height="90" aria-hidden="true"><rect x="16" y="6" width="28" height="22" rx="5" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="22" y="13" width="16" height="7" rx="2" fill="#2fd0c3" /><rect x="12" y="32" width="36" height="34" rx="6" fill="#b4bcbe" stroke="#3b4447" strokeWidth="2" /><circle cx="30" cy="49" r="5" fill="#5f6a6d" /><rect x="2" y="36" width="9" height="26" rx="4" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="49" y="36" width="9" height="26" rx="4" fill="#9aa3a6" stroke="#3b4447" strokeWidth="2" /><rect x="20" y="68" width="20" height="16" rx="3" fill="#737d80" stroke="#3b4447" strokeWidth="2" /></svg></div>
          : <svg className="automat" viewBox="0 0 70 90" width="70" height="90" aria-label="Ausgabeautomat"><rect x="4" y="4" width="62" height="82" rx="6" fill="#56656a" stroke="#1f2a2e" strokeWidth="2" /><rect x="10" y="10" width="50" height="22" rx="3" fill="#0f2a2c" /><text x="35" y="24" textAnchor="middle" fill="#2fd0c3" fontSize="7" fontFamily="monospace">BEREIT</text><rect x="10" y="40" width="22" height="18" rx="2" fill="#30404a" /><rect x="38" y="40" width="22" height="18" rx="2" fill="#30404a" /><rect x="10" y="66" width="50" height="14" rx="2" fill="#1b2326" stroke="#2fd0c3" strokeWidth="1" /></svg>}
        <div className="counter">{served.map((code, index) => <HospitalityItemIcon key={index} code={code} size={20} />)}</div>
      </div>
      <div className="you"><i /><span>Du</span></div>
    </div>
    <aside>
      <div className="machine-portrait">{kind==='robot'
        ? <svg viewBox="0 0 48 48" width="48" height="48" aria-label="Kantinenschwarm"><circle cx="24" cy="24" r="23" fill="#1b2a2e" stroke="#2fd0c3" strokeWidth="2" /><rect x="13" y="10" width="22" height="18" rx="4" fill="#9aa3a6" stroke="#3b4447" strokeWidth="1.5" /><rect x="17" y="16" width="14" height="5" rx="1.5" fill="#2fd0c3" /><rect x="10" y="30" width="28" height="12" rx="4" fill="#b4bcbe" stroke="#3b4447" strokeWidth="1.5" /><circle cx="24" cy="36" r="2.5" fill="#5f6a6d" /></svg>
        : <svg viewBox="0 0 48 48" width="48" height="48" aria-label="Ausgabeautomat"><circle cx="24" cy="24" r="23" fill="#1b2a2e" stroke="#2fd0c3" strokeWidth="2" /><rect x="12" y="8" width="24" height="32" rx="3" fill="#56656a" stroke="#1f2a2e" strokeWidth="1.5" /><rect x="15" y="11" width="18" height="8" rx="1.5" fill="#0f2a2c" /><rect x="15" y="22" width="8" height="6" fill="#30404a" /><rect x="25" y="22" width="8" height="6" fill="#30404a" /><rect x="15" y="32" width="18" height="5" fill="#1b2326" stroke="#2fd0c3" strokeWidth=".8" /></svg>}
        <div><small>{CANTEEN_SERVICE_NAME[kind].toUpperCase()}</small><b>{kind==='robot'?'Vernetzte Ausgaberoboter':'Stummer Automat'}</b></div></div>
      {state === 'loading' && <p>Die Ausgabe wird geholt …</p>}
      {state === 'failed' && <p>Die Kantine ist gerade nicht erreichbar.</p>}
      {state === 'none' && <p>In diesem Hafen gibt es keine Kantine.</p>}
      {state === 'ready' && <>
        {kind === 'robot' ? <>
          <div className="talk">{lines.map((line, index) => <p key={index} className={line.from}>{line.from === 'you' ? 'Du: ' : ''}{line.text}</p>)}</div>
          <div className="questions">{CANTEEN_QUESTIONS.map(question => <button key={question.id} onClick={() => ask(question.id)}>{question.text}</button>)}</div>
        </> : <div className="talk">{automatDisplay(menu?.items ?? [], false).map((line, index) => <p key={index} className="device">{line}</p>)}<p className="you">Der Automat spricht nicht.</p></div>}
        <small>AUSGABE</small>
        {menu ? <>
          <p>Du hast {menu.credits} Credits.</p>
          {menu.items.length === 0 && <p>Die Ausgabe ist leer.</p>}
          <div className="tiles">{menu.items.map(item => <button key={item.itemCode} className="tile" disabled={!item.affordable || ordering !== null} onClick={() => void order(item)} title={item.affordable ? item.label : 'Dafür reichen deine Credits nicht.'}>
            <HospitalityItemIcon code={item.itemCode} size={40} title={item.label} />
            <span>{item.label}</span><b>{item.priceCredits} Cr</b>
            {!item.affordable && <small>zu teuer</small>}
          </button>)}</div>
        </> : <p>Die Ausgabe konnte nicht geladen werden.</p>}
        {status && <div className="status">{status}</div>}
      </>}
      {onClose && <button className="leave" onClick={onClose}>← Zurück in den Hafen</button>}
    </aside>
    <style jsx>{`
      .canteen{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;font-family:system-ui;color:#e6ece9}
      .room{position:relative;min-height:300px;background:#1a2326;border:1px solid #33454a;border-radius:8px;overflow:hidden}
      .wall{height:120px;background:linear-gradient(#2b393d,#233034);border-bottom:6px solid #0f1719;display:flex;align-items:flex-start;justify-content:center;padding-top:14px}
      .sign{font:800 10px monospace;letter-spacing:.14em;color:#2fd0c3;border:1px solid #2fd0c3;padding:4px 10px;border-radius:3px}
      .hatch{position:absolute;left:50%;top:70px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
      .swarm{display:flex;gap:26px;align-items:flex-end}.swarm .second{opacity:.8;transform:scale(.92)}
      .counter{display:flex;gap:4px;min-height:22px;padding:4px 10px;background:#3b474b;border:2px solid #5a686c;border-radius:4px;min-width:180px;justify-content:center}
      .you{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);width:20px;height:28px}
      .you i{display:block;width:14px;height:22px;margin:auto;background:#d7ad3c;border:2px solid #5c481c;border-radius:8px 8px 4px 4px}
      .you span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:#13262b;border:1px solid #d7ad3c;border-radius:4px;padding:1px 4px;font:700 8px monospace}
      aside{display:grid;align-content:start;gap:6px;font-size:12px}
      .machine-portrait{display:flex;gap:10px;align-items:center}.machine-portrait b{display:block;font-size:13px}
      aside small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      aside p{margin:0;line-height:1.45}
      .talk{display:grid;gap:4px;padding:8px;background:#0f1a1d;border:1px solid #2d4445;border-radius:6px;min-height:40px}
      .talk .device{font-family:monospace;font-size:11px;color:#2fd0c3}
      .talk .you{position:static;transform:none;width:auto;height:auto;color:#9fb5b0;font-size:11px}
      .questions{display:flex;flex-wrap:wrap;gap:4px}
      .questions button{border:1px solid #2d4445;background:#102526;color:#9fb5b0;border-radius:4px;padding:3px 7px;font-size:10px;cursor:pointer}
      .tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
      .tile{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px 7px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px}
      .tile b{color:#f1d57a}.tile small{color:#d9a48a;font-size:10px;letter-spacing:0}
      .tile:disabled{cursor:not-allowed;background:#102526;border-color:#2d4445;color:#7f9591}
      .tile:disabled b{color:#7f9591}.tile:disabled :global(svg){opacity:.35;filter:grayscale(1)}
      .status{padding:7px 9px;background:#17383a;border:1px solid #5d7b79;border-radius:5px;font-size:11px}
      .leave{margin-top:6px;padding:7px 10px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:11px}
      @media (max-width:720px){.canteen{grid-template-columns:1fr}}
    `}</style>
  </div>
}
