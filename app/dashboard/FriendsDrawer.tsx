// app/dashboard/FriendsDrawer.tsx
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Freunde-Liste, Suche, Anfragen, Chat öffnen
// Version:      1.0.0

'use client'

import React, { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { T } from './ui'

type Friend = { id: string; username: string }
type Request = { id: string; requester: { id: string; username: string }; created_at: string }

type Props = {
  open: boolean
  onClose: () => void
  onOpenChat: (friend: Friend) => void
  unreadDMs: number
}

export default function FriendsDrawer({ open, onClose, onOpenChat, unreadDMs }: Props) {
  const [friends, setFriends]     = useState<Friend[]>([])
  const [requests, setRequests]   = useState<Request[]>([])
  const [search, setSearch]       = useState('')
  const [results, setResults]     = useState<Friend[]>([])
  const [loading, setLoading]     = useState(false)
  const [tab, setTab]             = useState<'friends' | 'search'>('friends')

  useEffect(() => {
    if (!open) return
    loadFriends()
  }, [open])

  async function loadFriends() {
    setLoading(true)
    try {
      const token = await getToken()
      const h = { Authorization: `Bearer ${token}` }
      const [fr, rq] = await Promise.all([
        fetch('/api/game/friends?action=list', { headers: h }).then(r => r.json()),
        fetch('/api/game/friends?action=requests', { headers: h }).then(r => r.json()),
      ])
      setFriends(fr.friends ?? [])
      setRequests(rq.requests ?? [])
    } catch {}
    setLoading(false)
  }

  async function searchPlayers(q: string) {
    if (q.length < 2) { setResults([]); return }
    try {
      const token = await getToken()
      const res = await fetch(`/api/game/friends?action=search&q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json() as { results: Friend[] }
      setResults(data.results ?? [])
    } catch {}
  }

  async function sendRequest(addresseeId: string) {
    try {
      const token = await getToken()
      await fetch('/api/game/friends', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', addresseeId })
      })
      setResults(prev => prev.filter(r => r.id !== addresseeId))
    } catch {}
  }

  async function acceptRequest(requesterId: string) {
    try {
      const token = await getToken()
      await fetch('/api/game/friends', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', requesterId })
      })
      await loadFriends()
    } catch {}
  }

  async function removeFriend(otherId: string) {
    try {
      const token = await getToken()
      await fetch('/api/game/friends', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', otherId })
      })
      setFriends(prev => prev.filter(f => f.id !== otherId))
    } catch {}
  }

  if (!open) return null

  const btnStyle: React.CSSProperties = {
    fontSize: '0.68rem', padding: '3px 8px', border: `1px solid ${T.line}`,
    borderRadius: 6, cursor: 'pointer', background: 'transparent', color: T.inkSoft
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(9,14,22,0.4)', display: 'flex', alignItems: 'stretch' }}>
      <aside style={{ width: 'min(340px, 92vw)', background: T.bg, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', boxShadow: '12px 0 32px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase' as const, letterSpacing: '0.15em' }}>Soziales</div>
            <h2 style={{ margin: '0.15rem 0 0', color: T.blueDeep, fontFamily: 'Georgia, serif', fontSize: '1.15rem', fontWeight: 400 }}>
              Freunde {unreadDMs > 0 && <span style={{ background: '#e05050', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.65rem', marginLeft: 4 }}>{unreadDMs}</span>}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${T.line}`, background: T.surface, color: T.inkSoft, cursor: 'pointer' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          {(['friends', 'search'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
              background: tab === t ? T.surface : 'transparent',
              color: tab === t ? T.blueDeep : T.inkFaint,
              borderBottom: tab === t ? `2px solid ${T.blueDeep}` : '2px solid transparent',
            }}>
              {t === 'friends' ? `Freunde (${friends.length})` : 'Suchen'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>

          {/* Freundschaftsanfragen */}
          {tab === 'friends' && requests.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6rem', color: T.inkFaint, textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                Anfragen ({requests.length})
              </div>
              {requests.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(201,169,97,0.08)', border: `1px solid rgba(201,169,97,0.25)`, borderRadius: 8, marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', color: T.ink }}>👤 {r.requester.username}</span>
                  <button onClick={() => acceptRequest(r.requester.id)} style={{ ...btnStyle, background: T.blueDeep, color: '#fff', border: 'none' }}>
                    Annehmen
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Freundesliste */}
          {tab === 'friends' && (
            <>
              {loading && <div style={{ color: T.inkFaint, fontSize: '0.78rem', textAlign: 'center', padding: '1rem' }}>Lädt…</div>}
              {!loading && friends.length === 0 && (
                <div style={{ color: T.inkFaint, fontSize: '0.78rem', textAlign: 'center', padding: '2rem 1rem', lineHeight: 1.7 }}>
                  Noch keine Freunde.<br />Nutze die Suche um Spieler zu finden.
                </div>
              )}
              {friends.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: T.ink, fontWeight: 600 }}>👤 {f.username}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { onOpenChat(f); onClose() }} style={{ ...btnStyle, background: T.blueDeep, color: '#fff', border: 'none' }}>
                      💬
                    </button>
                    <button onClick={() => removeFriend(f.id)} style={{ ...btnStyle, color: '#e05050', borderColor: 'rgba(224,80,80,0.3)' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Suche */}
          {tab === 'search' && (
            <>
              <input
                type="text"
                placeholder="Spielername suchen…"
                value={search}
                onChange={e => { setSearch(e.target.value); searchPlayers(e.target.value) }}
                style={{ width: '100%', padding: '0.6rem 0.75rem', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontSize: '0.82rem', marginBottom: '0.75rem', boxSizing: 'border-box' as const, outline: 'none' }}
              />
              {results.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: T.ink }}>👤 {r.username}</span>
                  <button onClick={() => sendRequest(r.id)} style={{ ...btnStyle, background: T.blueDeep, color: '#fff', border: 'none' }}>
                    + Anfrage
                  </button>
                </div>
              ))}
              {search.length >= 2 && results.length === 0 && (
                <div style={{ color: T.inkFaint, fontSize: '0.78rem', textAlign: 'center', padding: '1rem' }}>Kein Spieler gefunden.</div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
