'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ActionId = 'briefing' | 'found' | 'friends' | 'logout'
type TopbarTargets = {
  header: HTMLElement | null
  right: HTMLElement | null
  actions: Partial<Record<ActionId, HTMLButtonElement>>
}

const ACTION_LABEL: Record<ActionId, { icon: string; label: string; description: string }> = {
  briefing: { icon: '☰', label: 'Einweisung', description: 'Aufgaben und Orientierung' },
  found: { icon: '🚀', label: 'Gründen', description: 'Neuen Standort gründen' },
  friends: { icon: '💬', label: 'Freunde', description: 'Kontakte und Nachrichten' },
  logout: { icon: '↪', label: 'Abmelden', description: 'Sitzung beenden' },
}

function sameTargets(a: TopbarTargets, b: TopbarTargets) {
  return a.header === b.header && a.right === b.right &&
    a.actions.briefing === b.actions.briefing &&
    a.actions.found === b.actions.found &&
    a.actions.friends === b.actions.friends &&
    a.actions.logout === b.actions.logout
}

function findButtonByText(root: ParentNode, value: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => (button.textContent ?? '').toLocaleLowerCase('de-DE').includes(value))
}

function parseFriendBadge(button?: HTMLButtonElement) {
  const text = button?.textContent ?? ''
  const match = text.match(/\b(\d+\+?)\b/)
  return match?.[1] ?? null
}

function discoverTopbar(): TopbarTargets {
  const header = document.querySelector<HTMLElement>('.noxia-dashboard-shell > div > header')
  if (!header) return { header: null, right: null, actions: {} }

  header.classList.add('noxia-topbar-managed')
  const groups = Array.from(header.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  const left = groups[0] ?? null
  const right = groups[groups.length - 1] ?? null
  if (left) left.classList.add('noxia-topbar-brand')
  if (right) right.classList.add('noxia-topbar-status')

  const actions: Partial<Record<ActionId, HTMLButtonElement>> = {
    briefing: findButtonByText(header, 'einweisung'),
    found: findButtonByText(header, 'gründen'),
    friends: findButtonByText(header, 'freunde'),
    logout: findButtonByText(header, 'abmelden'),
  }

  for (const button of Object.values(actions)) button?.classList.add('noxia-topbar-proxied-action')

  if (right) {
    const direct = Array.from(right.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
    for (const element of direct) {
      if (element.tagName !== 'DIV') continue
      const text = (element.textContent ?? '').toLocaleLowerCase('de-DE')
      element.classList.toggle('noxia-topbar-stat-hidden', text.includes('frachter') || text.includes('bevölkerung'))
      element.classList.toggle('noxia-topbar-stat-primary', text.includes('credits') || text.includes('standort'))
    }
  }

  return { header, right, actions }
}

export default function DashboardTopbarManager() {
  const [targets, setTargets] = useState<TopbarTargets>({ header: null, right: null, actions: {} })
  const [friendBadge, setFriendBadge] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const discover = () => {
      const next = discoverTopbar()
      setTargets(current => sameTargets(current, next) ? current : next)
      const badge = parseFriendBadge(next.actions.friends)
      setFriendBadge(current => current === badge ? current : badge)
    }
    discover()
    const observer = new MutationObserver(discover)
    observer.observe(document.body, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnPointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnPointer)
    window.addEventListener('keydown', closeOnKey)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointer)
      window.removeEventListener('keydown', closeOnKey)
    }
  }, [open])

  function invoke(id: ActionId) {
    setOpen(false)
    targets.actions[id]?.click()
  }

  if (!targets.right) return <style>{baseStyles}</style>

  return <>
    <style>{baseStyles}</style>
    {createPortal(
      <div className="noxia-topbar-command" ref={menuRef}>
        <button
          type="button"
          className="noxia-topbar-command-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          title="NOXIA Aktionen"
          onClick={event => { event.stopPropagation(); setOpen(value => !value) }}
        >
          <span aria-hidden="true">⋯</span>
          <b>Aktionen</b>
          {friendBadge && <i>{friendBadge}</i>}
        </button>
        {open && <div className="noxia-topbar-command-menu" role="menu">
          <div className="noxia-topbar-command-head">
            <small>NOXIA</small>
            <strong>Aktionen</strong>
          </div>
          {(Object.keys(ACTION_LABEL) as ActionId[]).map(id => {
            if (!targets.actions[id]) return null
            const item = ACTION_LABEL[id]
            return <button key={id} type="button" role="menuitem" onClick={() => invoke(id)}>
              <span className="ico">{item.icon}</span>
              <span className="copy"><b>{item.label}</b><small>{item.description}</small></span>
              {id === 'friends' && friendBadge && <em>{friendBadge}</em>}
            </button>
          })}
        </div>}
      </div>,
      targets.right,
      'topbar-command-menu',
    )}
  </>
}

