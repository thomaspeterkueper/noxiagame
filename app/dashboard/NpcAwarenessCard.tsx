'use client'

import { useEffect, useMemo, useState } from 'react'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'

interface Props {
  residentId: string
  role: string
}

interface AwarenessResponse {
  generatedAt?: string
  items?: WorldAwarenessItem[]
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export default function NpcAwarenessCard({ residentId, role }: Props) {
  const [items, setItems] = useState<WorldAwarenessItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    fetch('/api/game/world-awareness')
      .then(response => response.ok ? response.json() as Promise<AwarenessResponse> : Promise.reject())
      .then(data => {
        if (!live) return
        setItems(Array.isArray(data.items) ? data.items : [])
      })
      .catch(() => {
        if (live) setItems([])
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => { live = false }
  }, [])

  const conversation = useMemo(
    () => awarenessConversationForResident(residentId, role, items, dayKey()),
    [residentId, role, items],
  )

  if (loading) {
    return <div style={{ color: '#8999a7', fontSize: 10 }}>Erdnachrichten werden empfangen …</div>
  }

  if (!conversation) {
    return <div style={{ color: '#8999a7', fontSize: 10 }}>Heute noch kein Gesprächsthema von der Erde empfangen.</div>
  }

  const source = sourceForAwarenessItem(conversation.item)
  const published = new Date(conversation.item.publishedAt)
  const publishedLabel = Number.isNaN(published.getTime())
    ? ''
    : published.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div style={{ fontSize: 11, lineHeight: 1.45 }}>
      <div style={{ color: '#f1d57a', fontWeight: 700, marginBottom: 5 }}>GESPRÄCH VON DER ERDE</div>
      <div style={{ color: '#d8d4c8' }}>{conversation.opener}</div>
      <div style={{ color: '#aebdca', marginTop: 6 }}>{conversation.followUp}</div>
      <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid #344657', color: '#8999a7', fontSize: 9 }}>
        Quelle: {source?.name ?? conversation.item.sourceId}{publishedLabel ? ` · ${publishedLabel}` : ''}
      </div>
      <a
        href={conversation.item.url}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-block', marginTop: 6, color: '#f1d57a', fontSize: 10 }}
      >
        Originalmeldung ↗
      </a>
    </div>
  )
}
