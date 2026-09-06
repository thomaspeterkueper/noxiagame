'use client'

import React, { useEffect, useState } from 'react'

type CockpitPanel = 'locations' | 'ship' | 'profile' | 'feed'
type Targets = Partial<Record<CockpitPanel, HTMLElement>> & {
  isometric?: HTMLButtonElement
  siteToggle?: HTMLButtonElement
}

function findTargets(): Targets {
  const byHud = (id: string) => document.querySelector<HTMLElement>(`[data-hud-window="${id}"]`) ?? undefined
  const locations = document.querySelector<HTMLElement>('[data-noxia-role="location-dock"]') ?? undefined
  const isometric = document.querySelector<HTMLButtonElement>('.noxia-open-isometric') ?? undefined
  const siteToggle = Array.from(document.querySelectorAll<HTMLButtonElement>('.earth-actions button'))
    .find(button => (button.textContent ?? '').toLocaleLowerCase('de-DE').includes('standorte'))

  return {
    locations,
    ship: byHud('ship'),
    profile: byHud('profile'),
    feed: byHud('feed'),
    isometric,
    siteToggle,
  }
}

function sameTargets(a: Targets, b: Targets) {
  return a.locations === b.locations && a.ship === b.ship && a.profile === b.profile &&
    a.feed === b.feed && a.isometric === b.isometric && a.siteToggle === b.siteToggle
}

const PANEL_META: Record<CockpitPanel, { icon: string; label: string }> = {
  locations: { icon: '⌖', label: 'Orte' },
  ship: { icon: '◇', label: 'Schiff' },
  profile: { icon: '◉', label: 'Profil' },
  feed: { icon: '≡', label: 'Feed' },
}

export default function DashboardCockpit() {
  const [targets, setTargets] = useState<Targets>({})
  const [active, setActive] = useState<CockpitPanel | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('noxia-dashboard-active')
    document.body.classList.add('noxia-dashboard-active')
    return () => {
      document.documentElement.classList.remove('noxia-dashboard-active')
      document.body.classList.remove('noxia-dashboard-active')
    }
  }, [])

  useEffect(() => {
    const discover = () => {
      const next = findTargets()
      setTargets(current => sameTargets(current, next) ? current : next)
    }
    discover()
    const observer = new MutationObserver(discover)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const ids: CockpitPanel[] = ['locations', 'ship', 'profile', 'feed']
    for (const id of ids) {
      const target = targets[id]
      if (!target) continue
      target.classList.add('noxia-cockpit-panel')
      target.classList.toggle('noxia-cockpit-panel-active', active === id)
    }
  }, [active, targets])

  function toggle(panel: CockpitPanel) {
    setActive(current => current === panel ? null : panel)
  }

  return <>
    <style>{cockpitStyles}</style>
    <nav className="noxia-cockpit" aria-label="NOXIA Cockpit">
      <div className="noxia-cockpit-brand" aria-hidden="true">
        <span>NOXIA</span><b>2086</b>
      </div>
      <button
        type="button"
        className={active == null ? 'active' : ''}
        onClick={() => setActive(null)}
        title="Karte vollständig anzeigen"
      >
        <span className="ico">▦</span><small>Karte</small>
      </button>
      {(Object.keys(PANEL_META) as CockpitPanel[]).map(id => {
        if (!targets[id]) return null
        const meta = PANEL_META[id]
        return <button
          key={id}
          type="button"
          className={active === id ? 'active' : ''}
          aria-pressed={active === id}
          onClick={() => toggle(id)}
        >
          <span className="ico">{meta.icon}</span><small>{meta.label}</small>
        </button>
      })}
      {targets.siteToggle && <button type="button" onClick={() => targets.siteToggle?.click()} title="Kartenstandorte ein-/ausblenden">
        <span className="ico">⊹</span><small>Standorte</small>
      </button>}
      {targets.isometric && <button type="button" className="primary" onClick={() => targets.isometric?.click()} title="Ansicht wechseln">
        <span className="ico">◇</span><small>Ansicht</small>
      </button>}
    </nav>
  </>
}

