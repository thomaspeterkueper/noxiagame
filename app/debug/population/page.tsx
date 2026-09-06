'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getToken } from '@/lib/supabase/auth'

type Need = { need_code: string; satisfaction: number }
type Assignment = { assignment_type: string; tile_entity_id: string | null; role_code: string | null }
type Knowledge = { subject_type: string; subject_ref: string; knowledge_type: string; confidence: number }
type Person = { id: string; person_key: string | null; display_name: string; activity_state: string; last_action: string | null; last_tick: number | null; last_decision_factors: Record<string, unknown>; needs: Need[]; assignments: Assignment[]; knowledge: Knowledge[] }
type Payload = { location: { name: string; population: number; population_max: number }; people: Person[]; recentEvents: Array<{ tick: number; event_type: string; actor_person_id: string; subject_ref: string | null }> }

const pct = (value: number) => `${Math.round(Number(value) * 100)}%`

export default function PopulationDebugPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Bitte zuerst anmelden.')
        const response = await fetch('/api/game/population-debug?location=mars', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Population konnte nicht geladen werden.')
        if (!cancelled) setData(payload)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      }
    })()
    return () => { cancelled = true }
  }, [])

  return <main style={{ maxWidth: 1500, margin: '0 auto', padding: '28px 24px 60px', fontFamily: 'system-ui, sans-serif', color: '#18212b' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'end', marginBottom: 24 }}>
      <div><div style={{ fontSize: 12, letterSpacing: '.14em', color: '#68727d' }}>INTERNAL · LIVING POPULATION</div><h1 style={{ margin: '4px 0' }}>Bevölkerungs-Inspektor</h1><p style={{ margin: 0, color: '#68727d' }}>Persistierter Zustand, persönliches Wissen und Entscheidungen. Keine World-Truth-/Observation-Vermischung.</p></div>
      <Link href="/dashboard">← Dashboard</Link>
    </header>
    {error && <div style={{ padding: 16, border: '1px solid #b55', borderRadius: 8 }}>{error}</div>}
    {!data && !error && <p>Lade aktive Bevölkerung …</p>}
    {data && <>
      <section style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <strong>{data.location.name}</strong><span>Gesamt {data.location.population}/{data.location.population_max}</span><span>individuell aktiv {data.people.length}</span><span>benannt {data.people.filter(p => p.person_key).length}</span>
      </section>
      <div style={{ overflowX: 'auto', border: '1px solid #d9dde2', borderRadius: 10, background: '#fff' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', background: '#f5f6f7' }}>{['Person','Rolle / Arbeit','Zustand','Bedürfnisse','persönliches Wissen','letzte Entscheidung'].map(h => <th key={h} style={{ padding: 10, borderBottom: '1px solid #d9dde2' }}>{h}</th>)}</tr></thead><tbody>{data.people.map(person => {
        const work = person.assignments.find(a => a.assignment_type === 'work'); const home = person.assignments.find(a => a.assignment_type === 'home')
        return <tr key={person.id} style={{ verticalAlign: 'top' }}><td style={{ padding: 10, borderBottom: '1px solid #edf0f2' }}><strong>{person.display_name}</strong><div style={{ color: '#7b858f' }}>{person.person_key ? `named · ${person.person_key}` : 'background'}</div><div>Home: {home?.tile_entity_id ?? '—'}</div></td><td style={{ padding: 10, borderBottom: '1px solid #edf0f2' }}>{work?.role_code ?? '—'}<div>{work?.tile_entity_id ?? '—'}</div></td><td style={{ padding: 10, borderBottom: '1px solid #edf0f2' }}>{person.activity_state}<div>Tick {person.last_tick ?? '—'}</div></td><td style={{ padding: 10, borderBottom: '1px solid #edf0f2' }}>{person.needs.map(n => <div key={n.need_code}>{n.need_code}: <strong>{pct(n.satisfaction)}</strong></div>)}</td><td style={{ padding: 10, borderBottom: '1px solid #edf0f2', minWidth: 250 }}>{person.knowledge.length ? person.knowledge.map((k,i) => <div key={`${k.subject_ref}-${i}`}>{k.knowledge_type}: {k.subject_type}/{k.subject_ref} ({pct(k.confidence)})</div>) : <span style={{ color: '#8a929a' }}>keine Einträge</span>}</td><td style={{ padding: 10, borderBottom: '1px solid #edf0f2', minWidth: 220 }}><strong>{person.last_action ?? '—'}</strong><pre style={{ whiteSpace: 'pre-wrap', margin: '5px 0 0', fontSize: 11 }}>{JSON.stringify(person.last_decision_factors ?? {}, null, 2)}</pre></td></tr>
      })}</tbody></table></div>
      <h2 style={{ marginTop: 28 }}>Letzte Population-Events</h2><div style={{ display: 'grid', gap: 6 }}>{data.recentEvents.map((event, i) => { const person = data.people.find(p => p.id === event.actor_person_id); return <div key={`${event.tick}-${i}`} style={{ padding: '8px 10px', border: '1px solid #e1e4e7', borderRadius: 7 }}><strong>Tick {event.tick}</strong> · {person?.display_name ?? event.actor_person_id} · {event.event_type}{event.subject_ref ? ` · ${event.subject_ref}` : ''}</div> })}</div>
    </>}
  </main>
}
