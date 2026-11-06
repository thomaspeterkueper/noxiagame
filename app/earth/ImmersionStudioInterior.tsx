'use client'

import { useState } from 'react'
import { experiencesAt, type Chronomap } from '@/lib/worldlab/chronomaps'

const CATEGORY_LABEL: Record<Chronomap['category'], string> = { chronotrip: 'Zeitreise', game: 'Spielwelt', abstract: 'Abstrakte Erfahrung' }

const INTRO: Record<Chronomap['category'], string> = {
  chronotrip: 'Der Pod stellt deinen Körper ruhig und legt dir die Vergangenheit des Ortes unter die Füße. Du gehst, schaust und entdeckst; was belegt ist, ist als Fund gekennzeichnet, was ergänzt wurde, als Rekonstruktion oder Buchwelt.',
  game: 'Der Pod schließt sich, die Stimmen im Studio werden leise. Du trittst in eine fertige Spielwelt ein und kehrst zurück, wenn du den Pod öffnest.',
  abstract: 'Der Pod schließt sich. Es gibt keinen Ort und keine Zeit, nur Form, Klang und Bewegung. Du entscheidest, wann du auftauchst.',
}

type Stage = 'lobby' | 'pod'

/**
 * Innenraum des Erlebnis-Studios (immersion_studio): Empfang mit Pods. Man wählt ein Erlebnis aus dem Register
 * (lib/worldlab/chronomaps.ts), legt sich in einen Pod und wacht wieder auf. Die Erlebnisse selbst folgen,
 * bis dahin steht der Status „In Vorbereitung“ da.
 */
export default function ImmersionStudioInterior({ name, at, onClose }: { name: string; at?: { lat: number; lon: number }; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('lobby')
  const [chosen, setChosen] = useState<Chronomap | null>(null)
  const offers = at ? experiencesAt(at) : experiencesAt({ lat: 0, lon: 0 })

  const box: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2300, background: stage === 'pod' ? 'rgba(2,5,10,.96)' : 'rgba(2,7,12,.86)', display: 'grid', placeItems: 'center', padding: 20, transition: 'background .6s' }
  const card: React.CSSProperties = { width: 'min(620px,94vw)', maxHeight: '86vh', overflow: 'auto', background: stage === 'pod' ? '#0b1b26' : '#eef1ed', color: stage === 'pod' ? '#d7e6ee' : '#1b3540', border: '1px solid #78919a', borderRadius: 12, padding: 18, font: '13px/1.5 system-ui' }
  const button: React.CSSProperties = { border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '8px 12px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }

  return (
    <div style={box} onClick={event => event.target === event.currentTarget && stage === 'lobby' && onClose()}>
      <div style={card} role="dialog" aria-label={name}>
        {stage === 'lobby' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div><small style={{ color: '#9a7d1e', fontWeight: 900, letterSpacing: '.08em' }}>ERLEBNIS-STUDIO</small><strong style={{ display: 'block', fontSize: 16 }}>{name}</strong></div>
            <button onClick={onClose} aria-label="Schließen" style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
          <p>Eine ruhige Halle, in der Reihe an Reihe Pods stehen. Am Empfang bittet man dich, dir ein Erlebnis auszusuchen: die Vergangenheit eines Ortes, eine Spielwelt oder etwas ganz Abstraktes.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {offers.map(offer => (
              <div key={offer.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '9px 10px', border: '1px solid #ccd4d1', borderRadius: 8, background: '#f8faf6' }}>
                <span><b>{offer.title}</b><small style={{ display: 'block', color: '#65767b' }}>{CATEGORY_LABEL[offer.category]} · {offer.era}</small></span>
                <button style={button} onClick={() => { setChosen(offer); setStage('pod') }}>Pod beziehen</button>
              </div>
            ))}
          </div>
        </>}
        {stage === 'pod' && chosen && <>
          <small style={{ color: '#d8bd68', fontWeight: 900, letterSpacing: '.08em' }}>POD · {CATEGORY_LABEL[chosen.category].toUpperCase()}</small>
          <strong style={{ display: 'block', fontSize: 16, margin: '3px 0 8px' }}>{chosen.title}</strong>
          <p>{INTRO[chosen.category]}</p>
          {chosen.status !== 'playable' && <p style={{ color: '#d8bd68' }}>Dieses Erlebnis ist noch in Vorbereitung. Der Pod bleibt dunkel, bis die Welt fertig ist.</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={button} onClick={() => { setChosen(null); setStage('lobby') }}>Aufwachen</button>
          </div>
        </>}
      </div>
    </div>
  )
}
