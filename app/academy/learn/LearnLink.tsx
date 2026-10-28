'use client'

// app/academy/learn/LearnLink.tsx
// Erstellt: 28.10.2026 — einheitliches „Jetzt lernen →“ für jede Voraussetzung
//
// Bekommt eine Freischaltung (UNL:NOX:…) und verlinkt direkt auf das Lernmodul,
// das sie lehrt (SSF-Angabe oder NOXIAs Lernverzeichnis). Gibt es dafür noch
// kein Modul, steht dort ehrlich „Lernmodul folgt“ statt eines toten Links.
// Die Modulliste wird pro Seite nur einmal geladen.

import { useEffect, useState, type CSSProperties } from 'react'
import { resolveModuleForUnlock, type SsfKnowledgeModule } from '@/lib/ssfKnowledge'

let modulesPromise: Promise<SsfKnowledgeModule[]> | null = null

function loadModules(): Promise<SsfKnowledgeModule[]> {
  if (!modulesPromise) {
    modulesPromise = fetch('/api/ssf/modules', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => (Array.isArray(data) ? data : (data.modules ?? [])) as SsfKnowledgeModule[])
      .catch(() => { modulesPromise = null; return [] })
  }
  return modulesPromise
}

/** Link zum Lernmodul einer Freischaltung, oder null, solange keins bekannt ist. */
export function useLearnHref(unlock: string | null | undefined): { href: string | null; state: 'loading' | 'ready' } {
  const [result, setResult] = useState<{ unlock: string; href: string | null } | null>(null)
  useEffect(() => {
    if (!unlock) return
    let live = true
    loadModules().then(modules => {
      if (!live) return
      const match = resolveModuleForUnlock(modules, unlock)
      setResult({
        unlock,
        href: match ? `/academy/learn?module=${encodeURIComponent(match.id)}&unlock=${encodeURIComponent(unlock)}` : null,
      })
    })
    return () => { live = false }
  }, [unlock])
  if (!unlock) return { href: null, state: 'ready' }
  if (!result || result.unlock !== unlock) return { href: null, state: 'loading' }
  return { href: result.href, state: 'ready' }
}

export default function LearnLink({
  unlock,
  label = 'Jetzt lernen →',
  style,
  className,
  pendingText = 'Lernmodul folgt',
}: {
  unlock: string | null | undefined
  label?: string
  style?: CSSProperties
  className?: string
  /** Text, wenn die SSF für diese Voraussetzung noch kein Modul hat; null = nichts zeigen. */
  pendingText?: string | null
}) {
  const { href, state } = useLearnHref(unlock)
  if (!unlock || state === 'loading') return null
  if (!href) return pendingText ? <span className={className} style={{ ...style, opacity: 0.7, cursor: 'default' }}>{pendingText}</span> : null
  return (
    <a href={href} className={className} style={style} onClick={event => event.stopPropagation()}>
      {label}
    </a>
  )
}
