'use client'

// app/academy/learn/ModulePicker.tsx
// Erstellt: 28.10.2026 — Lernmodule in der Akademie wieder auswählbar machen
//
// Zeigt die SSF-Lernmodule zum Auswählen. Oben stehen die Module, die eine
// Voraussetzung im Spiel erfüllen (Solarfeld, Kredit, Wasseraufbereitung …),
// mit dem Namen der Voraussetzung und dem Stand des Spielers; darunter alle
// übrigen Module. Benutzt vom In-Game-Lernen (/academy/learn) und vom Lernraum
// (SchoolOverlay, Reiter „Module“).

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SsfKnowledgeModule } from '@/lib/ssfKnowledge'
import { isGameRequirementUnlock, unlockDisplayLabel } from '@/lib/knowledge/learningCatalog'

const C = {
  text: '#1a1a18', muted: '#6b6357', faint: '#9e9485', border: '#ddd6c8',
  accent: '#2a4e7a', gold: '#8a6a00', green: '#1a7a4a', greenLight: '#e8f7ef', bgAlt: '#f6f2e9',
}

type Progress = { unlocked: Set<string>; completed: Set<string> }

async function loadProgress(): Promise<Progress | null> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const [unlocksRes, completions] = await Promise.all([
      fetch('/api/game/knowledge?action=unlocks', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('academy_completions').select('module_id').eq('profile_id', session.user.id),
    ])
    const unlocked = new Set<string>(((unlocksRes?.unlocked ?? []) as Array<{ id: string }>).map(u => u.id))
    const completed = new Set<string>(((completions.data ?? []) as Array<{ module_id: string }>).map(r => r.module_id))
    return { unlocked, completed }
  } catch {
    return null
  }
}

export function requirementUnlocks(module: SsfKnowledgeModule): string[] {
  return (module.unlocks ?? []).filter(isGameRequirementUnlock)
}

export default function ModulePicker({
  onSelect,
  highlightUnlock = null,
  modules: providedModules,
}: {
  onSelect: (moduleId: string) => void
  /** Wird hervorgehoben (z. B. die gerade fehlende Voraussetzung). */
  highlightUnlock?: string | null
  /** Bereits geladene Module; sonst lädt der Picker selbst. */
  modules?: SsfKnowledgeModule[]
}) {
  const [fetched, setFetched] = useState<SsfKnowledgeModule[] | null>(null)
  const loaded = providedModules ?? fetched
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let live = true
    if (!providedModules) {
      fetch('/api/ssf/modules', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (!live) return
          const list = Array.isArray(data) ? data : (data.modules ?? data.items ?? [])
          setFetched(list)
        })
        .catch(() => { if (live) setFailed(true) })
    }
    loadProgress().then(p => { if (live) setProgress(p) })
    return () => { live = false }
  }, [providedModules])

  const { requirementModules, otherModules } = useMemo(() => {
    const list = loaded ?? []
    const req = list.filter(m => requirementUnlocks(m).length > 0)
    const rank = (m: SsfKnowledgeModule) => (highlightUnlock && requirementUnlocks(m).includes(highlightUnlock) ? 0 : 1)
    req.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'de'))
    return { requirementModules: req, otherModules: list.filter(m => requirementUnlocks(m).length === 0) }
  }, [loaded, highlightUnlock])

  if (failed) return <div style={{ padding: '1rem', color: '#a52d2d' }}>Die Lernmodule konnten nicht geladen werden.</div>
  if (!loaded) return <div style={{ padding: '1rem', color: C.muted }}>Lernmodule werden geladen …</div>
  if (loaded.length === 0) return <div style={{ padding: '1rem', color: C.muted }}>Zurzeit werden keine Lernmodule angeboten.</div>

  const isDone = (m: SsfKnowledgeModule) => {
    if (!progress) return false
    if ([m.id, m.legacyId].some(id => id && progress.completed.has(id))) return true
    const reqs = requirementUnlocks(m)
    return reqs.length > 0 && reqs.every(u => progress.unlocked.has(u))
  }

  const card = (m: SsfKnowledgeModule, withRequirement: boolean) => {
    const done = isDone(m)
    const reqs = requirementUnlocks(m)
    const highlighted = Boolean(highlightUnlock && reqs.includes(highlightUnlock))
    return (
      <button key={m.id} onClick={() => onSelect(m.id)} title={m.summary}
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
          padding: '0.75rem 0.9rem', borderRadius: 9,
          border: `1px solid ${highlighted ? C.gold : done ? '#a9d8bb' : C.border}`,
          background: done ? C.greenLight : highlighted ? '#fbf4dd' : '#fff',
          boxShadow: highlighted ? '0 0 0 2px #e8d390' : 'none',
        }}>
        <div style={{ fontSize: '0.6rem', color: done ? C.green : C.gold, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {m.domain} · {m.durationMinutes} Min.{done ? ' · ✓ gelernt' : ''}
        </div>
        <div style={{ fontWeight: 700, color: C.text, marginTop: 3, lineHeight: 1.4 }}>{m.title}</div>
        {withRequirement && reqs.length > 0 && (
          <div style={{ marginTop: 5, fontSize: '0.74rem', color: done ? C.green : C.accent, fontWeight: 700 }}>
            🔓 {reqs.map(unlockDisplayLabel).join(' · ')}
          </div>
        )}
        {!withRequirement && m.summary && <div style={{ marginTop: 4, fontSize: '0.74rem', color: C.muted, lineHeight: 1.5 }}>{m.summary}</div>}
      </button>
    )
  }

  return (
    <div style={{ padding: '0.25rem 0' }}>
      {requirementModules.length > 0 && <>
        <div style={{ fontSize: '0.66rem', color: C.gold, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0.2rem 0 0.5rem' }}>
          Voraussetzungen im Spiel
        </div>
        <div style={{ fontSize: '0.74rem', color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Diese Module schalten etwas frei – ein Gebäude, einen Kredit, eine Fähigkeit.
        </div>
        {requirementModules.map(m => card(m, true))}
      </>}
      {otherModules.length > 0 && <>
        <button onClick={() => setShowAll(v => !v)}
          style={{ margin: '0.6rem 0', border: `1px solid ${C.border}`, background: C.bgAlt, color: C.accent, borderRadius: 7, padding: '0.5rem 0.8rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
          {showAll ? 'Weitere Module ausblenden' : `Alle weiteren Lernmodule (${otherModules.length})`}
        </button>
        {showAll && otherModules.map(m => card(m, false))}
      </>}
    </div>
  )
}
