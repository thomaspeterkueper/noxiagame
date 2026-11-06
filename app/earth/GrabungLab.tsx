'use client'

import { useState } from 'react'
import { ANALYSES, FIELD_LAB, analysisStatus, runAnalysis, type Finding } from '@/lib/game/lab/lab'
import { SAMPLES } from '@/lib/worldlab/dvarakaGrabung'

type Tab = 'analyse' | 'lernen' | 'experiment'

/**
 * Grabungslabor (Feldlabor) der Dvārakā-Grabung: Proben der besuchten Fundstellen analysieren, lernen, experimentieren.
 * Der Kern liegt in lib/game/lab/lab.ts und gilt ebenso für Erd- und Stationslabors. Hier: Feldlabor ohne Spektroskopie;
 * Proben dafür gehen später an ein Stationslabor. Freischaltungen (Lernen) sind angeschlossen, sobald es dafür Einträge gibt.
 */
export default function GrabungLab({ seen, unlocked = [], onClose }: { seen: string[]; unlocked?: string[]; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('analyse')
  const [done, setDone] = useState<Record<string, Finding[]>>({})
  const [note, setNote] = useState<string | null>(null)
  const samples = seen.filter(id => SAMPLES[id]).map(id => SAMPLES[id])

  const tabButton = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} style={{ border: 0, borderBottom: tab === id ? '2px solid #b8962f' : '2px solid transparent', background: 'transparent', padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer', color: '#1b3540' }}>{label}</button>
  )
  const button: React.CSSProperties = { border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '5px 9px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }

  function analyse(sampleId: string, source: string, analysisId: string) {
    const sample = SAMPLES[source]
    const result = runAnalysis(sample, analysisId, FIELD_LAB, unlocked)
    if (result.ok) {
      setDone(prev => ({ ...prev, [sampleId]: [...(prev[sampleId] ?? []).filter(f => f.analysisId !== analysisId), result.finding] }))
      setNote(null)
    } else setNote(result.reason === 'needs-lab' ? 'Das kann das Feldlabor nicht. Die Probe müsste an ein Stationslabor gehen.' : result.reason === 'needs-learning' ? 'Dafür fehlt dir noch das Wissen. Im Reiter „Lernen“ findest du den Weg.' : 'Diese Analyse liefert an dieser Probe nichts Auswertbares.')
  }

  return (
    <div style={{ position: 'absolute', inset: 8, background: '#eef1ed', color: '#1b3540', border: '1px solid #78919a', borderRadius: 10, display: 'flex', flexDirection: 'column', font: '12px/1.5 system-ui', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#102b38', color: '#fff' }}>
        <div><small style={{ color: '#d8bd68', fontWeight: 900, letterSpacing: '.08em' }}>FELDLABOR</small><strong style={{ display: 'block' }}>Grabungslabor Dvārakā</strong></div>
        <button onClick={onClose} aria-label="Labor verlassen" style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '0 8px', borderBottom: '1px solid #ccd4d1' }}>{tabButton('analyse', 'Analysieren')}{tabButton('lernen', 'Lernen')}{tabButton('experiment', 'Experimentieren')}</div>
      <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
        {tab === 'analyse' && <>
          <p style={{ marginTop: 0 }}>Das Feldlabor nimmt Proben auf und macht Basis- und geowissenschaftliche Analysen. Spektroskopie gibt es nur im Stationslabor. Proben bekommst du an Fundstellen, die du besucht hast.</p>
          {!samples.length && <p style={{ color: '#65767b' }}>Noch keine Probe. Besuche Fundstellen wie G4, G9, G10 oder G13 und komm wieder.</p>}
          {note && <p style={{ color: '#8a3b3b' }}>{note}</p>}
          {samples.map(sample => (
            <div key={sample.id} style={{ border: '1px solid #ccd4d1', borderRadius: 8, background: '#f8faf6', padding: '8px 10px', marginBottom: 8 }}>
              <b>{sample.label}</b> <small style={{ color: '#65767b' }}>({sample.source})</small>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                {Object.values(ANALYSES).map(analysis => {
                  const status = analysisStatus(analysis, FIELD_LAB, unlocked)
                  return <button key={analysis.id} style={{ ...button, opacity: status === 'ready' ? 1 : 0.55 }} onClick={() => analyse(sample.id, sample.source, analysis.id)}>{analysis.label}{status === 'needs-lab' ? ' (Stationslabor)' : ''}</button>
                })}
              </div>
              {(done[sample.id] ?? []).map(finding => (
                <div key={finding.analysisId} style={{ borderTop: '1px dashed #ccd4d1', paddingTop: 5, marginTop: 5 }}>
                  <small style={{ color: '#65767b' }}>{ANALYSES[finding.analysisId]?.label}</small>
                  <div><b>Messung:</b> {finding.measurement}</div>
                  {finding.interpretation && <div style={{ color: '#5a4a1c' }}><b>Deutung:</b> {finding.interpretation}</div>}
                </div>
              ))}
            </div>
          ))}
        </>}
        {tab === 'lernen' && <>
          <p style={{ marginTop: 0 }}>Wissen erlaubt dir einen Versuch, es behauptet nie ein Ergebnis. Was du lernst, schaltet Analysen und Experimente frei, im Feldlabor wie später auf Stationen jenseits der Erde.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={button} onClick={() => window.location.assign('/academy/learn')}>Lernmodule öffnen</button>
            <button style={button} onClick={() => window.location.assign('/knowledge')}>Wissensstand öffnen</button>
          </div>
        </>}
        {tab === 'experiment' && <>
          <p style={{ marginTop: 0 }}>Experimente folgen. Gedacht ist: Hypothese wählen, Versuch aufbauen, Ergebnis lesen. Der Versuchsaufbau setzt das passende Wissen voraus, und auf Stationen entscheiden Ausstattung und Vorräte mit, was möglich ist.</p>
          <p style={{ color: '#65767b' }}>Noch nicht gebaut.</p>
        </>}
      </div>
    </div>
  )
}
