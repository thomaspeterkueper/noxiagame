'use client'

import { useEffect, useState } from 'react'
import type { HistoricalScene } from '@/lib/game/chronotravel/domain'
import styles from './chronotravel.module.css'

const epochs: Record<number, { heading: string; description: string; landmarks: string[]; sky: string }> = {
  550: {
    heading: 'Konstantinopel · 550 n. Chr.',
    description: 'Byzantinisches Hippodrom zur Zeit Justinians. Die sichtbaren Gebäude sind derzeit abstrahierte Platzhalter, keine gesicherte Rekonstruktion.',
    landmarks: ['Rennbahn', 'Kaiserloge (schematisch)', 'Tribünen (schematisch)'],
    sky: '#d5b27a',
  },
  1200: {
    heading: 'Konstantinopel · 1200 n. Chr.',
    description: 'Spätbyzantinische Stadtszene vor 1204. Die Architektur und Stellung der Objekte sind zunächst nur illustrativ.',
    landmarks: ['Hippodrom', 'Tribünenreste (schematisch)', 'Stadthäuser (schematisch)'],
    sky: '#d6a78a',
  },
  1700: {
    heading: 'Istanbul · 1700 n. Chr.',
    description: 'Der ehemalige Hippodrombereich als osmanischer Atmeydanı. Noch keine quellengeprüfte Stadtrekonstruktion.',
    landmarks: ['Atmeydanı', 'Obelisk (schematisch)', 'Umfeld (schematisch)'],
    sky: '#b2b9c2',
  },
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export default function ChronoTravelExplorer({ scenes }: { scenes: HistoricalScene[] }) {
  const [index, setIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, z: 0 })
  const [turn, setTurn] = useState(0)
  const [showEvidence, setShowEvidence] = useState(true)
  const scene = scenes[index]
  const info = epochs[scene.yearCE]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return
      event.preventDefault()
      if (key === 'arrowleft' || key === 'arrowright') setTurn(t => clamp(t + (key === 'arrowleft' ? -10 : 10), -70, 70))
      else setPosition(p => ({
        x: clamp(p.x + (key === 'a' ? -1 : key === 'd' ? 1 : 0), -8, 8),
        z: clamp(p.z + (key === 'w' || key === 'arrowup' ? 1 : key === 's' || key === 'arrowdown' ? -1 : 0), -8, 8),
      }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!scene || !info) return <main>Keine historische Szene verfügbar.</main>
  const changeEpoch = (next: number) => { setIndex(next); setPosition({ x: 0, z: 0 }); setTurn(0) }
  return (
    <main className={styles.shell}>
      <nav className={styles.nav}><a href="/">← noχ¹ᐃ</a><strong>ChronoTravel Agency</strong><span>Forschungsprototyp · kein Live-Ticket</span></nav>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Historische Zeitreise</p>
          <h1>Ein Ort. Drei Epochen.</h1>
          <p>Erkunde den Platz des einstigen Hippodroms in einer interaktiven, vereinfachten 2,5D-Szenenskizze.</p>
          <label htmlFor="epoch">Reisezeit wählen</label>
          <select id="epoch" value={index} onChange={e => changeEpoch(Number(e.target.value))}>
            {scenes.map((s, i) => <option key={s.id} value={i}>{s.yearCE} n. Chr.</option>)}
          </select>
          <h2>{info.heading}</h2>
          <p>{info.description}</p>
          <h3>Orientierungspunkte</h3>
          <ul>{info.landmarks.map(l => <li key={l}>{l}</li>)}</ul>
          <label className={styles.check}><input type="checkbox" checked={showEvidence} onChange={e => setShowEvidence(e.target.checked)} /> Forschungsstand anzeigen</label>
          {showEvidence && <div className={styles.evidence}><strong>Rekonstruktionsstatus: spekulativ</strong><p>Für diesen Zeitschnitt sind noch historische Primär- und Fachquellen zu kuratieren. Positionen und Bauten sind nicht als Tatsachen zu interpretieren.</p></div>}
          <button onClick={() => { setPosition({ x: 0, z: 0 }); setTurn(0) }}>Zum Startpunkt zurück</button>
        </aside>
        <section className={styles.stageArea} aria-label="Interaktive historische Szenenskizze">
          <div className={styles.stage} style={{ background: `linear-gradient(${info.sky}, #e9d8b5 55%, #8b8065 55%)` }}>
            <div className={styles.sun} />
            <div className={styles.horizon} />
            <div className={styles.scene} style={{ transform: `perspective(850px) rotateY(${-turn}deg) translate(${-position.x * 24}px, ${position.z * 16}px)` }}>
              <div className={styles.archLeft}><span>{scene.yearCE === 1700 ? 'OSMANISCHE STADT' : 'STADTBEBAUUNG'}</span></div>
              <div className={styles.archRight}><span>{scene.yearCE === 550 ? 'TRIBÜNEN' : scene.yearCE === 1200 ? 'PLATZBEBAUUNG' : 'ATMEYDANI'}</span></div>
              <div className={styles.monument}><div className={styles.tip}/><div className={styles.pillar}/><div className={styles.base}/></div>
              <div className={styles.ground}/>
              <div className={styles.path}/>
            </div>
            <div className={styles.crosshair}>+</div>
            <div className={styles.status}>Position X {position.x} · Z {position.z} · Blick {turn}°</div>
          </div>
          <div className={styles.controls}>
            <div><strong>Erkunden</strong><p>W / S vorwärts und zurück · A / D seitwärts · Pfeile links/rechts drehen</p></div>
            <div className={styles.dpad}>
              <button aria-label="Links" onClick={() => setPosition(p => ({ ...p, x: clamp(p.x-1,-8,8) }))}>←</button>
              <button aria-label="Vorwärts" onClick={() => setPosition(p => ({ ...p, z: clamp(p.z+1,-8,8) }))}>↑</button>
              <button aria-label="Zurück" onClick={() => setPosition(p => ({ ...p, z: clamp(p.z-1,-8,8) }))}>↓</button>
              <button aria-label="Rechts" onClick={() => setPosition(p => ({ ...p, x: clamp(p.x+1,-8,8) }))}>→</button>
            </div>
          </div>
          <p className={styles.footnote}>Visualisierung: stilisierte interaktive Skizze, noch keine 3D-Begehung oder VR-Unterstützung. Kein Einfluss auf die persistierte Spielwelt.</p>
        </section>
      </div>
    </main>
  )
}
