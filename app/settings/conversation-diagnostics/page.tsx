'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

export default function ConversationDiagnosticsConsentPage() {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function update(value?: boolean) {
    setBusy(true); setMessage('')
    try {
      const token = await getToken()
      if (!token) throw Error('Bitte zunächst im Spiel anmelden.')
      const response = await fetch('/api/game/conversation-diagnostics-consent', {
        method: value === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer ' + token, ...(value === undefined ? {} : { 'Content-Type':'application/json' }) },
        body: value === undefined ? undefined : JSON.stringify({enabled:value}),
        cache:'no-store',
      })
      const data = await response.json()
      if (!response.ok) throw Error(data.error ?? 'Speichern fehlgeschlagen')
      setEnabled(data.enabled === true)
      if (value !== undefined) setMessage(data.enabled ? 'Freigabe aktiviert. Nur ab jetzt geführte Gespräche sind freigegeben.' : 'Freigabe widerrufen. Dein Wortlaut ist für die Adminauswertung wieder gesperrt.')
    } catch (e) { setMessage(String(e)) }
    finally {setBusy(false);setReady(true)}
  }
  useEffect(()=>{void update()},[])
  return <main className="min-h-screen bg-[#f6f4ee] p-6 text-[#1d2a30]">
    <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6">
      <Link href="/dashboard" className="text-sm text-[#1f4f54]">← Zum Spiel</Link>
      <h1 className="mt-4 text-2xl font-bold">Freiwillige Gesprächsdiagnostik</h1>
      <p className="mt-3">NOXIAGAME protokolliert Gesprächsereignisse technisch. Für die Verbesserung der NPCs kannst du dem Projektadministrator freiwillig erlauben, deinen <strong>wörtlichen Gesprächsverlauf mit NPCs</strong> einzusehen.</p>
      <p className="mt-3">Dabei werden deine eingegebenen Nachrichten, NPC-Antworten, Zeitpunkte, erkannte Themen und Systemaktionen für die Fehleranalyse verfügbar. Das dient der Qualitätssicherung der NPC-Dialoge, nicht der öffentlichen Veröffentlichung. Andere Spieler erhalten keinen Zugang.</p>
      <p className="mt-3">Die Freigabe gilt ausschließlich für Gespräche <strong>nach</strong> der Aktivierung. Du kannst sie jederzeit hier widerrufen; danach werden die Wortlaute nicht mehr über die Admin-Diagnose angezeigt. Historisch gespeicherte technische Logdaten werden durch den Widerruf nicht automatisch gelöscht. Für Löschung oder Auskunft wende dich an den Spielbetreiber; eine automatisierte Löschfunktion ist noch nicht verfügbar.</p>
      <p className="mt-3 text-sm text-[#5d6b70]">Die Teilnahme ist freiwillig und hat keine Auswirkungen auf deinen Zugang zum Spiel. Bitte keine echten Passwörter, Kontodaten oder vertrauliche persönliche Informationen in NPC-Dialoge eingeben.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled={!ready||busy||enabled} onClick={()=>void update(true)} className="rounded bg-[#1f4f54] px-4 py-2 text-white disabled:opacity-40">Einwilligen</button>
        <button type="button" disabled={!ready||busy||!enabled} onClick={()=>void update(false)} className="rounded border px-4 py-2 disabled:opacity-40">Einwilligung widerrufen</button>
      </div>
      <p className="mt-4 text-sm" role="status">{message||(!ready?'Lädt Einstellung …':enabled?'Freigabe ist aktiv.':'Freigabe ist nicht aktiv.')}</p>
    </div>
  </main>
}
