'use client'

import React, { useEffect, useState } from 'react'
import { useMusicContext } from '../_components/MusicProvider'

type CockpitPanel = 'locations' | 'ship' | 'profile'
type UtilityPanel = 'actions' | 'music' | 'info'
type ActionId = 'briefing' | 'found' | 'friends' | 'logout'
type LegalLink = { label: string; href: string }
type Targets = Partial<Record<CockpitPanel, HTMLElement>> & {
  feed?: HTMLElement
  isometric?: HTMLButtonElement
  siteToggle?: HTMLButtonElement
  actions: Partial<Record<ActionId, HTMLButtonElement>>
}

const FEED_STORAGE_KEY = 'noxia:cockpit-feed:v1'

const PANEL_META: Record<CockpitPanel, { icon: string; label: string }> = {
  locations: { icon: '⌖', label: 'Orte' },
  ship: { icon: '◇', label: 'Schiff' },
  profile: { icon: '◉', label: 'Profil' },
}

const ACTION_META: Record<ActionId, { icon: string; label: string; description: string }> = {
  briefing: { icon: '☰', label: 'Einweisung', description: 'Aufgaben und Orientierung' },
  found: { icon: '🚀', label: 'Gründen', description: 'Neuen Standort gründen' },
  friends: { icon: '💬', label: 'Freunde', description: 'Kontakte und Nachrichten' },
  logout: { icon: '↪', label: 'Abmelden', description: 'Sitzung beenden' },
}

function findButtonByText(root: ParentNode, value: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => (button.textContent ?? '').toLocaleLowerCase('de-DE').includes(value))
}

function findAction(id: ActionId, fallback: string): HTMLButtonElement | undefined {
  return document.querySelector<HTMLButtonElement>(`button[data-noxia-action="${id}"]`) ??
    findButtonByText(document.querySelector('.noxia-dashboard-shell') ?? document, fallback)
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
    actions: {
      briefing: findAction('briefing', 'einweisung'),
      found: findAction('found', 'gründen'),
      friends: findAction('friends', 'freunde'),
      logout: findAction('logout', 'abmelden'),
    },
  }
}

function sameTargets(a: Targets, b: Targets) {
  return a.locations === b.locations && a.ship === b.ship && a.profile === b.profile &&
    a.feed === b.feed && a.isometric === b.isometric && a.siteToggle === b.siteToggle &&
    a.actions.briefing === b.actions.briefing && a.actions.found === b.actions.found &&
    a.actions.friends === b.actions.friends && a.actions.logout === b.actions.logout
}

