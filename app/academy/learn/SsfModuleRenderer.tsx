'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SsfKnowledgeModuleDetail, SsfModuleAssessment } from '@/lib/ssfKnowledge'

const C = {
  text: '#1a1a18', muted: '#6b6357', faint: '#9e9485', border: '#ddd6c8',
  accent: '#2a4e7a', gold: '#8a6a00', green: '#1a7a4a', red: '#b52a2a',
  bgAlt: '#f6f2e9',
}

export default function SsfModuleRenderer({
  moduleId,
  onComplete,
}: {
  moduleId: string
  onComplete?: (result: { points: number; unlocks: string[] }) => void
}) {
  const [module, setModule] = useState<SsfKnowledgeModuleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/ssf/modules/${encodeURIComponent(moduleId)}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok || !data.module) throw new Error(data.error ?? 'module_not_found')
        if (!cancelled) {
          setModule(data.module)
          setAnswers(Array((data.module.assessment ?? []).length).fill(-1))
        }
      } catch {
        if (!cancelled) setError('Das SSF-Lernmodul konnte nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [moduleId])

  const passed = useMemo(() => {
    if (!module) return false
    if (module.assessment.length === 0) return module.sections.length > 0
    const correct = module.assessment.filter((q, i) => answers[i] === q.correctOption).length
    return correct >= Math.ceil(module.assessment.length * 0.7)
  }, [module, answers])

  async function complete() {
    if (!module || completing || done) return
    setCompleting(true); setError(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) throw new Error('no_session')
      const res = await fetch(`/api/game/knowledge?action=complete_module&module_id=${encodeURIComponent(module.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'complete_failed')
      setDone(true)
      onComplete?.({
        points: Number(data.points_awarded ?? 0),
        unlocks: Array.isArray(data.unlocks_granted) ? data.unlocks_granted : [],
      })
    } catch {
      setError('Der Modulabschluss konnte nicht gespeichert werden.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) return <div style={{ padding: '1.25rem', color: C.muted }}>Lernmodul wird geladen …</div>
  if (error && !module) return <div style={{ padding: '1.25rem', color: C.red }}>{error}</div>
  if (!module) return null

  return (
    <div style={{ padding: '1.25rem', color: C.text }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: '1rem', marginBottom: '1rem' }}>
        <div style={{ color: C.gold, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Solar Science Foundation · {module.domain}</div>
        <h2 style={{ color: C.accent, margin: '0.35rem 0', fontFamily: 'Georgia, serif', fontWeight: 400 }}>{module.title}</h2>
        <div style={{ color: C.muted, lineHeight: 1.6 }}>{module.summary}</div>
        <div style={{ color: C.faint, fontSize: '0.72rem', marginTop: 6 }}>{module.durationMinutes} Min. · Schwierigkeit {module.difficulty}</div>
      </div>

      {module.sections.length === 0 && (
        <div style={{ padding: '1rem', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted }}>
          Für dieses Modul liegen in SSF noch keine didaktischen Inhalte vor. NOXIA erzeugt hier bewusst keinen Ersatzinhalt.
        </div>
      )}

      {module.sections.map((section, i) => {
        if (section.type === 'heading') return <h3 key={i} style={{ color: C.accent, margin: '1.35rem 0 0.55rem' }}>{section.text}</h3>
        if (section.type === 'text') return <p key={i} style={{ lineHeight: 1.75, margin: '0.55rem 0' }}>{section.text}</p>
        if (section.type === 'key_point') return <div key={i} style={{ background: C.bgAlt, borderLeft: `3px solid ${C.gold}`, padding: '0.75rem 0.9rem', margin: '0.65rem 0', lineHeight: 1.6 }}>{section.text}</div>
        if (section.type === 'example') return <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.8rem 0.9rem', margin: '0.65rem 0' }}><strong style={{ color: C.accent }}>{section.title}</strong><div style={{ marginTop: 5, lineHeight: 1.65 }}>{section.text}</div></div>
        return <div key={i} style={{ background: '#eef4fb', border: '1px solid #c6d8ec', borderRadius: 8, padding: '0.8rem 0.9rem', margin: '0.65rem 0' }}><strong>Aufgabe:</strong> {section.prompt}{section.hint && <div style={{ color: C.muted, fontSize: '0.82rem', marginTop: 5 }}>Hinweis: {section.hint}</div>}</div>
      })}

      {module.assessment.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ color: C.accent }}>Wissenscheck</h3>
          {module.assessment.map((q: SsfModuleAssessment, qi: number) => (
            <div key={qi} style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ padding: '0.7rem 0.85rem', background: C.bgAlt, fontWeight: 700 }}>{qi + 1}. {q.question}</div>
              <div style={{ padding: '0.65rem 0.85rem' }}>
                {q.options.map((option, oi) => {
                  const selected = answers[qi] === oi
                  const correct = checked && oi === q.correctOption
                  const wrong = checked && selected && oi !== q.correctOption
                  return (
                    <button key={oi} disabled={checked} onClick={() => setAnswers(prev => { const next = [...prev]; next[qi] = oi; return next })}
                      style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 5, padding: '0.55rem 0.7rem', borderRadius: 6, border: `1px solid ${correct ? C.green : wrong ? C.red : selected ? C.accent : C.border}`, background: correct ? '#e8f7ef' : wrong ? '#faeaea' : selected ? '#eef4fb' : '#fff', cursor: checked ? 'default' : 'pointer' }}>
                      {option}
                    </button>
                  )
                })}
                {checked && <div style={{ color: C.muted, fontSize: '0.8rem', marginTop: 6 }}>{q.explanation}</div>}
              </div>
            </div>
          ))}
          {!checked && <button disabled={answers.some(a => a < 0)} onClick={() => setChecked(true)} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: 7, background: answers.some(a => a < 0) ? '#d8d3ca' : C.accent, color: '#fff', cursor: answers.some(a => a < 0) ? 'not-allowed' : 'pointer', fontWeight: 700 }}>Auswerten</button>}
          {checked && !passed && <div style={{ color: C.red, fontWeight: 700 }}>Noch nicht bestanden. Lies die Erklärungen und versuche es erneut.</div>}
          {checked && !passed && <button onClick={() => { setChecked(false); setAnswers(Array(module.assessment.length).fill(-1)) }} style={{ marginTop: 8, padding: '0.55rem 0.85rem', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }}>Erneut versuchen</button>}
        </div>
      )}

      {(module.assessment.length === 0 ? module.sections.length > 0 : checked && passed) && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
          <button onClick={complete} disabled={completing || done} style={{ padding: '0.75rem 1.1rem', border: 0, borderRadius: 8, background: done ? C.green : C.gold, color: '#fff', fontWeight: 700, cursor: completing || done ? 'default' : 'pointer' }}>
            {done ? '✓ Abgeschlossen' : completing ? 'Speichere …' : 'Modul abschließen →'}
          </button>
          {module.unlocks.length > 0 && <div style={{ marginTop: 8, color: C.gold, fontSize: '0.8rem', fontWeight: 700 }}>Freischaltung: {module.unlocks.join(' · ')}</div>}
        </div>
      )}
      {error && module && <div style={{ marginTop: 10, color: C.red }}>{error}</div>}
    </div>
  )
}
