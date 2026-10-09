'use client'

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import InteriorTopologyScene from '@/app/dashboard/InteriorTopologyScene'
import { DAVARU_TEMPLE_INTERIOR } from '@/lib/game/buildings/interiors/templates/davaruTemple'
type Session = { destinationKey: string; channel: string; roomId: string; expiresAt: string }

export default function TemplePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function request(method: 'GET' | 'POST', body?: object) {
    const token = await getToken()
    if (!token) throw new Error('Bitte zuerst in NOXIA anmelden.')
    const response = await fetch('/api/game/temple', {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(response.status === 401 ? 'Bitte zuerst anmelden.' : String(data.error ?? 'Tempelzugang derzeit nicht verfügbar'))
    setSession(data.session ?? null)
  }
  useEffect(() => {
    let active = true
    getToken().then(token => {
      if (!token) throw new Error('Bitte zuerst in NOXIA anmelden.')
      return fetch('/api/game/temple', {headers:{Authorization:'Bearer '+token}})
    }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(String(data.error ?? 'Tempelzugang derzeit nicht verfügbar'))
      if (active) setSession(data.session ?? null)
    }).catch(error => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])
  async function act(body: object) {
    if (busy) return
    setBusy(true); setMessage('')
    try { await request('POST', body) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Anfrage fehlgeschlagen') }
    finally { setBusy(false) }
  }
  return <main style={{maxWidth:900,margin:'24px auto',padding:20}}>
    <h1>Tempel des DaVaRu</h1>
    <p>ENDIA-Fernzugang · Ein gemeinsames Ziel · Keine physische Reise</p>
    {!ready ? <p>Sitzung wird geprüft …</p> : session ? <>
      <p>Virtuelle Sitzung aktiv bis {new Date(session.expiresAt).toLocaleTimeString('de-DE')} · Raum: {DAVARU_TEMPLE_INTERIOR.rooms.find(room=>room.id===session.roomId)?.name}</p>
      <InteriorTopologyScene template={DAVARU_TEMPLE_INTERIOR} roomId={session.roomId}
        occupants={[]} onRoomChange={roomId=>void act({action:'move',roomId})}/>
      <p>Du bewegst einen virtuellen Besucher. Dein tatsächlicher Standort bleibt unverändert.</p>
      <button type="button" disabled={busy} onClick={()=>void act({action:'leave'})}>Tempel verlassen</button>
    </> : <>
      <p>Der Tempel kann über ENDIA aus dem gesamten Universum besucht werden. Diese erste Version ermöglicht die Navigation zwischen seinen Räumen. Gemeinsame NPC-Begegnungen folgen später.</p>
      <button type="button" disabled={busy} onClick={()=>void act({action:'enter'})}>Über ENDIA eintreten</button>
      <p><a href="/auth/login">Anmelden</a></p>
    </>}
    {message && <p role="status">{message}</p>}
  </main>
}
