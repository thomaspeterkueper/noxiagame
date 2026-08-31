'use client'

import { useEffect, useMemo, useState } from 'react'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'

type Resident = {
  id: string
  displayName: string
  activityState: string
  assignments?: { type: string; roleCode: string | null }[]
}

function residentRole(resident: Resident) {
  return resident.assignments?.find(a => a.type === 'work')?.roleCode ?? resident.activityState ?? 'general'
}

export default function ColonyConversationLayer({ locationSlug }: { locationSlug: string }) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [items, setItems] = useState<WorldAwarenessItem[]>([])
  const [open, setOpen] = useState(false)
  const [turn, setTurn] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([
      fetch(`/api/game/population?locationSlug=${encodeURIComponent(locationSlug)}`).then(r => r.ok ? r.json() : { residents: [] }),
      fetch('/api/game/world-awareness').then(r => r.ok ? r.json() : { items: [] }),
    ]).then(([population, awareness]) => {
      if (!live) return
      setResidents(Array.isArray(population.residents) ? population.residents : [])
      setItems(Array.isArray(awareness.items) ? awareness.items : [])
    }).catch(() => {})
    return () => { live = false }
  }, [locationSlug])

  useEffect(() => {
    const timer = setInterval(() => setTurn(value => value + 1), 18000)
    return () => clearInterval(timer)
  }, [])

  const scene = useMemo(() => {
    if (residents.length < 1 || items.length < 1) return null
    const first = residents[turn % residents.length]
    const second = residents.length > 1 ? residents[(turn + 1) % residents.length] : null
    const dayKey = new Date().toISOString().slice(0, 10)
    const conversation = awarenessConversationForResident(first.id, residentRole(first), items, dayKey)
    if (!conversation) return null
    return { first, second, conversation, source: sourceForAwarenessItem(conversation.item) }
  }, [residents, items, turn])

  if (!scene) return null

  return (
    <div style={{ position: 'absolute', zIndex: 118, left: 16, bottom: 70, width: open ? 350 : 270, fontFamily: 'system-ui', color: '#e8f0f5' }}>
      <button onClick={() => setOpen(value => !value)} style={{ width: '100%', textAlign: 'left', border: '1px solid #45657c', borderRadius: open ? '9px 9px 0 0' : 9, background: '#091925ee', color: '#e8f0f5', padding: '9px 11px', cursor: 'pointer' }}>
        <small style={{ color: '#79a6c7', letterSpacing: '.1em' }}>KOLONIEGESPRÄCH · ERDE</small><br />
        <b>{scene.first.displayName}{scene.second ? ` + ${scene.second.displayName}` : ''}</b>
      </button>
      {open && <div style={{ border: '1px solid #45657c', borderTop: 0, borderRadius: '0 0 9px 9px', background: '#071421f2', padding: 11, fontSize: 12, lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 8px' }}><b>{scene.first.displayName}:</b> „{scene.conversation.opener}“</p>
        <p style={{ margin: '0 0 9px', color: '#c8d5dd' }}><b>{scene.second?.displayName ?? 'Du'}:</b> „{scene.conversation.followUp}“</p>
        <div style={{ color: '#8fa3b1', fontSize: 10 }}>Reale Meldung: {scene.source?.name ?? scene.conversation.item.sourceId}. Die Reaktionen der Bewohner sind fiktional.</div>
        <a href={scene.conversation.item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 7, color: '#f1d57a', fontSize: 10 }}>Originalquelle öffnen ↗</a>
      </div>}
    </div>
  )
}
