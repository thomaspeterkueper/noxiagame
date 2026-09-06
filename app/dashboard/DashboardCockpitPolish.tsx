'use client'

import { useEffect } from 'react'

function decorateLegacyCockpitContent() {
  const profile = document.querySelector<HTMLElement>('[data-hud-window="profile"]')
  if (profile) {
    const blocks = Array.from(profile.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains('noxia-hud-windowbar'))

    const summary = blocks.find(block => Boolean(block.querySelector('img')))
    const hint = blocks.find(block => (block.textContent ?? '').toLocaleLowerCase('de-DE').includes('vollprofil'))
    const competencies = blocks.find(block => block !== summary && block !== hint && block.children.length >= 3)

    summary?.classList.add('noxia-profile-summary')
    hint?.classList.add('noxia-profile-hint')
    competencies?.classList.add('noxia-profile-competencies')

    if (summary) {
      const children = Array.from(summary.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
      children[0]?.classList.add('noxia-profile-avatar')
      children[1]?.classList.add('noxia-profile-identity')
      children[2]?.classList.add('noxia-profile-open')
    }

    if (competencies) {
      for (const row of Array.from(competencies.children)) {
        if (!(row instanceof HTMLElement)) continue
        row.classList.add('noxia-profile-competency')
        const parts = Array.from(row.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
        parts[0]?.classList.add('noxia-profile-competency-icon')
        parts[1]?.classList.add('noxia-profile-competency-track')
      }
    }
  }

  const locationRow = document.querySelector<HTMLElement>('.noxia-location-dock-managed .noxia-location-dock-cards')
  if (locationRow) {
    for (const node of Array.from(locationRow.children)) {
      if (!(node instanceof HTMLElement)) continue
      node.classList.add('noxia-location-card')
      node.classList.toggle('noxia-location-card-current', (node.textContent ?? '').toLocaleUpperCase('de-DE').includes('HIER'))
    }
  }
}

/**
 * Visual-only cockpit polish.
 * Keeps legacy panel data and behaviour intact while translating those cards
 * into the dark NOXIA cockpit language. Map/terrain renderer code is not
 * touched here.
 */
export default function DashboardCockpitPolish() {
  useEffect(() => {
    const decorate = () => decorateLegacyCockpitContent()
    decorate()
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <style>{`
    .noxia-cockpit-panel.noxia-cockpit-panel-active {
      border: 1px solid rgba(76, 170, 207, .42) !important;
      background: rgba(6, 18, 28, .88) !important;
      box-shadow: 0 22px 64px rgba(0, 0, 0, .38), inset 0 1px rgba(174, 226, 244, .05) !important;
      backdrop-filter: blur(18px) saturate(112%) !important;
      -webkit-backdrop-filter: blur(18px) saturate(112%) !important;
      color: #d8e8ee !important;
    }

    /* Legacy cards still carry light-theme inline text colors. The cockpit
       surface owns readability while the underlying content model remains
       unchanged. */
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="color"] {
      color: #c7dbe4 !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-weight: 700"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-weight:700"] {
      color: #eef8fb !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.58rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.58rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.6rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.6rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.62rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.62rem"] {
      color: #9eb8c5 !important;
    }

    /* Profile: the old sidebar card is retained as data source/content, but
       visually becomes a compact cockpit instrument rather than a pale card. */
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] {
      width: min(500px, calc(100vw - 24px)) !important;
      max-width: 500px !important;
      padding: 16px 18px 14px !important;
      overflow: hidden !important;
    }
    .noxia-profile-summary {
      display: grid !important;
      grid-template-columns: 52px minmax(0, 1fr) 22px !important;
      align-items: center !important;
      gap: 12px !important;
      margin: 0 0 14px !important;
      padding-bottom: 12px !important;
      border-bottom: 1px solid rgba(113, 165, 188, .18) !important;
    }
    .noxia-profile-avatar {
      width: 52px !important;
      height: 52px !important;
      border: 2px solid rgba(218, 181, 90, .86) !important;
      box-shadow: 0 0 0 3px rgba(218, 181, 90, .08) !important;
    }
    .noxia-profile-identity {
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      gap: 4px !important;
    }
    .noxia-profile-identity > div:first-child {
      color: #f2f9fb !important;
      font-size: 1.02rem !important;
      line-height: 1.15 !important;
      letter-spacing: .01em !important;
    }
    .noxia-profile-identity > div:nth-child(2) {
      color: #a8c1cc !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .73rem !important;
      line-height: 1.35 !important;
    }
    .noxia-profile-open {
      color: #62c9ed !important;
      font-size: .9rem !important;
      text-align: right !important;
      opacity: .82 !important;
    }
    .noxia-profile-competencies {
      display: grid !important;
      gap: 10px !important;
      margin: 0 !important;
    }
    .noxia-profile-competency {
      display: grid !important;
      grid-template-columns: 26px minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 9px !important;
      min-height: 22px !important;
    }
    .noxia-profile-competency-icon {
      width: 26px !important;
      font-size: .92rem !important;
      text-align: center !important;
      filter: saturate(.88) !important;
    }
    .noxia-profile-competency-track {
      height: 7px !important;
      border-radius: 999px !important;
      background: rgba(162, 193, 205, .14) !important;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, .28) !important;
      overflow: hidden !important;
    }
    .noxia-profile-competency-track > div {
      min-height: 7px !important;
      border-radius: 999px !important;
      box-shadow: 0 0 8px rgba(116, 201, 231, .16) !important;
    }
    .noxia-profile-hint {
      margin-top: 13px !important;
      color: #7799a8 !important;
      font-size: .61rem !important;
      font-weight: 700 !important;
      letter-spacing: .08em !important;
      text-transform: uppercase !important;
    }

    /* Locations: only the cards get a dark surface. The earlier broad
       background override also recolored badges such as HIER; that is removed. */
    .noxia-location-dock-managed.noxia-cockpit-panel-active {
      background: rgba(6, 18, 28, .89) !important;
      color: #d8e8ee !important;
      padding: 12px !important;
    }
    .noxia-location-dock-managed.noxia-cockpit-panel-active > div:first-child {
      color: #87a9b8 !important;
      font-size: .62rem !important;
      font-weight: 800 !important;
      letter-spacing: .14em !important;
      text-transform: uppercase !important;
      margin-bottom: 8px !important;
    }
    .noxia-location-dock-cards {
      gap: 8px !important;
      padding: 1px !important;
    }
    .noxia-location-card {
      box-sizing: border-box !important;
      min-width: 150px !important;
      padding: 9px 12px !important;
      border-top: 1px solid rgba(91, 143, 167, .24) !important;
      border-right: 1px solid rgba(91, 143, 167, .24) !important;
      border-bottom: 1px solid rgba(91, 143, 167, .24) !important;
      border-radius: 7px !important;
      background: rgba(12, 31, 44, .72) !important;
      box-shadow: inset 0 1px rgba(182, 224, 239, .035) !important;
      transition: background .14s ease, border-color .14s ease, transform .14s ease !important;
    }
    .noxia-location-card:hover {
      background: rgba(18, 45, 61, .88) !important;
      border-top-color: rgba(82, 190, 226, .48) !important;
      border-right-color: rgba(82, 190, 226, .48) !important;
      border-bottom-color: rgba(82, 190, 226, .48) !important;
      transform: translateY(-1px) !important;
    }
    .noxia-location-card > div:first-child {
      color: #e9f5f9 !important;
      font-size: .78rem !important;
      line-height: 1.25 !important;
    }
    .noxia-location-card > div:nth-child(2) {
      color: #87a6b4 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .65rem !important;
      margin-top: 4px !important;
    }
    .noxia-location-card-current {
      background: rgba(39, 45, 37, .82) !important;
      border-top-color: rgba(218, 181, 90, .46) !important;
      border-right-color: rgba(218, 181, 90, .46) !important;
      border-bottom-color: rgba(218, 181, 90, .46) !important;
    }
    .noxia-location-card-current span[style*="background"] {
      background: #d8b654 !important;
      color: #07131d !important;
      font-weight: 900 !important;
      letter-spacing: .05em !important;
    }

    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="ship"] button {
      border-color: rgba(81, 177, 216, .36) !important;
      background: rgba(31, 99, 128, .14) !important;
      color: #ccebf6 !important;
    }

    /* Stronger selected state, inspired by strategy HUDs without turning the
       cockpit into a neon dashboard. */
    .noxia-cockpit > button.active,
    .noxia-cockpit > button.toggle.active {
      border-color: rgba(73, 207, 245, .72) !important;
      box-shadow: inset 0 -2px #4fd5f5, 0 0 14px rgba(58, 190, 229, .12) !important;
    }
    .noxia-cockpit > button.primary {
      border-color: rgba(222, 186, 89, .50) !important;
      box-shadow: inset 0 -2px rgba(226, 190, 83, .72) !important;
    }

    .noxia-cockpit-utility {
      background: rgba(6, 18, 28, .90) !important;
      border-color: rgba(76, 170, 207, .40) !important;
      backdrop-filter: blur(18px) saturate(112%) !important;
      -webkit-backdrop-filter: blur(18px) saturate(112%) !important;
    }

    @media (max-width: 700px) {
      .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] {
        padding: 13px 14px 12px !important;
      }
      .noxia-profile-summary { grid-template-columns: 46px minmax(0, 1fr) 18px !important; gap: 10px !important; }
      .noxia-profile-avatar { width: 46px !important; height: 46px !important; }
      .noxia-location-card { min-width: 138px !important; }
    }
  `}</style>
}
