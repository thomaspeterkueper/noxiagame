'use client'

import { useCallback, useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { landmarkStaffName } from '@/lib/game/landmarks/interiors'
import { immersionPrice, partyLabel, receptionGreeting } from '@/lib/game/immersion'
import DvarakaGrabungScene from './DvarakaGrabungScene'
import { experiencesAt, type Chronomap } from '@/lib/worldlab/chronomaps'

type Category = Chronomap['category']
const CATEGORY_LABEL: Record<Category, string> = { chronotrip: 'Zeitreise', site: 'Begehbarer Ort', game: 'Spielwelt', abstract: 'Abstrakte Erfahrung' }
const INTRO: Record<Category, string> = {
  chronotrip: 'Der Pod stellt deinen Körper ruhig und legt dir die Vergangenheit des Ortes unter die Füße. Du gehst, schaust und entdeckst; was belegt ist, ist als Fund gekennzeichnet, was ergänzt wurde, als Rekonstruktion oder Buchwelt.',
  site: 'Der Pod schließt sich, und du stehst am Ort, wie er heute ist. Geh umher und sieh dir die Fundstellen an; jede trägt einen Fundzettel mit dem, was die Grabung belegt hat.',
  game: 'Der Pod schließt sich, die Stimmen im Studio werden leise. Du trittst in eine fertige Spielwelt ein und kehrst zurück, wenn du den Pod öffnest.',
  abstract: 'Der Pod schließt sich. Es gibt keinen Ort und keine Zeit, nur Form, Klang und Bewegung. Du entscheidest, wann du auftauchst.',
}

interface Offer { id: string; title: string; era: string; category: Category; playable: boolean; price: number; minutes: number; priceInGroup: Record<string, number> }
interface Party { partyId: string; experienceId: string; category: Category; names: string[]; endsAt: string }
interface Session { id: string; experience_id: string; category: Category; party_id: string; ends_at: string }
interface Data { offers: Offer[]; parties: Party[]; session: Session | null; credits: number; me?: { profileId: string; name: string } }

/**
 * Innenraum des Erlebnis-Studios (immersion_studio): Empfang mit Mitarbeiter, Preisen und Pods.
 * Allein oder gemeinsam (Gruppe im selben Studio, gleiches Erlebnis, Rabatt je Kopf). Die Erlebnisse selbst
 * folgen; bis ein Erlebnis spielbar ist, kann man den Pod nur ansehen (kostenlos, keine Buchung).
 */
export default function ImmersionStudioInterior({ entityId, name, at, onClose }: { entityId: string; name: string; at?: { lat: number; lon: number }; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ title: string; category: Category } | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch(`/api/game/immersion?studio=${encodeURIComponent(entityId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Studio nicht erreichbar')
      setData(json as Data)
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [entityId])
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer) }, [load])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/immersion', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ studio: entityId, ...body }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Das hat nicht geklappt')
      setError(null)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  const staff = landmarkStaffName(name)
  const offers: Offer[] = data?.offers ?? experiencesAt(at ?? { lat: 0, lon: 0 }).map(map => ({ id: map.id, title: map.title, era: map.era, category: map.category, playable: map.status === 'playable', price: immersionPrice(map.category), minutes: 0, priceInGroup: {} }))
  const lying = data?.session ?? null
  const inPod = preview !== null || lying !== null
  const lyingOffer = lying ? offers.find(offer => offer.id === lying.experience_id) : null
  const category = preview?.category ?? lying?.category ?? 'game'

  const box: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2300, background: inPod ? 'rgba(2,5,10,.96)' : 'rgba(2,7,12,.86)', display: 'grid', placeItems: 'center', padding: 20, transition: 'background .6s' }
  const card: React.CSSProperties = { width: 'min(640px,94vw)', maxHeight: '86vh', overflow: 'auto', background: inPod ? '#0b1b26' : '#eef1ed', color: inPod ? '#d7e6ee' : '#1b3540', border: '1px solid #78919a', borderRadius: 12, padding: 18, font: '13px/1.5 system-ui' }
  const button: React.CSSProperties = { border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '8px 12px', fontWeight: 800, fontSize: 11, cursor: busy ? 'wait' : 'pointer' }
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '9px 10px', border: '1px solid #ccd4d1', borderRadius: 8, background: '#f8faf6' }

  return (
    <div style={box} onClick={event => event.target === event.currentTarget && !inPod && onClose()}>
      <div style={card} role="dialog" aria-label={name}>
        {!inPod && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div><small style={{ color: '#9a7d1e', fontWeight: 900, letterSpacing: '.08em' }}>ERLEBNIS-STUDIO</small><strong style={{ display: 'block', fontSize: 16 }}>{name}</strong></div>
            <button onClick={onClose} aria-label="Schließen" style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
          <p>Eine ruhige Halle, in der Reihe an Reihe Pods stehen. Am Empfang sitzt <b>{staff}</b>: „{receptionGreeting(name)}“</p>
          {data && <p style={{ color: '#65767b', fontSize: 11 }}>Dein Guthaben: {data.credits.toLocaleString('de-DE')} Cr · zu zweit 15 % und ab drei Personen 25 % günstiger je Person.</p>}
          {error && <p style={{ color: '#8a3b3b' }}>{error}</p>}
          <div style={{ display: 'grid', gap: 8 }}>
            {offers.map(offer => {
              const groups = (data?.parties ?? []).filter(party => party.experienceId === offer.id)
              return (
                <div key={offer.id} style={{ display: 'grid', gap: 6 }}>
                  <div style={row}>
                    <span><b>{offer.title}</b><small style={{ display: 'block', color: '#65767b' }}>{CATEGORY_LABEL[offer.category]} · {offer.era}{offer.minutes ? ` · ${offer.minutes} Min` : ''} · {offer.price} Cr{offer.priceInGroup['2'] ? ` (zu zweit ${offer.priceInGroup['2']} Cr, zu dritt ${offer.priceInGroup['3']} Cr)` : ''}</small></span>
                    {offer.playable
                      ? <button style={button} disabled={busy} onClick={() => void post({ action: 'start', experience: offer.id })}>Pod buchen</button>
                      : <button style={{ ...button, background: '#51656e' }} onClick={() => setPreview({ title: offer.title, category: offer.category })}>Pod ansehen</button>}
                  </div>
                  {offer.playable && groups.map(party => (
                    <div key={party.partyId} style={{ ...row, marginLeft: 16, background: '#f1f6f2' }}>
                      <span>Gemeinsam erleben mit {partyLabel(party.names)}<small style={{ display: 'block', color: '#65767b' }}>{immersionPrice(offer.category, party.names.length + 1)} Cr für dich</small></span>
                      <button style={button} disabled={busy} onClick={() => void post({ action: 'start', experience: offer.id, join: party.partyId })}>Dazulegen</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <p style={{ color: '#65767b', fontSize: 11, marginTop: 12 }}>Noch nicht alle Erlebnisse sind fertig. „Pod ansehen“ kostet nichts und startet nichts.</p>
        </>}
        {inPod && <>
          <small style={{ color: '#d8bd68', fontWeight: 900, letterSpacing: '.08em' }}>POD · {CATEGORY_LABEL[category].toUpperCase()}</small>
          <strong style={{ display: 'block', fontSize: 16, margin: '3px 0 8px' }}>{preview?.title ?? lyingOffer?.title ?? lying?.experience_id}</strong>
          <p>{INTRO[category]}</p>
          {lying?.experience_id === 'dvaraka-grabung' && <DvarakaGrabungScene partyId={lying.party_id} me={data?.me ?? null} onLeave={() => void post({ action: 'end' })} />}
          {preview && <p style={{ color: '#d8bd68' }}>Dieses Erlebnis ist noch in Vorbereitung. Der Pod bleibt dunkel, bis die Welt fertig ist.</p>}
          {lying && <p style={{ color: '#9fc6b2' }}>Sitzung läuft bis {new Date(lying.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr{(data?.parties.find(party => party.partyId === lying.party_id)?.names.length ?? 1) > 1 ? ' · ihr liegt gemeinsam in einer Gruppe' : ''}.</p>}
          {error && <p style={{ color: '#e0a0a0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={button} disabled={busy} onClick={() => preview ? setPreview(null) : void post({ action: 'end' })}>Aufwachen</button>
          </div>
        </>}
      </div>
    </div>
  )
}
