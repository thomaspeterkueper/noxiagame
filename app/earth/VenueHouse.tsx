'use client'

// app/earth/VenueHouse.tsx
// Einrichten und Hausrecht im Lokal (Second-Life-Mechanik, Teil 6, 05.11.2026).
// useVenueHouse lädt Einrichtung, eigenes Hausverbot und – für den Eigentümer – die
// Liste der Hausverbote; alle 30 s neu, damit ein Hausverbot auch drinnen greift.
// VenueFurnishPanel ist die Leiste in der Tafel: Einrichten an/aus, Schmuck dazu,
// speichern, Hausverbote aufheben. Gezogen wird im Raum selbst (Innenraum-Motor).

import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { DECOR_KINDS, DECOR_MAX, EMPTY_FURNISHING, banLabel, type DecorKind, type Furnishing } from '@/lib/game/hospitality/furnishing'

async function call(method: 'GET' | 'POST', query: string, body?: Record<string, unknown>) {
  const { token } = await getSessionInfo()
  if (!token) return null
  const r = await fetch('/api/game/hospitality/house' + query, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  return { ok: r.ok, data: await r.json().catch(() => ({})) }
}

export type HouseBan = { profileId: string; name: string; until: string; reason: string | null }

export function useVenueHouse(tileEntityId: string) {
  const [furnishing, setFurnishing] = useState<Furnishing>(EMPTY_FURNISHING)
  const [canEdit, setCanEdit] = useState(false)
  const [banned, setBanned] = useState<string | null>(null)
  const [bans, setBans] = useState<HouseBan[]>([])
  const load = useCallback(async () => {
    try {
      const r = await call('GET', '?tileEntityId=' + encodeURIComponent(tileEntityId))
      if (!r?.ok) return
      setFurnishing(r.data.furnishing ?? EMPTY_FURNISHING)
      setCanEdit(r.data.canEdit === true)
      setBanned(typeof r.data.banned === 'string' ? r.data.banned : null)
      setBans(Array.isArray(r.data.bans) ? r.data.bans : [])
    } catch { /* ohne Verbindung bleibt der Raum, wie er ist */ }
  }, [tileEntityId])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 30_000); return () => clearInterval(id) }, [load])
  return {
    furnishing, canEdit, banned, bans, reload: load,
    async save(next: Furnishing) { const r = await call('POST', '', { action: 'furnish', tileEntityId, furnishing: next }).catch(() => null); if (r?.ok) setFurnishing(r.data.furnishing ?? next); return r?.ok ? null : String(r?.data?.error ?? 'Keine Verbindung.') },
    async ban(profileId: string, hours: number, reason?: string) { const r = await call('POST', '', { action: 'ban', tileEntityId, profileId, hours, reason }).catch(() => null); void load(); return r?.ok ? null : String(r?.data?.error ?? 'Keine Verbindung.') },
    async lift(profileId: string) { const r = await call('POST', '', { action: 'lift', tileEntityId, profileId }).catch(() => null); void load(); return r?.ok ? null : String(r?.data?.error ?? 'Keine Verbindung.') },
  }
}

type PanelProps = {
  house: ReturnType<typeof useVenueHouse>
  draft: Furnishing | null
  setDraft: (next: Furnishing | null) => void
  center: { x: number; y: number }
  onStatus: (text: string) => void
}

export function VenueFurnishPanel({ house, draft, setDraft, center, onStatus }: PanelProps) {
  const [busy, setBusy] = useState(false)
  if (!house.canEdit) return null
  const add = (kind: DecorKind) => {
    if (!draft) return
    if (draft.decor.length >= DECOR_MAX) { onStatus(`Höchstens ${DECOR_MAX} Dinge zum Schmücken.`); return }
    const wall = kind === 'bild' || kind === 'girlande'
    setDraft({ ...draft, decor: [...draft.decor, { id: 'd' + Date.now().toString(36), kind, x: center.x + (draft.decor.length % 5) * 18 - 36, y: wall ? 40 : center.y }] })
  }
  async function save() {
    if (!draft) return
    setBusy(true)
    const error = await house.save(draft)
    setBusy(false)
    if (error) { onStatus(error); return }
    setDraft(null); onStatus('Eingerichtet – so sehen es jetzt alle.')
  }
  return <div className="menu furnish">
    <small>DEIN HAUS · EINRICHTEN</small>
    {!draft
      ? <button className="open-school" onClick={() => setDraft(structuredClone(house.furnishing))}>Einrichten: Tische umstellen, schmücken</button>
      : <>
        <p className="hint">Tische und Schmuck im Raum ziehen. Tresen, Tanzfläche, Einlass und Ausgang bleiben frei. Schmuck mit × entfernen.</p>
        <div className="moves joint">{(Object.keys(DECOR_KINDS) as DecorKind[]).map(k => <button key={k} onClick={() => add(k)}>+ {DECOR_KINDS[k].label}</button>)}</div>
        <div className="moves"><button disabled={busy} onClick={() => void save()}>{busy ? 'Speichert …' : 'Speichern'}</button><button disabled={busy} onClick={() => setDraft({ tables: {}, decor: [] })}>Wie vorher</button><button disabled={busy} onClick={() => setDraft(null)}>Abbrechen</button></div>
      </>}
    {house.bans.length > 0 && <>
      <small>HAUSVERBOTE</small>
      {house.bans.map(b => <p key={b.profileId} className="hint">{b.name} – bis {new Date(b.until).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}{b.reason ? ' (' + b.reason + ')' : ''} <button className="report" onClick={() => void house.lift(b.profileId).then(e => onStatus(e ?? 'Hausverbot aufgehoben.'))}>aufheben</button></p>)}
    </>}
  </div>
}

export const BAN_CHOICES: Array<[number, string]> = [[24, banLabel(24)], [24 * 7, banLabel(24 * 7)], [24 * 365 * 10, banLabel(24 * 365 * 10)]]
