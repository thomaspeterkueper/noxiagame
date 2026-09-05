'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type HudWindowId = 'profile' | 'ship' | 'feed'
type HudWindowState = {
  collapsed: boolean
  pinned: boolean
  x: number | null
  y: number | null
}
type HudLayout = Record<HudWindowId, HudWindowState>
type HudTargets = Partial<Record<HudWindowId, HTMLElement>>

const STORAGE_KEY = 'noxia:hud-layout:v1'
const DEFAULT_LAYOUT: HudLayout = {
  profile: { collapsed: false, pinned: true, x: null, y: null },
  ship: { collapsed: false, pinned: true, x: null, y: null },
  feed: { collapsed: false, pinned: true, x: null, y: null },
}
const TITLES: Record<HudWindowId, string> = {
  profile: 'Spieler',
  ship: 'Schiff & Laderaum',
  feed: 'Feed',
}

function isHudWindowId(value: string | undefined): value is HudWindowId {
  return value === 'profile' || value === 'ship' || value === 'feed'
}

function readLayout(): HudLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<HudLayout>
    return (Object.keys(DEFAULT_LAYOUT) as HudWindowId[]).reduce((result, id) => {
      const candidate = parsed[id]
      result[id] = {
        collapsed: Boolean(candidate?.collapsed),
        pinned: candidate?.pinned !== false,
        x: Number.isFinite(candidate?.x) ? Number(candidate?.x) : null,
        y: Number.isFinite(candidate?.y) ? Number(candidate?.y) : null,
      }
      if (!result[id].pinned && (result[id].x == null || result[id].y == null)) {
        result[id].pinned = true
      }
      return result
    }, {} as HudLayout)
  } catch {
    return DEFAULT_LAYOUT
  }
}

function sameTargets(a: HudTargets, b: HudTargets) {
  return a.profile === b.profile && a.ship === b.ship && a.feed === b.feed
}

