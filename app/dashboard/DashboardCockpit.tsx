'use client'

import React, { useEffect, useState } from 'react'

type CockpitPanel = 'locations' | 'ship' | 'profile'
type LegalLink = { label: string; href: string }
type Targets = Partial<Record<CockpitPanel, HTMLElement>> & {
  feed?: HTMLElement
  isometric?: HTMLButtonElement
  siteToggle?: HTMLButtonElement
}

const FEED_STORAGE_KEY = 'noxia:cockpit-feed:v1'

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

function readLegalLinks(): LegalLink[] {
  const footer = document.querySelector<HTMLElement>('.noxia-dashboard-shell > div:first-of-type > footer')
  if (!footer) {
    return [
      { label: 'Impressum', href: '/impressum' },
      { label: 'Datenschutz', href: '/datenschutz' },
      { label: 'Nutzungsbedingungen', href: '/nutzungsbedingungen' },
    ]
  }
  return Array.from(footer.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map(link => ({ label: (link.textContent ?? '').trim(), href: link.getAttribute('href') ?? '' }))
    .filter(link => link.label && link.href)
}

function readAttribution() {
  const earth = document.querySelector<HTMLElement>('.earth-foot')
  return (earth?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const PANEL_META: Record<CockpitPanel, { icon: string; label: string }> = {
  locations: { icon: '⌖', label: 'Orte' },
  ship: { icon: '◇', label: 'Schiff' },
  profile: { icon: '◉', label: 'Profil' },
}

export default function DashboardCockpit() {
  const [targets, setTargets] = useState<Targets>({})
  const [active, setActive] = useState<CockpitPanel | null>(null)
  const [feedVisible, setFeedVisible] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [legalLinks, setLegalLinks] = useState<LegalLink[]>([])
  const [attribution, setAttribution] = useState('')

  useEffect(() => {
    document.documentElement.classList.add('noxia-dashboard-active')
    document.body.classList.add('noxia-dashboard-active')
    try {
      setFeedVisible(window.localStorage.getItem(FEED_STORAGE_KEY) === '1')
    } catch {}
    return () => {
      document.documentElement.classList.remove('noxia-dashboard-active')
      document.body.classList.remove('noxia-dashboard-active')
    }
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(FEED_STORAGE_KEY, feedVisible ? '1' : '0') } catch {}
  }, [feedVisible])

  useEffect(() => {
    const discover = () => {
      const next = findTargets()
      setTargets(current => sameTargets(current, next) ? current : next)

      const nextLinks = readLegalLinks()
      setLegalLinks(current => JSON.stringify(current) === JSON.stringify(nextLinks) ? current : nextLinks)

      const nextAttribution = readAttribution()
      setAttribution(current => current === nextAttribution ? current : nextAttribution)
    }
    discover()
    const observer = new MutationObserver(discover)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const ids: CockpitPanel[] = ['locations', 'ship', 'profile']
    for (const id of ids) {
      const target = targets[id]
      if (!target) continue
      target.classList.add('noxia-cockpit-panel')
      target.classList.toggle('noxia-cockpit-panel-active', active === id)
    }
  }, [active, targets])

  useEffect(() => {
    const feed = targets.feed
    if (!feed) return
    feed.classList.add('noxia-feed-overlay')
    feed.classList.toggle('noxia-feed-overlay-active', feedVisible)
  }, [feedVisible, targets.feed])

  function toggle(panel: CockpitPanel) {
    setInfoOpen(false)
    setActive(current => current === panel ? null : panel)
  }

  function showMap() {
    setActive(null)
    setInfoOpen(false)
  }

  return <>
    <style>{cockpitStyles}</style>

    {infoOpen && <aside className="noxia-info-panel" aria-label="NOXIA Informationen und Rechtliches">
      <div className="noxia-info-head">
        <div><small>NOXIA</small><strong>Informationen</strong></div>
        <button type="button" onClick={() => setInfoOpen(false)} aria-label="Informationen schließen">×</button>
      </div>
      <div className="noxia-info-copy">© 2026 Thomas Peter Küper · noχ¹ᐃ Alpha</div>
      <nav aria-label="Rechtliche Informationen">
        {legalLinks.map(link => <a key={`${link.href}-${link.label}`} href={link.href}>{link.label}</a>)}
      </nav>
      {attribution && <div className="noxia-info-attribution"><b>Karte & Daten</b><span>{attribution}</span></div>}
    </aside>}

    <nav className="noxia-cockpit" aria-label="NOXIA Cockpit">
      <div className="noxia-cockpit-brand" aria-hidden="true">
        <span>NOXIA</span><b>2086</b>
      </div>
      <button
        type="button"
        className={active == null && !infoOpen ? 'active' : ''}
        onClick={showMap}
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
      {targets.feed && <button
        type="button"
        className={`toggle${feedVisible ? ' active' : ''}`}
        aria-pressed={feedVisible}
        onClick={() => setFeedVisible(value => !value)}
        title={feedVisible ? 'Feed ausblenden' : 'Feed über der Karte einblenden'}
      >
        <span className="ico">≡</span><small>Feed</small>
      </button>}
      {targets.siteToggle && <button type="button" className="toggle" onClick={() => targets.siteToggle?.click()} title="Kartenstandorte ein-/ausblenden">
        <span className="ico">⊹</span><small>Standorte</small>
      </button>}
      {targets.isometric && <button type="button" className="primary" onClick={() => targets.isometric?.click()} title="Ansicht wechseln">
        <span className="ico">◇</span><small>Ansicht</small>
      </button>}
      <button
        type="button"
        className={infoOpen ? 'active' : ''}
        aria-pressed={infoOpen}
        onClick={() => { setActive(null); setInfoOpen(value => !value) }}
        title="Informationen, Rechtliches und Datenquellen"
      >
        <span className="ico">ⓘ</span><small>Info</small>
      </button>
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
    background: linear-gradient(180deg, rgba(8,24,37,.94), rgba(5,15,25,.94));
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
  .noxia-cockpit > button.toggle.active {
    color: #c9eef9;
    border-color: rgba(86,198,228,.54);
    background: rgba(31,117,145,.25);
    box-shadow: inset 0 -2px #56c6e4;
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

  /* Interactive cockpit drawers are intentionally translucent: they remain
     readable without visually cutting the player off from the world surface. */
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
    border: 1px solid rgba(91,141,169,.52) !important;
    border-radius: 10px !important;
    background: rgba(239,244,244,.84) !important;
    box-shadow: 0 20px 60px rgba(0,0,0,.28) !important;
    backdrop-filter: blur(18px) saturate(112%);
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
    flex-direction: column !important;
    background: rgba(239,244,244,.82) !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active > div:last-child,
  .noxia-location-dock-managed.noxia-location-dock-collapsed.noxia-cockpit-panel-active > div:not(.noxia-location-dock-toolbar):last-of-type {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
  }
  .noxia-location-dock-managed.noxia-location-dock-collapsed.noxia-cockpit-panel-active > div:first-child {
    margin: 0 0 .28rem .15rem !important;
    padding-right: 0 !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active .noxia-location-dock-toolbar {
    display: none !important;
  }

  /* Feed is telemetry, not a window. It is an optional right-side text stream
     with no pointer interception and no white card chrome. */
  .noxia-feed-overlay {
    display: none !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active {
    display: flex !important;
    position: fixed !important;
    z-index: 2180 !important;
    top: 66px !important;
    right: 16px !important;
    left: auto !important;
    bottom: auto !important;
    width: min(390px, 34vw) !important;
    min-width: 270px !important;
    max-width: 390px !important;
    min-height: 0 !important;
    max-height: 42vh !important;
    padding: 14px 14px 14px 46px !important;
    overflow: hidden !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: linear-gradient(90deg, rgba(6,17,27,0), rgba(6,17,27,.58)) !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
    color: #e8f4f7 !important;
    text-shadow: 0 1px 2px rgba(0,0,0,.72);
  }
  .noxia-feed-overlay.noxia-feed-overlay-active.noxia-hud-collapsed {
    min-height: 0 !important;
    max-height: 42vh !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active > .noxia-hud-windowbar,
  .noxia-feed-overlay.noxia-feed-overlay-active > div:not(.noxia-hud-windowbar):first-of-type {
    display: none !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active.noxia-hud-collapsed > *:not(.noxia-hud-windowbar) {
    display: block !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active > div:last-child {
    margin-top: 0 !important;
    gap: 8px !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active > div:last-child > div {
    color: #edf6f8 !important;
    border-bottom-color: rgba(210,234,242,.18) !important;
    font-size: .74rem !important;
    line-height: 1.35 !important;
  }

  .noxia-info-panel {
    position: fixed;
    z-index: 2260;
    left: 50%;
    bottom: 72px;
    transform: translateX(-50%);
    width: min(470px, calc(100vw - 24px));
    padding: 14px 16px;
    box-sizing: border-box;
    border: 1px solid rgba(89,141,169,.54);
    border-radius: 10px;
    background: rgba(10,25,36,.88);
    box-shadow: 0 18px 54px rgba(0,0,0,.34);
    backdrop-filter: blur(18px);
    color: #c9dce5;
    font: 500 11px/1.45 system-ui, sans-serif;
  }
  .noxia-info-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 9px;
    border-bottom: 1px solid rgba(111,154,177,.22);
  }
  .noxia-info-head small {
    display: block;
    color: #c9a961;
    font: 800 8px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: .17em;
  }
  .noxia-info-head strong {
    display: block;
    margin-top: 4px;
    color: #edf7fa;
    font-size: 13px;
  }
  .noxia-info-head button {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(109,153,177,.28);
    border-radius: 6px;
    background: rgba(255,255,255,.04);
    color: #adc8d5;
    cursor: pointer;
    font-size: 18px;
  }
  .noxia-info-copy { margin: 10px 0 8px; color: #89a6b4; font-size: 10px; }
  .noxia-info-panel nav { display: flex; flex-wrap: wrap; gap: 7px; }
  .noxia-info-panel nav a {
    padding: 5px 8px;
    border: 1px solid rgba(105,151,176,.25);
    border-radius: 6px;
    color: #c8e0ea;
    text-decoration: none;
    background: rgba(255,255,255,.035);
  }
  .noxia-info-panel nav a:hover { border-color: rgba(201,169,97,.55); color: #f0d487; }
  .noxia-info-attribution {
    display: grid;
    gap: 4px;
    margin-top: 11px;
    padding-top: 9px;
    border-top: 1px solid rgba(111,154,177,.18);
    color: #829eab;
    font-size: 9px;
  }
  .noxia-info-attribution b { color: #a9c3cf; text-transform: uppercase; letter-spacing: .1em; }

  @media (max-width: 760px) {
    .noxia-cockpit {
      left: 6px;
      right: 6px;
      bottom: 6px;
      transform: none;
      justify-content: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .noxia-cockpit::-webkit-scrollbar { display: none; }
    .noxia-cockpit-brand { display: none; }
    .noxia-cockpit > button { min-width: 50px; padding-left: 6px; padding-right: 6px; }
    .noxia-cockpit-panel.noxia-cockpit-panel-active,
    .noxia-info-panel {
      bottom: 68px !important;
      width: calc(100vw - 12px) !important;
      max-width: none !important;
      max-height: 54vh !important;
    }
    .noxia-feed-overlay.noxia-feed-overlay-active {
      top: 54px !important;
      right: 8px !important;
      width: min(330px, calc(100vw - 16px)) !important;
      min-width: 0 !important;
      padding-right: 8px !important;
    }
  }
`