function parseFriendBadge(button?: HTMLButtonElement) {
  const text = button?.textContent ?? ''
  const match = text.match(/\b(\d+\+?)\b/)
  return match?.[1] ?? null
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

export default function DashboardCockpit() {
  const { playing, volume, toggle: toggleMusic, setVolume } = useMusicContext()
  const [targets, setTargets] = useState<Targets>({ actions: {} })
  const [active, setActive] = useState<CockpitPanel | null>(null)
  const [utilityOpen, setUtilityOpen] = useState<UtilityPanel | null>(null)
  const [feedVisible, setFeedVisible] = useState(false)
  const [friendBadge, setFriendBadge] = useState<string | null>(null)
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
      const nextBadge = parseFriendBadge(next.actions.friends)
      setFriendBadge(current => current === nextBadge ? current : nextBadge)

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActive(null)
        setUtilityOpen(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function togglePanel(panel: CockpitPanel) {
    setUtilityOpen(null)
    setActive(current => current === panel ? null : panel)
  }

  function toggleUtility(panel: UtilityPanel) {
    setActive(null)
    setUtilityOpen(current => current === panel ? null : panel)
  }

  function showMap() {
    setActive(null)
    setUtilityOpen(null)
  }

  function invokeAction(id: ActionId) {
    setUtilityOpen(null)
    targets.actions[id]?.click()
  }

  const hasActions = (Object.keys(ACTION_META) as ActionId[]).some(id => Boolean(targets.actions[id]))

  return <>
    <style>{cockpitStyles}</style>

    {utilityOpen === 'actions' && <aside className="noxia-cockpit-utility noxia-actions-panel" aria-label="NOXIA Aktionen">
      <div className="noxia-utility-head"><div><small>NOXIA</small><strong>Aktionen</strong></div><button type="button" onClick={() => setUtilityOpen(null)} aria-label="Aktionen schließen">×</button></div>
      <div className="noxia-actions-grid">
        {(Object.keys(ACTION_META) as ActionId[]).map(id => {
          if (!targets.actions[id]) return null
          const item = ACTION_META[id]
          return <button key={id} type="button" onClick={() => invokeAction(id)}>
            <span className="ico">{item.icon}</span>
            <span><b>{item.label}</b><small>{item.description}</small></span>
            {id === 'friends' && friendBadge && <em>{friendBadge}</em>}
          </button>
        })}
      </div>
    </aside>}

    {utilityOpen === 'music' && <aside className="noxia-cockpit-utility noxia-music-panel" aria-label="NOXIA Musiksteuerung">
      <div className="noxia-utility-head"><div><small>NOXIA AUDIO</small><strong>Musik</strong></div><button type="button" onClick={() => setUtilityOpen(null)} aria-label="Musiksteuerung schließen">×</button></div>
      <div className="noxia-music-row">
        <button type="button" className={`noxia-music-toggle${playing ? ' active' : ''}`} onClick={toggleMusic} aria-pressed={playing}>
          <span>{playing ? '⏸' : '▶'}</span><b>{playing ? 'Pause' : 'Abspielen'}</b>
        </button>
        <label><span>Lautstärke</span><input type="range" min={0} max={1} step={0.05} value={volume} onChange={event => setVolume(Number(event.target.value))} /><b>{Math.round(volume * 100)}%</b></label>
      </div>
    </aside>}

    {utilityOpen === 'info' && <aside className="noxia-cockpit-utility noxia-info-panel" aria-label="NOXIA Informationen und Rechtliches">
      <div className="noxia-utility-head"><div><small>NOXIA</small><strong>Informationen</strong></div><button type="button" onClick={() => setUtilityOpen(null)} aria-label="Informationen schließen">×</button></div>
      <div className="noxia-info-copy">© 2026 Thomas Peter Küper · noχ¹ᐃ Alpha</div>
      <nav aria-label="Rechtliche Informationen">
        {legalLinks.map(link => <a key={`${link.href}-${link.label}`} href={link.href}>{link.label}</a>)}
      </nav>
      {attribution && <div className="noxia-info-attribution"><b>Karte & Daten</b><span>{attribution}</span></div>}
    </aside>}

    <nav className="noxia-cockpit" aria-label="NOXIA Cockpit">
      <div className="noxia-cockpit-brand" aria-hidden="true"><span>NOXIA</span><b>2086</b></div>

      <button type="button" className={active == null && utilityOpen == null ? 'active' : ''} onClick={showMap} title="Karte vollständig anzeigen">
        <span className="ico">▦</span><small>Karte</small>
      </button>

      {(Object.keys(PANEL_META) as CockpitPanel[]).map(id => {
        if (!targets[id]) return null
        const meta = PANEL_META[id]
        return <button key={id} type="button" className={active === id ? 'active' : ''} aria-pressed={active === id} onClick={() => togglePanel(id)}>
          <span className="ico">{meta.icon}</span><small>{meta.label}</small>
        </button>
      })}

      {targets.feed && <button type="button" className={`toggle${feedVisible ? ' active' : ''}`} aria-pressed={feedVisible} onClick={() => setFeedVisible(value => !value)} title={feedVisible ? 'Feed ausblenden' : 'Feed über der Karte einblenden'}>
        <span className="ico">≡</span><small>Feed</small>
      </button>}

      {targets.siteToggle && <button type="button" className="toggle" onClick={() => targets.siteToggle?.click()} title="Kartenstandorte ein-/ausblenden">
        <span className="ico">⊹</span><small>Standorte</small>
      </button>}

      {targets.isometric && <button type="button" className="primary" onClick={() => targets.isometric?.click()} title="Ansicht wechseln">
        <span className="ico">◇</span><small>Ansicht</small>
      </button>}

      {hasActions && <button type="button" className={utilityOpen === 'actions' ? 'active' : ''} aria-pressed={utilityOpen === 'actions'} onClick={() => toggleUtility('actions')} title="Einweisung, Gründen, Freunde und Abmelden">
        <span className="ico">⋯</span><small>Aktionen</small>{friendBadge && <i className="noxia-cockpit-badge">{friendBadge}</i>}
      </button>}

      <button type="button" className={utilityOpen === 'music' || playing ? 'toggle active' : 'toggle'} aria-pressed={utilityOpen === 'music'} onClick={() => toggleUtility('music')} title="Musik und Lautstärke">
        <span className="ico">♫</span><small>Musik</small>
      </button>

      <button type="button" className={utilityOpen === 'info' ? 'active' : ''} aria-pressed={utilityOpen === 'info'} onClick={() => toggleUtility('info')} title="Informationen, Rechtliches und Datenquellen">
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

  /* Global page music chrome is replaced by the cockpit control on dashboard. */
  .noxia-dashboard-active .noxia-global-music-controls {
    display: none !important;
  }

  .noxia-cockpit {
    position: fixed;
    z-index: 2300;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    height: 54px;
    max-width: calc(100vw - 16px);
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
  .noxia-cockpit-brand span { color: #d7b96e; font-size: 9px; font-weight: 900; letter-spacing: .18em; }
  .noxia-cockpit-brand b { margin-top: 3px; color: #607f91; font-size: 8px; letter-spacing: .12em; }

  .noxia-cockpit > button {
    position: relative;
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
  .noxia-cockpit > button:hover { color: #d9edf5; border-color: rgba(81,142,178,.38); background: rgba(33,89,119,.18); }
  .noxia-cockpit > button.active { color: #e9f7fb; border-color: rgba(83,181,225,.58); background: rgba(25,83,111,.34); box-shadow: inset 0 -2px #4fc4f0; }
  .noxia-cockpit > button.toggle.active { color: #c9eef9; border-color: rgba(86,198,228,.54); background: rgba(31,117,145,.25); box-shadow: inset 0 -2px #56c6e4; }
  .noxia-cockpit > button.primary { color: #f0d487; border-color: rgba(201,169,97,.32); background: rgba(159,119,35,.12); }
  .noxia-cockpit .ico { font-size: 17px; line-height: 16px; }
  .noxia-cockpit small { font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .noxia-cockpit-badge {
    position: absolute;
    top: 2px;
    right: 3px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: #d84f4f;
    color: #fff;
    font: 800 8px/1 system-ui, sans-serif;
    font-style: normal;
  }

  .noxia-cockpit-panel { display: none !important; }
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
    border: 1px solid rgba(91,141,169,.48) !important;
    border-radius: 10px !important;
    background: rgba(239,244,244,.80) !important;
    box-shadow: 0 20px 60px rgba(0,0,0,.26) !important;
    backdrop-filter: blur(20px) saturate(108%);
    pointer-events: auto !important;
  }
  .noxia-cockpit-panel.noxia-cockpit-panel-active.noxia-hud-collapsed { min-height: initial !important; max-height: min(46vh, 430px) !important; }
  .noxia-cockpit-panel.noxia-cockpit-panel-active > .noxia-hud-windowbar { display: none !important; }
  .noxia-cockpit-panel.noxia-cockpit-panel-active.noxia-hud-collapsed > *:not(.noxia-hud-windowbar) { display: block !important; }

  .noxia-location-dock-managed.noxia-cockpit-panel-active {
    width: min(780px, calc(100vw - 24px)) !important;
    max-width: 780px !important;
    padding: .55rem !important;
    flex-direction: column !important;
    background: rgba(239,244,244,.78) !important;
  }
  .noxia-location-dock-managed.noxia-cockpit-panel-active > div:last-child,
  .noxia-location-dock-managed.noxia-location-dock-collapsed.noxia-cockpit-panel-active > div:not(.noxia-location-dock-toolbar):last-of-type {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
  }
  .noxia-location-dock-managed.noxia-location-dock-collapsed.noxia-cockpit-panel-active > div:first-child { margin: 0 0 .28rem .15rem !important; padding-right: 0 !important; }
  .noxia-location-dock-managed.noxia-cockpit-panel-active .noxia-location-dock-toolbar { display: none !important; }

  /* Feed is a passive text stream: one uniform blurred backing surface, no
     gradient, no title chrome, no separators and no pointer interception. */
  .noxia-feed-overlay { display: none !important; }
  .noxia-feed-overlay.noxia-feed-overlay-active {
    display: flex !important;
    position: fixed !important;
    z-index: 2180 !important;
    top: 62px !important;
    right: 14px !important;
    left: auto !important;
    bottom: auto !important;
    width: min(390px, 34vw) !important;
    min-width: 270px !important;
    max-width: 390px !important;
    min-height: 0 !important;
    max-height: 42vh !important;
    padding: 10px 12px !important;
    overflow: hidden !important;
    border: 0 !important;
    border-radius: 6px !important;
    background: rgba(7,17,27,.43) !important;
    box-shadow: none !important;
    backdrop-filter: blur(11px) !important;
    -webkit-backdrop-filter: blur(11px) !important;
    pointer-events: none !important;
    color: #edf6f8 !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active.noxia-hud-collapsed { min-height: 0 !important; max-height: 42vh !important; }
  .noxia-feed-overlay.noxia-feed-overlay-active > .noxia-hud-windowbar,
  .noxia-feed-overlay.noxia-feed-overlay-active > div:not(.noxia-hud-windowbar):first-of-type { display: none !important; }
  .noxia-feed-overlay.noxia-feed-overlay-active.noxia-hud-collapsed > *:not(.noxia-hud-windowbar) { display: block !important; }
  .noxia-feed-overlay.noxia-feed-overlay-active > div:last-child {
    display: flex !important;
    flex-direction: column !important;
    margin-top: 0 !important;
    gap: 5px !important;
  }
  .noxia-feed-overlay.noxia-feed-overlay-active > div:last-child > div {
    margin: 0 !important;
    padding: 2px 0 !important;
    border: 0 !important;
    background: transparent !important;
    color: #edf6f8 !important;
    font-size: .74rem !important;
    line-height: 1.4 !important;
  }

  .noxia-cockpit-utility {
    position: fixed;
    z-index: 2260;
    left: 50%;
    bottom: 72px;
    transform: translateX(-50%);
    box-sizing: border-box;
    border: 1px solid rgba(89,141,169,.48);
    border-radius: 10px;
    background: rgba(9,23,34,.88);
    box-shadow: 0 18px 54px rgba(0,0,0,.32);
    backdrop-filter: blur(18px);
    color: #c9dce5;
    font: 500 11px/1.45 system-ui, sans-serif;
    pointer-events: auto;
  }
  .noxia-utility-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px 9px;
    border-bottom: 1px solid rgba(111,154,177,.18);
  }
  .noxia-utility-head small { display: block; color: #c9a961; font: 800 8px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .17em; }
  .noxia-utility-head strong { display: block; margin-top: 4px; color: #edf7fa; font-size: 13px; }
  .noxia-utility-head > button {
    width: 28px; height: 28px; border: 1px solid rgba(109,153,177,.28); border-radius: 6px;
    background: rgba(255,255,255,.04); color: #adc8d5; cursor: pointer; font-size: 18px;
  }

  .noxia-actions-panel { width: min(460px, calc(100vw - 24px)); padding-bottom: 8px; }
  .noxia-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 7px; }
  .noxia-actions-grid > button {
    min-height: 52px;
    display: grid;
    grid-template-columns: 30px minmax(0,1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #c7dce5;
    cursor: pointer;
    text-align: left;
  }
  .noxia-actions-grid > button:hover { background: rgba(57,123,157,.16); }
  .noxia-actions-grid .ico { font-size: 17px; text-align: center; }
  .noxia-actions-grid b { display: block; font-size: 11px; }
  .noxia-actions-grid small { display: block; margin-top: 2px; color: #7896a5; font-size: 9px; }
  .noxia-actions-grid em { min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center; border-radius: 10px; background: #d84f4f; color: #fff; font: 800 9px/1 system-ui,sans-serif; font-style: normal; }

  .noxia-music-panel { width: min(360px, calc(100vw - 24px)); }
  .noxia-music-row { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 12px; padding: 12px 14px 14px; }
  .noxia-music-toggle {
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(92,143,170,.34);
    border-radius: 7px;
    background: rgba(255,255,255,.04);
    color: #abc6d3;
    cursor: pointer;
  }
  .noxia-music-toggle.active { border-color: rgba(201,169,97,.5); color: #f0d487; background: rgba(159,119,35,.12); }
  .noxia-music-row label { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 7px; color: #819dab; font-size: 9px; }
  .noxia-music-row input { width: 100%; accent-color: #c9a961; cursor: pointer; }
  .noxia-music-row label b { min-width: 30px; color: #bdd3dd; font: 700 9px/1 ui-monospace, monospace; text-align: right; }

  .noxia-info-panel { width: min(470px, calc(100vw - 24px)); padding-bottom: 14px; }
  .noxia-info-copy { margin: 10px 16px 8px; color: #89a6b4; font-size: 10px; }
  .noxia-info-panel nav { display: flex; flex-wrap: wrap; gap: 7px; padding: 0 16px; }
  .noxia-info-panel nav a { padding: 5px 8px; border: 1px solid rgba(105,151,176,.25); border-radius: 6px; color: #c8e0ea; text-decoration: none; background: rgba(255,255,255,.035); }
  .noxia-info-panel nav a:hover { border-color: rgba(201,169,97,.55); color: #f0d487; }
  .noxia-info-attribution { display: grid; gap: 4px; margin: 11px 16px 0; padding-top: 9px; border-top: 1px solid rgba(111,154,177,.18); color: #829eab; font-size: 9px; }
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
    .noxia-cockpit-utility { bottom: 68px !important; width: calc(100vw - 12px) !important; max-width: none !important; max-height: 54vh !important; }
    .noxia-actions-grid { grid-template-columns: 1fr; }
    .noxia-music-row { grid-template-columns: 1fr; }
    .noxia-feed-overlay.noxia-feed-overlay-active {
      top: 52px !important;
      right: 8px !important;
      width: min(330px, calc(100vw - 16px)) !important;
      min-width: 0 !important;
    }
  }
`
