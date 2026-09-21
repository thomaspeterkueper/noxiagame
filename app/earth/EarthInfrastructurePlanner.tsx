'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getToken } from '@/lib/supabase/auth'

type SelectedObject = {
  name: string
  xM: number
  yM: number
  own: boolean
}

type SuggestionPayload = {
  ok?: boolean
  error?: string
  entityId?: string
  costCredits?: number
  existingEdge?: { id: string; status: string; length_m: number; build_cost_credits: number } | null
  suggestion?: {
    facilityPort: { xM: number; yM: number }
    roadTieIn: { xM: number; yM: number }
    geometry: Array<{ xM: number; yM: number }>
    roadFeatureId: string
    lengthM: number
  }
}

type SpatialPayload = {
  entities?: Array<{
    id: string
    name?: string
    x_m: number | null
    y_m: number | null
    isOwn?: boolean
  }>
}

type OverlayLine = {
  x1: number
  y1: number
  x2: number
  y2: number
}

function parseSelectedObject(panel: HTMLElement): SelectedObject | null {
  const name = panel.querySelector<HTMLElement>('.earth-site-head strong')?.textContent?.trim()
  const facts = Array.from(panel.querySelectorAll<HTMLElement>('.earth-site-facts > div'))
  const position = facts.find(row => (row.querySelector('span')?.textContent ?? '').trim() === 'Position')
    ?.querySelector('b')?.textContent ?? ''
  const owner = facts.find(row => (row.querySelector('span')?.textContent ?? '').trim() === 'Eigentum')
    ?.querySelector('b')?.textContent?.trim() ?? ''
  const match = position.match(/(-?\d+(?:[.,]\d+)?)\s*m\s*E\s*·\s*(-?\d+(?:[.,]\d+)?)\s*m\s*N/)
  if (!name || !match) return null
  return {
    name,
    xM: Number(match[1].replace(',', '.')),
    yM: Number(match[2].replace(',', '.')),
    own: /Dein Gebäude/i.test(owner),
  }
}

function scaleMeters(text: string) {
  const match = text.trim().match(/^([\d.,]+)\s*(km|m)$/i)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value)) return null
  return match[2].toLowerCase() === 'km' ? value * 1000 : value
}

function selectedBuildingScreenPoint(object: SelectedObject) {
  const groups = Array.from(document.querySelectorAll<SVGGElement>('.earth-map g[aria-label$=" auswählen"]'))
  const group = groups.find(candidate => (candidate.getAttribute('aria-label') ?? '') === `${object.name} auswählen`)
  if (!group) return null
  const svg = group.ownerSVGElement
  const ctm = group.getScreenCTM()
  if (!svg || !ctm) return null
  const point = svg.createSVGPoint()
  point.x = 0
  point.y = 0
  const screen = point.matrixTransform(ctm)
  return { x: screen.x, y: screen.y }
}

function computeOverlayLine(map: HTMLElement, object: SelectedObject, suggestion: SuggestionPayload['suggestion']): OverlayLine | null {
  if (!suggestion) return null
  const sourceScreen = selectedBuildingScreenPoint(object)
  const scaleLabel = map.querySelector<HTMLElement>('.earth-scale span')?.textContent ?? ''
  const scaleBar = map.querySelector<HTMLElement>('.earth-scale i')
  const meters = scaleMeters(scaleLabel)
  if (!sourceScreen || !scaleBar || !meters || meters <= 0) return null
  const pixelsPerMeter = scaleBar.getBoundingClientRect().width / meters
  const rect = map.getBoundingClientRect()
  const toMap = (point: { xM: number; yM: number }) => ({
    x: sourceScreen.x - rect.left + (point.xM - object.xM) * pixelsPerMeter,
    y: sourceScreen.y - rect.top - (point.yM - object.yM) * pixelsPerMeter,
  })
  const start = toMap(suggestion.facilityPort)
  const end = toMap(suggestion.roadTieIn)
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
}

