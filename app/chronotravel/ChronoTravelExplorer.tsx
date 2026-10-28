'use client'

import { useState } from 'react'
import type { HistoricalScene } from '@/lib/game/chronotravel/domain'
import styles from './chronotravel.module.css'
import HistoricalThreeScene from './HistoricalThreeScene'

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
export default function ChronoTravelExplorer({ scenes }: { scenes: HistoricalScene[] }) {
  const [index, setIndex] = useState(0)
  const [showEvidence, setShowEvidence] = useState(true)
  const scene = scenes[index]
  const info = epochs[scene.yearCE]

  if (!scene || !info) return <main>Keine historische Szene verfügbar.</main>
  const changeEpoch = (next: number) => { setIndex(next) }
  return (
    <main className={styles.shell}>
      <nav className={styles.nav}><a href="/">← noχ¹ᐃ</a><strong>ChronoTravel Agency</strong><span>Forschungsprototyp · kein Live-Ticket</span></nav>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Historische Zeitreise</p>
          <h1>Ein Ort. Drei Epochen.</h1>
          <p>Erkunde eine dreidimensionale, vereinfachte WebGL-Prototypszene des einstigen Hippodroms. Desktop-Version.</p>
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
          <button onClick={() => changeEpoch(index === 0 ? 1 : 0)}>Andere Epoche laden</button>
        </aside>
        <section className={styles.stageArea} aria-label="Interaktive historische Szenenskizze">
          <div className={styles.stage}><HistoricalThreeScene year={scene.yearCE} /></div>
          <div className={styles.controls}>
            <div><strong>Erkunden</strong><p>W / S vorwärts und zurück · A / D seitwärts · Pfeile links/rechts drehen (Tasten gedrückt halten)</p></div>

          </div>
          <p className={styles.footnote}>Visualisierung: begehbare 3D-Szenenskizze mit WebGL, aber keine authentische Rekonstruktion und keine VR-Hardware-Unterstützung. Kein Einfluss auf die persistierte Spielwelt.</p>
        </section>
      </div>
    </main>
  )
}
