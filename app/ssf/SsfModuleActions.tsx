'use client'

import React, { useState } from 'react'

// Guard: Supabase may not be configured in all environments
function hasSupabase() {
  return (
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export default function SsfModuleActions({ moduleId }: { moduleId: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error' | 'no-auth'>('idle')

  async function complete() {
    setState('saving')
    try {
      // Dynamic import to avoid crash when Supabase env vars are missing
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState('no-auth')
        return
      }

      const res = await fetch('/api/ssf/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          moduleId,
          progressPercent: 100,
          completed: true,
          knowledgeAwarded: 25,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Speichern fehlgeschlagen')
      setState('done')
    } catch (e) {
      console.error('SsfModuleActions error:', e)
      setState('error')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={complete}
        disabled={state === 'saving' || state === 'done'}
        style={{
          border: '1px solid #c9a961',
          background: state === 'done' ? '#1a7a4a' : 'transparent',
          color: state === 'done' ? '#fff' : '#c9a961',
          borderRadius: 8, padding: '7px 10px',
          cursor: state === 'saving' || state === 'done' ? 'default' : 'pointer',
          fontWeight: 700,
        }}
      >
        {state === 'saving' ? 'Speichere ...' : state === 'done' ? 'Abgeschlossen' : 'Als gelernt markieren'}
      </button>
      {state === 'done' && <span style={{ color: '#8fd6a4', fontSize: '0.8rem' }}>+25 Wissen</span>}
      {state === 'no-auth' && <span style={{ color: '#ffd6a4', fontSize: '0.8rem' }}>Bitte einloggen</span>}
      {state === 'error' && <span style={{ color: '#ff9a9a', fontSize: '0.8rem' }}>Nicht gespeichert</span>}
    </div>
  )
}
