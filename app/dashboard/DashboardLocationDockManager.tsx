'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'noxia:location-dock:v1'

type DockState = { collapsed: boolean }

function readState(): DockState {
  if (typeof window === 'undefined') return { collapsed: false }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<DockState>
    return { collapsed: Boolean(parsed.collapsed) }
  } catch {
    return { collapsed: false }
  }
}

function findLocationDock(): HTMLElement | null {
  const firstColumn = document.querySelector<HTMLElement>('.noxia-dashboard-shell > div > header + div > div:first-child')
  if (!firstColumn) return null

  const candidates = Array.from(firstColumn.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  const dock = candidates.find(element => (element.textContent ?? '').toLocaleLowerCase('de-DE').includes('deine orte')) ?? null
  if (!dock) return null

  dock.classList.add('noxia-location-dock-managed')
  dock.dataset.noxiaRole = 'location-dock'

  const rows = Array.from(dock.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  const cardRow = rows.find(element => {
    if (element.classList.contains('noxia-location-dock-toolbar')) return false
    return element.style.display === 'flex' || getComputedStyle(element).display === 'flex'
  })
  if (cardRow) cardRow.classList.add('noxia-location-dock-cards')

  return dock
}

export default function DashboardLocationDockManager() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<DockState>({ collapsed: false })
  const [hydrated, setHydrated] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    setState(readState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [hydrated, state])

  useEffect(() => {
    const discover = () => {
      const next = findLocationDock()
      setTarget(current => current === next ? current : next)
      const cardRow = next?.querySelector<HTMLElement>('.noxia-location-dock-cards') ?? null
      setCount(cardRow?.children.length ?? 0)
    }
    discover()
    const observer = new MutationObserver(discover)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!target) return
    target.classList.toggle('noxia-location-dock-collapsed', state.collapsed)
  }, [state.collapsed, target])

  return <>
    <style>{`
      .noxia-location-dock-managed {
        transition: width .18s ease, max-width .18s ease, padding .18s ease, box-shadow .18s ease;
      }
      .noxia-location-dock-toolbar {
        position: absolute;
        z-index: 2;
        right: 6px;
        top: 5px;
        display: flex;
        align-items: center;
        gap: 5px;
        pointer-events: auto;
      }
      .noxia-location-dock-toolbar span {
        color: #748189;
        font: 700 9px/1 system-ui, sans-serif;
        letter-spacing: .06em;
      }
      .noxia-location-dock-toolbar button {
        width: 24px;
        height: 22px;
        border: 0;
        border-radius: 5px;
        background: rgba(42,78,122,.07);
        color: #355a7d;
        cursor: pointer;
        font: 800 12px/1 system-ui, sans-serif;
      }
      .noxia-location-dock-toolbar button:hover {
        background: rgba(42,78,122,.13);
      }
      .noxia-location-dock-managed.noxia-location-dock-collapsed {
        width: 132px !important;
        max-width: 132px !important;
        min-height: 34px !important;
        padding: .45rem .45rem !important;
      }
      .noxia-location-dock-managed.noxia-location-dock-collapsed > .noxia-location-dock-cards {
        display: none !important;
      }
      .noxia-location-dock-managed.noxia-location-dock-collapsed > div:first-child {
        margin: 0 !important;
        padding-right: 54px;
        white-space: nowrap;
      }
      @media (max-width: 760px) {
        .noxia-location-dock-managed.noxia-location-dock-collapsed {
          width: 118px !important;
          max-width: 118px !important;
        }
        .noxia-location-dock-toolbar span { display: none; }
      }
    `}</style>
    {target && createPortal(
      <div className="noxia-location-dock-toolbar" aria-label="Standort-Dock Steuerung">
        <span>{count > 0 ? `${count} ORTE` : 'ORTE'}</span>
        <button
          type="button"
          title={state.collapsed ? 'Standort-Dock öffnen' : 'Standort-Dock einklappen'}
          aria-expanded={!state.collapsed}
          onClick={event => {
            event.stopPropagation()
            setState(current => ({ collapsed: !current.collapsed }))
          }}
        >{state.collapsed ? '▢' : '—'}</button>
      </div>,
      target,
      'location-dock-controls',
    )}
  </>
}