export default function EarthInfrastructurePlanner() {
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [map, setMap] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState<SelectedObject | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)
  const [plan, setPlan] = useState<SuggestionPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [line, setLine] = useState<OverlayLine | null>(null)

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      if (cancelled) return
      const nextPanel = document.querySelector<HTMLElement>('.earth-object-panel')
      const nextMap = document.querySelector<HTMLElement>('.earth-map')
      setPanel(nextPanel)
      setMap(nextMap)
      const nextSelected = nextPanel ? parseSelectedObject(nextPanel) : null
      setSelected(previous => {
        const same = previous && nextSelected
          && previous.name === nextSelected.name
          && previous.xM === nextSelected.xM
          && previous.yM === nextSelected.yM
          && previous.own === nextSelected.own
        return same ? previous : nextSelected
      })

      // Linear infrastructure must not re-enter the footprint-building picker.
      for (const option of Array.from(document.querySelectorAll<HTMLElement>('.earth-build-option'))) {
        const name = option.querySelector<HTMLElement>('.build-name strong')?.textContent?.trim()
        if (name === 'Straße') {
          option.style.display = 'none'
          option.dataset.noxiaLinearInfrastructure = '1'
        }
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { cancelled = true; observer.disconnect() }
  }, [])

  useEffect(() => {
    setEntityId(null)
    setPlan(null)
    setMessage(null)
  }, [selected?.name, selected?.xM, selected?.yM])

  useEffect(() => {
    if (!map || !selected || !plan?.suggestion) { setLine(null); return }
    let frame = 0
    let last = 0
    const update = (now: number) => {
      if (now - last > 80) {
        last = now
        setLine(computeOverlayLine(map, selected, plan.suggestion))
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [map, selected, plan])

  async function resolveEntity() {
    if (!selected?.own) throw new Error('Nur eigene Gebäude können angeschlossen werden')
    if (entityId) return entityId
    const token = await getToken()
    if (!token) throw new Error('Nicht angemeldet')
    const response = await fetch('/api/game/build/spatial?location=earth', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const payload = await response.json() as SpatialPayload
    if (!response.ok) throw new Error('Earth-Weltzustand konnte nicht geladen werden')
    const entity = (payload.entities ?? []).find(row =>
      row.isOwn && row.name === selected.name && row.x_m != null && row.y_m != null
      && Math.abs(Number(row.x_m) - selected.xM) < 1
      && Math.abs(Number(row.y_m) - selected.yM) < 1
    )
    if (!entity) throw new Error('Das ausgewählte Weltobjekt konnte nicht eindeutig aufgelöst werden')
    setEntityId(entity.id)
    return entity.id
  }

  async function preview() {
    setBusy(true)
    setMessage(null)
    try {
      const id = await resolveEntity()
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch(`/api/game/infrastructure/earth-access?entityId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json() as SuggestionPayload
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Zufahrt konnte nicht geplant werden')
      setPlan(payload)
      setMessage(payload.existingEdge ? 'Für dieses Gebäude existiert bereits eine Straßenanbindung.' : null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function build() {
    setBusy(true)
    setMessage(null)
    try {
      const id = await resolveEntity()
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/infrastructure/earth-access', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: id }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string; edge?: { length_m: number }; credits?: number }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Straßenanbindung konnte nicht gebaut werden')
      setMessage(`Straßenanbindung aktiv · ${Math.round(Number(payload.edge?.length_m ?? 0))} m · ${Number(payload.credits ?? 0).toLocaleString('de-DE')} Cr verbleiben`)
      await preview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const controls = useMemo(() => {
    if (!panel || !selected?.own) return null
    return createPortal(
      <div className="noxia-infrastructure-access" style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #cbd7d6' }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.1em', color: '#466b78', marginBottom: 6 }}>INFRASTRUKTUR · ANSCHLUSS</div>
        {!plan?.suggestion ? <button type="button" disabled={busy} onClick={() => void preview()} style={{ width: '100%', border: '1px solid #365e6c', background: '#173f4d', color: '#f5f1df', borderRadius: 7, padding: '9px 10px', fontWeight: 900, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Straßennetz wird analysiert …' : 'Zufahrt zum realen Straßennetz planen'}</button> : <>
          <div style={{ display: 'grid', gap: 4, fontSize: 10, color: '#526970', background: '#edf3f1', padding: 8, borderRadius: 6 }}>
            <span><b>{Math.round(plan.suggestion.lengthM)} m</b> vom Gebäudeport bis zur bestehenden Straße</span>
            <span>Andockpunkt: Gebäude-Footprint → beobachtete Straße</span>
            <span>Kosten: <b>{Number(plan.costCredits ?? 0).toLocaleString('de-DE')} Cr</b></span>
          </div>
          {!plan.existingEdge && <button type="button" disabled={busy} onClick={() => void build()} style={{ width: '100%', marginTop: 7, border: '1px solid #8a6b21', background: '#c89d35', color: '#fffaf0', borderRadius: 7, padding: '9px 10px', fontWeight: 900, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Baue …' : 'Straßenanbindung bauen'}</button>}
        </>}
        {message && <div style={{ marginTop: 7, padding: 7, borderRadius: 6, background: '#f3e5b9', color: '#725516', fontSize: 9, fontWeight: 800 }}>{message}</div>}
        <small style={{ display: 'block', marginTop: 6, color: '#788486', fontSize: 8, lineHeight: 1.35 }}>Straßen sind auf der georeferenzierten Erde keine Gebäudekacheln. NOXIA erzeugt eine metrische Verbindung zwischen Gebäudeport und bestehendem Netz.</small>
      </div>,
      panel,
    )
  }, [panel, selected, plan, busy, message])

  const overlay = map && line && plan?.suggestion ? createPortal(
    <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' }}>
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#d6a936" strokeWidth="6" strokeLinecap="round" opacity=".42" />
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#5c4510" strokeWidth="2" strokeDasharray="7 5" strokeLinecap="round" />
      <circle cx={line.x1} cy={line.y1} r="6" fill="#d6a936" stroke="#5c4510" strokeWidth="2" />
      <circle cx={line.x2} cy={line.y2} r="6" fill="#f6f1df" stroke="#5c4510" strokeWidth="2" />
    </svg>,
    map,
  ) : null

  return <>{controls}{overlay}</>
}
