'use client'

import { useEffect, useMemo, useState } from 'react'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'

interface ResidentLike {
  id: string
  displayName: string
  role: string
}

interface Props {
  resident: ResidentLike
  nearby?: ResidentLike | null
}

export default function NpcWorldConversation({ resident, nearby }: Props) {
  const [items, setItems] = useState<WorldAwarenessItem[]>([])
  const dayKey = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let live = true
    fetch('/api/game/world-awareness')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => live && setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => live && setItems([]))
    return () => { live = false }
  }, [])

  const conversation = useMemo(
    () => awarenessConversationForResident(resident.id, resident.role, items, dayKey),
    [resident.id, resident.role, items, dayKey],
  )

  if (!conversation) return null
  const source = sourceForAwarenessItem(conversation.item)
  const date = new Date(conversation.item.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  return (
    <section style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #344657' }}>
      <small style={{ color: '#79a6c7', letterSpacing: '.08em' }}>GESPRÄCH · ERDE · {date}</small>
      <p style={{ margin: '7px 0 5px', lineHeight: 1.45 }}>
        <b>{resident.displayName}:</b> „{conversation.opener}“
      </p>
      {nearby && (
        <p style={{ margin: '5px 0', color: '#c6d1d8', lineHeight: 1.45 }}>
          <b>{nearby.displayName}:</b> „{conversation.followUp}“
        </p>
      )}
      {!nearby && <p style={{ margin: '5px 0', color: '#c6d1d8', lineHeight: 1.45 }}>„{conversation.followUp}“</p>}
      <div style={{ color: '#8fa3b1', fontSize: 10, lineHeight: 1.4 }}>
        Reale Meldung · {source?.name ?? conversation.item.sourceId}. NPC-Reaktionen sind fiktionale Einordnungen.
      </div>
      <a href={conversation.item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, color: '#f1d57a', fontSize: 10 }}>
        Quelle öffnen ↗
      </a>
    </section>
  )
}
