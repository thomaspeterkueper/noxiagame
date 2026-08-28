'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import KursRenderer from '@/app/dashboard/KursRenderer'
import { MODULE_TO_PATH } from '@/lib/knowledge/ssfPaths'
import { unlockLabel, type SsfKnowledgeModule } from '@/lib/ssfKnowledge'

export default function InGameLearningPage() {
  const router = useRouter()
  const search = useSearchParams()
  const directPath = search.get('path')
  const moduleId = search.get('module')
  const unlock = search.get('unlock')

  const [resolvedPath, setResolvedPath] = useState<string | null>(directPath)
  const [loading, setLoading] = useState(!directPath)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<number | null>(null)

  const title = useMemo(() => {
    if (moduleId) return `Lernmodul ${moduleId}`
    if (unlock) return `Benötigtes Wissen: ${unlock}`
    return 'NOXIA Akademie'
  }, [moduleId, unlock])

  useEffect(() => {
    if (directPath) {
      setResolvedPath(directPath)
      setLoading(false)
      return
    }

    if (moduleId) {
      const mapped = MODULE_TO_PATH[moduleId] ?? null
      if (mapped) {
        setResolvedPath(mapped)
        setLoading(false)
        return
      }
    }

    if (!unlock) {
      setError('Für dieses Lernmodul ist noch kein In-Game-Lernpfad hinterlegt.')
      setLoading(false)
      return
    }

    let cancelled = false
    async function resolveByUnlock() {
      try {
        const res = await fetch('/api/ssf/modules', { cache: 'no-store' })
        const payload = await res.json()
        const modules: SsfKnowledgeModule[] = Array.isArray(payload)
          ? payload
          : (payload.modules ?? payload.items ?? [])

        const module = modules.find(m =>
          Array.isArray(m.unlocks) && m.unlocks.some(u => unlockLabel(u as any) === unlock)
        )

        if (!module) {
          if (!cancelled) setError('Für diese Voraussetzung wurde noch kein SSF-Lernmodul gefunden.')
          return
        }

        const mapped = MODULE_TO_PATH[module.id]
        if (!mapped) {
          if (!cancelled) setError(`Das Modul ${module.id} existiert, aber seine kanonische Lernpfad-ID fehlt NOXIA noch.`)
          return
        }

        if (!cancelled) setResolvedPath(mapped)
      } catch {
        if (!cancelled) setError('SSF-Lernmodule konnten nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolveByUnlock()
    return () => { cancelled = true }
  }, [directPath, moduleId, unlock])

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

        {loading && <div style={{ background: '#fff', border: '1px solid #ddd6c8', borderRadius: 10, padding: '1rem' }}>Lernpfad wird geladen …</div>}
        {error && <div style={{ background: '#fff', border: '1px solid #e2b9b9', color: '#a52d2d', borderRadius: 10, padding: '1rem', lineHeight: 1.6 }}>{error}</div>}

        {resolvedPath && !loading && !error && (
          <div style={{ background: '#fff', border: '1px solid #ddd6c8', borderRadius: 12, overflow: 'hidden', minHeight: 520 }}>
            <KursRenderer
              kursId={resolvedPath}
              onComplete={(punkte) => setCompleted(punkte)}
              onClose={() => router.back()}
            />
          </div>
        )}

        {completed !== null && (
          <div style={{ marginTop: '0.8rem', background: '#e8f7ef', border: '1px solid #a9d8bb', borderRadius: 8, padding: '0.8rem 1rem', color: '#1a7a4a', fontWeight: 700 }}>
            Lernmodul abgeschlossen · +{completed} Wissen
          </div>
        )}
      </div>
    </main>
  )
}
