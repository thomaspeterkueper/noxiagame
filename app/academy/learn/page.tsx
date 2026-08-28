'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import KursRenderer from '@/app/dashboard/KursRenderer'
import SsfModuleRenderer from './SsfModuleRenderer'
import { unlockLabel, type SsfKnowledgeModule } from '@/lib/ssfKnowledge'

function InGameLearningContent() {
  const router = useRouter()
  const search = useSearchParams()
  const directPath = search.get('path')
  const requestedModuleId = search.get('module')
  const unlock = search.get('unlock')

  const [moduleId, setModuleId] = useState<string | null>(requestedModuleId)
  const [localPath, setLocalPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<{ points: number; unlocks: string[] } | null>(null)

  const title = useMemo(() => {
    if (moduleId) return `Lernmodul ${moduleId}`
    if (unlock) return `Benötigtes Wissen: ${unlock}`
    return 'NOXIA Akademie'
  }, [moduleId, unlock])

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      setLoading(true); setError(null); setLocalPath(null)
      if (requestedModuleId) {
        setModuleId(requestedModuleId)
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/ssf/modules', { cache: 'no-store' })
        const payload = await res.json()
        const modules: SsfKnowledgeModule[] = Array.isArray(payload)
          ? payload
          : (payload.modules ?? payload.items ?? [])

        let match: SsfKnowledgeModule | undefined
        if (directPath) match = modules.find(m => m.pathId === directPath)
        if (!match && unlock) {
          match = modules.find(m => Array.isArray(m.unlocks) && m.unlocks.some(u => unlockLabel(u as any) === unlock))
        }

        if (match) {
          if (!cancelled) setModuleId(match.id)
          return
        }

        if (directPath) {
          // Nicht jeder NOXIA-Kurs ist ein SSF-Modul. Für lokale Kurse bleibt
          // der bestehende Foundation-Kursrenderer verfügbar.
          if (!cancelled) setLocalPath(directPath)
          return
        }

        if (!cancelled) setError('Für diese Voraussetzung wurde noch kein SSF-Lernmodul gefunden.')
      } catch {
        if (!cancelled) setError('SSF-Lernmodule konnten nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [directPath, requestedModuleId, unlock])

  return (
    <main style={{ minHeight: '100vh', background: '#f4f2ed', color: '#1a1a18', padding: '1rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.62rem', color: '#8a6a00', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>NOXIA · Solar Science Foundation</div>
            <h1 style={{ margin: '0.25rem 0 0', color: '#1d3a5f', fontFamily: 'Georgia, serif', fontWeight: 400 }}>{title}</h1>
          </div>
          <button onClick={() => router.back()} style={{ border: '1px solid #ddd6c8', background: '#fff', borderRadius: 8, padding: '0.55rem 0.9rem', cursor: 'pointer', color: '#2a4e7a', fontWeight: 700 }}>← Zurück ins Spiel</button>
        </div>

        {loading && <div style={{ background: '#fff', border: '1px solid #ddd6c8', borderRadius: 10, padding: '1rem' }}>Lernmodul wird geladen …</div>}
        {error && <div style={{ background: '#fff', border: '1px solid #e2b9b9', color: '#a52d2d', borderRadius: 10, padding: '1rem', lineHeight: 1.6 }}>{error}</div>}

        {moduleId && !loading && !error && (
          <div style={{ background: '#fff', border: '1px solid #ddd6c8', borderRadius: 12, overflow: 'hidden', minHeight: 520 }}>
            <SsfModuleRenderer moduleId={moduleId} onComplete={setCompleted} />
          </div>
        )}

        {localPath && !loading && !error && (
          <div style={{ background: '#fff', border: '1px solid #ddd6c8', borderRadius: 12, overflow: 'hidden', minHeight: 520 }}>
            <KursRenderer kursId={localPath} onComplete={(punkte) => setCompleted({ points: punkte, unlocks: [] })} onClose={() => router.back()} />
          </div>
        )}

        {completed && (
          <div style={{ marginTop: '0.8rem', background: '#e8f7ef', border: '1px solid #a9d8bb', borderRadius: 8, padding: '0.8rem 1rem', color: '#1a7a4a', fontWeight: 700 }}>
            Lernmodul abgeschlossen{completed.points > 0 ? ` · +${completed.points} Wissen` : ''}
            {completed.unlocks.length > 0 && <div style={{ marginTop: 4 }}>Freigeschaltet: {completed.unlocks.join(' · ')}</div>}
            <button onClick={() => router.back()} style={{ marginTop: 9, border: '1px solid #8fc7a6', background: '#fff', color: '#1a7a4a', borderRadius: 7, padding: '0.5rem 0.8rem', cursor: 'pointer', fontWeight: 700 }}>Zurück zum Bauen →</button>
          </div>
        )}
      </div>
    </main>
  )
}

export default function InGameLearningPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', background: '#f4f2ed', padding: '1rem' }}>Lernmodul wird geladen …</main>}>
      <InGameLearningContent />
    </Suspense>
  )
}