const cockpitStyles = `
  html.noxia-dashboard-active,
  body.noxia-dashboard-active {
    width: 100%;
    height: 100%;
    overflow: hidden !important;
    overscroll-behavior: none;
  }

  .noxia-cockpit {
    position: fixed;
    z-index: 2300;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    height: 54px;
    display: flex;
    align-items: stretch;
    gap: 3px;
    padding: 5px;
    box-sizing: border-box;
    border: 1px solid rgba(80,126,154,.48);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(8,24,37,.96), rgba(5,15,25,.96));
    box-shadow: 0 14px 42px rgba(0,0,0,.38), inset 0 1px rgba(174,222,244,.06);
    backdrop-filter: blur(14px);
    color: #bcd6e3;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    pointer-events: auto;
  }
  .noxia-cockpit-brand {
    min-width: 68px;
    padding: 0 10px 0 7px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-right: 1px solid rgba(101,146,171,.25);
    margin-right: 2px;
  }
  .noxia-cockpit-brand span {
    color: #d7b96e;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .18em;
  }
  .noxia-cockpit-brand b {
    margin-top: 3px;
    color: #607f91;
    font-size: 8px;
    letter-spacing: .12em;
  }
  .noxia-cockpit > button {
    min-width: 58px;
    height: 44px;
    padding: 4px 8px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #86a9bb;
    cursor: pointer;
    font: inherit;
  }
  .noxia-cockpit > button:hover {
    color: #d9edf5;
    border-color: rgba(81,142,178,.38);
    background: rgba(33,89,119,.18);
  }
  .noxia-cockpit > button.active {
    color: #e9f7fb;
    border-color: rgba(83,181,225,.58);
    background: linear-gradient(180deg, rgba(28,106,143,.32), rgba(19,64,89,.28));
    box-shadow: inset 0 -2px #4fc4f0;
  }
  .noxia-cockpit > button.primary {
    color: #f0d487;
    border-color: rgba(201,169,97,.32);
    background: rgba(159,119,35,.12);
  }
  .noxia-cockpit .ico { font-size: 17px; line-height: 16px; }
  .noxia-cockpit small {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  /* Existing HUD content becomes on-demand cockpit drawers. The map remains
     untouched underneath and receives input everywhere outside the drawer. */
  .noxia-cockpit-panel {
    display: none !important;
  }
  .noxia-cockpit-panel.noxia-cockpit-panel-active {
    display: flex !important;
    position: fixed !important;
    z-index: 2250 !important;
    left: 50% !important;
    right: auto !important;
    top: auto !important;
    bottom: 72px !important;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 24px)) !important;
    max-width: 560px !important;
    min-width: 0 !important;
    max-height: min(46vh, 430px) !important;
    overflow: auto !important;
    border: 1px solid rgba(91,141,169,.55) !important;
    border-radius: 10px !important;
    background: rgba(244,247,246,.96) !important;
    box-shadow: 0 20px 60px rgba(0,0,0,.34) !important;
    backdrop-filter: blur(16px);
    pointer-events: auto !important;
  }
  .noxia-cockpit-panel.noxia-cockpit-panel-active.noxia-hud-collapsed {
    min-height: initial !important;
    max-height: min(46vh, 430px) !important;
  }
  .noxia-cockpit-panel.noxia-cockpit-panel-active > .noxia-hud-windowbar {
    display: none !important;
  }
  .noxia-cockpit-panel.noxia-cockpit-panel-active.noxia-hud-collapsed > *:not(.noxia-hud-windowbar) {
    display: block !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active {
    width: min(780px, calc(100vw - 24px)) !important;
    max-width: 780px !important;
    padding: .55rem !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active > div:last-child {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active .noxia-location-dock-toolbar {
    display: none !important;
  }

  @media (max-width: 760px) {
    .noxia-cockpit {
      left: 6px;
      right: 6px;
      bottom: 6px;
      transform: none;
      justify-content: center;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .noxia-cockpit::-webkit-scrollbar { display: none; }
    .noxia-cockpit-brand { display: none; }
    .noxia-cockpit > button { min-width: 50px; padding-left: 6px; padding-right: 6px; }
    .noxia-cockpit-panel.noxia-cockpit-panel-active {
      bottom: 68px !important;
      width: calc(100vw - 12px) !important;
      max-width: none !important;
      max-height: 54vh !important;
    }
  }
`