const baseStyles = `
  .noxia-topbar-managed { isolation: isolate; }
  .noxia-topbar-managed .noxia-topbar-brand > button,
  .noxia-topbar-managed .noxia-topbar-proxied-action {
    display: none !important;
  }
  .noxia-topbar-managed .noxia-topbar-stat-hidden {
    display: none !important;
  }
  .noxia-topbar-managed .noxia-topbar-status {
    gap: .55rem !important;
  }
  .noxia-topbar-managed .noxia-topbar-stat-primary {
    min-width: 0;
    padding: 0 .15rem;
  }
  .noxia-topbar-managed .noxia-topbar-stat-primary > div:first-child {
    font-size: .52rem !important;
    letter-spacing: .11em !important;
  }
  .noxia-topbar-managed .noxia-topbar-stat-primary > div:last-child {
    max-width: 230px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: .82rem !important;
  }
  .noxia-topbar-command {
    position: relative;
    display: inline-flex;
    align-items: center;
    pointer-events: auto;
  }
  .noxia-topbar-command-trigger {
    height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border: 1px solid rgba(210,207,198,.96);
    border-radius: 8px;
    background: rgba(255,255,255,.76);
    color: #31526d;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(27,39,51,.05);
  }
  .noxia-topbar-command-trigger:hover,
  .noxia-topbar-command-trigger[aria-expanded="true"] {
    border-color: #c9a961;
    background: #fff;
  }
  .noxia-topbar-command-trigger > span {
    font-size: 18px;
    line-height: 0;
    transform: translateY(-2px);
  }
  .noxia-topbar-command-trigger > b {
    font: 750 .68rem/1 system-ui,sans-serif;
  }
  .noxia-topbar-command-trigger > i {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    box-sizing: border-box;
    display: inline-grid;
    place-items: center;
    border-radius: 9px;
    background: #d84f4f;
    color: white;
    font: 800 9px/1 system-ui,sans-serif;
    font-style: normal;
  }
  .noxia-topbar-command-menu {
    position: absolute;
    z-index: 2500;
    right: 0;
    top: calc(100% + 8px);
    width: 248px;
    padding: 7px;
    border: 1px solid rgba(207,203,192,.96);
    border-radius: 11px;
    background: rgba(250,249,246,.97);
    box-shadow: 0 18px 48px rgba(27,39,51,.22);
    backdrop-filter: blur(16px);
  }
  .noxia-topbar-command-head {
    padding: 7px 9px 8px;
    border-bottom: 1px solid rgba(220,216,206,.82);
    margin-bottom: 4px;
  }
  .noxia-topbar-command-head small {
    display: block;
    color: #9a7a2f;
    font: 800 8px/1 system-ui,sans-serif;
    letter-spacing: .16em;
  }
  .noxia-topbar-command-head strong {
    display: block;
    margin-top: 3px;
    color: #29475d;
    font: 750 12px/1.2 system-ui,sans-serif;
  }
  .noxia-topbar-command-menu > button {
    width: 100%;
    min-height: 46px;
    display: grid;
    grid-template-columns: 28px minmax(0,1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #314b5c;
    cursor: pointer;
    text-align: left;
  }
  .noxia-topbar-command-menu > button:hover { background: rgba(42,78,122,.075); }
  .noxia-topbar-command-menu .ico { font-size: 16px; text-align: center; }
  .noxia-topbar-command-menu .copy b {
    display: block;
    font: 750 11px/1.2 system-ui,sans-serif;
  }
  .noxia-topbar-command-menu .copy small {
    display: block;
    margin-top: 3px;
    color: #748189;
    font: 500 9px/1.25 system-ui,sans-serif;
  }
  .noxia-topbar-command-menu em {
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #d84f4f;
    color: #fff;
    font: 800 9px/1 system-ui,sans-serif;
    font-style: normal;
  }
  @media (max-width: 980px) {
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:first-child { display: none; }
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:last-child { font-size: .75rem !important; }
    .noxia-topbar-command-trigger > b { display: none; }
    .noxia-topbar-command-trigger { width: 34px; padding: 0; justify-content: center; }
    .noxia-topbar-command-trigger > i { position: absolute; right: -4px; top: -3px; }
  }
  @media (max-width: 720px) {
    .noxia-topbar-managed .noxia-topbar-stat-primary:first-of-type { display: none !important; }
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:last-child { max-width: 135px; }
    .noxia-topbar-command-menu { position: fixed; right: 8px; top: 58px; width: min(248px, calc(100vw - 16px)); }
  }
`