function identifyHudTargets(): HudTargets {
  const rail = document.querySelector<HTMLElement>('.noxia-dashboard-shell > div > header + div > div:last-child')
  if (!rail) return {}

  rail.classList.add('noxia-hud-rail')
  const next: HudTargets = {}
  const children = Array.from(rail.children).filter((node): node is HTMLElement => node instanceof HTMLElement)

  for (const [index, element] of children.entries()) {
    const text = (element.textContent ?? '').toLocaleLowerCase('de-DE')
    let id: HudWindowId | null = null
    if (text.includes('an bord') || text.includes('laderaum')) id = 'ship'
    else if (text.includes('feed') || text.includes('die kolonie ist ruhig')) id = 'feed'
    else if (index === 0) id = 'profile'
    if (!id || next[id]) continue

    element.dataset.hudWindow = id
    element.classList.add('noxia-hud-managed')
    next[id] = element
  }
  return next
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export default function DashboardHudManager() {
  const [targets, setTargets] = useState<HudTargets>({})
  const [layout, setLayout] = useState<HudLayout>(DEFAULT_LAYOUT)
  const [hydrated, setHydrated] = useState(false)
  const drag = useRef<{
    id: HudWindowId
    startX: number
    startY: number
    originX: number
    originY: number
    width: number
    height: number
    pointerId: number
  } | null>(null)

  useEffect(() => {
    setLayout(readLayout())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [hydrated, layout])

  useEffect(() => {
    const discover = () => {
      const next = identifyHudTargets()
      setTargets(current => sameTargets(current, next) ? current : next)
    }
    discover()
    const observer = new MutationObserver(discover)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const patchWindow = useCallback((id: HudWindowId, patch: Partial<HudWindowState>) => {
    setLayout(current => ({ ...current, [id]: { ...current[id], ...patch } }))
  }, [])

  useEffect(() => {
    for (const id of Object.keys(DEFAULT_LAYOUT) as HudWindowId[]) {
      const element = targets[id]
      if (!element) continue
      const state = layout[id]
      element.classList.toggle('noxia-hud-collapsed', state.collapsed)
      element.classList.toggle('noxia-hud-free', !state.pinned)

      if (state.pinned) {
        element.style.removeProperty('position')
        element.style.removeProperty('left')
        element.style.removeProperty('top')
        element.style.removeProperty('right')
        element.style.removeProperty('width')
        element.style.removeProperty('z-index')
      } else if (state.x != null && state.y != null) {
        element.style.position = 'fixed'
        element.style.left = `${state.x}px`
        element.style.top = `${state.y}px`
        element.style.right = 'auto'
        element.style.zIndex = '1160'
        if (!element.style.width) element.style.width = `${Math.max(220, element.getBoundingClientRect().width)}px`
      }
    }
  }, [layout, targets])

  useEffect(() => {
    const onResize = () => {
      setLayout(current => {
        let changed = false
        const next = { ...current }
        for (const id of Object.keys(DEFAULT_LAYOUT) as HudWindowId[]) {
          const state = current[id]
          const element = targets[id]
          if (state.pinned || state.x == null || state.y == null || !element) continue
          const rect = element.getBoundingClientRect()
          const x = clamp(state.x, 8, window.innerWidth - Math.max(180, rect.width) - 8)
          const y = clamp(state.y, 62, window.innerHeight - Math.max(32, rect.height) - 8)
          if (x !== state.x || y !== state.y) {
            next[id] = { ...state, x, y }
            changed = true
          }
        }
        return changed ? next : current
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [targets])

  function togglePin(id: HudWindowId) {
    const element = targets[id]
    const state = layout[id]
    if (!element) return
    if (state.pinned) {
      const rect = element.getBoundingClientRect()
      patchWindow(id, {
        pinned: false,
        x: clamp(rect.left, 8, window.innerWidth - rect.width - 8),
        y: clamp(rect.top, 62, window.innerHeight - rect.height - 8),
      })
    } else {
      patchWindow(id, { pinned: true, x: null, y: null })
    }
  }

  function resetWindow(id: HudWindowId) {
    patchWindow(id, { pinned: true, collapsed: false, x: null, y: null })
  }

  function onPointerDown(id: HudWindowId, event: React.PointerEvent<HTMLDivElement>) {
    const state = layout[id]
    const element = targets[id]
    if (state.pinned || !element || state.x == null || state.y == null) return
    if ((event.target as HTMLElement).closest('button')) return
    const rect = element.getBoundingClientRect()
    drag.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.x,
      originY: state.y,
      width: rect.width,
      height: rect.height,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const x = clamp(active.originX + event.clientX - active.startX, 8, window.innerWidth - active.width - 8)
    const y = clamp(active.originY + event.clientY - active.startY, 62, window.innerHeight - active.height - 8)
    patchWindow(active.id, { x, y })
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    event.stopPropagation()
  }

  return <>
    <style>{`
      .noxia-hud-managed {
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden;
        transition: box-shadow .16s ease, border-color .16s ease;
      }
      .noxia-hud-managed.noxia-hud-free {
        box-shadow: 0 15px 40px rgba(27,39,51,.22) !important;
        border-color: rgba(176,164,129,.96) !important;
      }
      .noxia-hud-windowbar {
        order: -1000;
        min-height: 30px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 5px 4px 9px;
        border-bottom: 1px solid rgba(218,214,204,.78);
        background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(246,244,238,.70));
        color: #314a5a;
        user-select: none;
        touch-action: none;
      }
      .noxia-hud-free > .noxia-hud-windowbar { cursor: grab; }
      .noxia-hud-free > .noxia-hud-windowbar:active { cursor: grabbing; }
      .noxia-hud-windowbar .noxia-hud-grip {
        opacity: .42;
        font-size: 12px;
        letter-spacing: -2px;
        width: 10px;
      }
      .noxia-hud-windowbar strong {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        line-height: 1;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .noxia-hud-windowbar .noxia-hud-actions { display: flex; gap: 2px; }
      .noxia-hud-windowbar button {
        width: 23px;
        height: 21px;
        padding: 0;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: #6a7880;
        cursor: pointer;
        font: 700 11px/1 system-ui, sans-serif;
      }
      .noxia-hud-windowbar button:hover { background: rgba(42,78,122,.09); color: #284d78; }
      .noxia-hud-windowbar button[aria-pressed="true"] { color: #9a7a2f; background: rgba(201,169,97,.12); }
      .noxia-hud-managed.noxia-hud-collapsed {
        min-height: 30px !important;
        max-height: 30px !important;
        overflow: hidden !important;
      }
      .noxia-hud-managed.noxia-hud-collapsed > *:not(.noxia-hud-windowbar) { display: none !important; }
      .noxia-hud-managed.noxia-hud-collapsed > .noxia-hud-windowbar { border-bottom: 0; }
      @media (max-width: 760px) {
        .noxia-hud-windowbar { min-height: 28px; }
        .noxia-hud-managed.noxia-hud-collapsed { min-height: 28px !important; max-height: 28px !important; }
      }
    `}</style>
    {(Object.keys(DEFAULT_LAYOUT) as HudWindowId[]).map(id => {
      const target = targets[id]
      if (!target) return null
      const state = layout[id]
      return createPortal(
        <div
          className="noxia-hud-windowbar"
          onClick={event => event.stopPropagation()}
          onDoubleClick={event => { event.stopPropagation(); patchWindow(id, { collapsed: !state.collapsed }) }}
          onPointerDown={event => onPointerDown(id, event)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={`${TITLES[id]} Fenstersteuerung`}
        >
          <span className="noxia-hud-grip" aria-hidden="true">⠿</span>
          <strong>{TITLES[id]}</strong>
          <div className="noxia-hud-actions">
            <button
              type="button"
              title={state.pinned ? 'Fenster lösen und verschiebbar machen' : 'Fenster rechts anheften'}
              aria-pressed={state.pinned}
              onClick={event => { event.stopPropagation(); togglePin(id) }}
            >{state.pinned ? '●' : '○'}</button>
            <button
              type="button"
              title={state.collapsed ? 'Fenster aufklappen' : 'Fenster einklappen'}
              aria-expanded={!state.collapsed}
              onClick={event => { event.stopPropagation(); patchWindow(id, { collapsed: !state.collapsed }) }}
            >{state.collapsed ? '▢' : '—'}</button>
            <button
              type="button"
              title="Fenster zurücksetzen"
              onClick={event => { event.stopPropagation(); resetWindow(id) }}
            >⌂</button>
          </div>
        </div>,
        target,
        `hud-window-${id}`,
      )
    })}
  </>
}
