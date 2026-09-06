'use client'

import React, { useEffect } from 'react'

type ActionId = 'briefing' | 'found' | 'friends' | 'logout'

function findButtonByText(root: ParentNode, value: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => (button.textContent ?? '').toLocaleLowerCase('de-DE').includes(value))
}

function discoverTopbar() {
  const header = document.querySelector<HTMLElement>('.noxia-dashboard-shell > div > header')
  if (!header) return

  header.classList.add('noxia-topbar-managed')
  const groups = Array.from(header.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  const left = groups[0] ?? null
  const right = groups[groups.length - 1] ?? null
  if (left) left.classList.add('noxia-topbar-brand')
  if (right) right.classList.add('noxia-topbar-status')

  const actions: Record<ActionId, HTMLButtonElement | undefined> = {
    briefing: findButtonByText(header, 'einweisung'),
    found: findButtonByText(header, 'gründen'),
    friends: findButtonByText(header, 'freunde'),
    logout: findButtonByText(header, 'abmelden'),
  }

  for (const [id, button] of Object.entries(actions) as [ActionId, HTMLButtonElement | undefined][]) {
    if (!button) continue
    button.classList.add('noxia-topbar-proxied-action')
    button.dataset.noxiaAction = id
  }

  if (right) {
    const direct = Array.from(right.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
    for (const element of direct) {
      if (element.tagName !== 'DIV') continue
      const text = (element.textContent ?? '').toLocaleLowerCase('de-DE')
      element.classList.toggle('noxia-topbar-stat-hidden', text.includes('frachter') || text.includes('bevölkerung'))
      element.classList.toggle('noxia-topbar-stat-primary', text.includes('credits') || text.includes('standort'))
    }
  }
}

export default function DashboardTopbarManager() {
  useEffect(() => {
    discoverTopbar()
    const observer = new MutationObserver(discoverTopbar)
    observer.observe(document.body, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <style>{baseStyles}</style>
}

const baseStyles = `
  .noxia-topbar-managed { isolation: isolate; }

  /* The header is status only. Command actions remain mounted as hidden proxy
     targets so the bottom cockpit can invoke their existing application logic. */
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

  @media (max-width: 980px) {
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:first-child { display: none; }
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:last-child { font-size: .75rem !important; }
  }
  @media (max-width: 720px) {
    .noxia-topbar-managed .noxia-topbar-stat-primary:first-of-type { display: none !important; }
    .noxia-topbar-managed .noxia-topbar-stat-primary > div:last-child { max-width: 135px; }
  }
`
