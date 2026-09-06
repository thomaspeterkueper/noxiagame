'use client'

import { useEffect } from 'react'

function decorateShipPanel() {
  const ship = document.querySelector<HTMLElement>('[data-hud-window="ship"]')
  if (!ship) return

  const blocks = Array.from(ship.children)
    .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains('noxia-hud-windowbar'))

  const header = blocks.find(block => Boolean(block.querySelector('button')) && (block.textContent ?? '').toLocaleLowerCase('de-DE').includes('an bord'))
  const capacity = blocks.find(block => (block.textContent ?? '').toLocaleLowerCase('de-DE').includes('frei'))
  const cargo = blocks.find(block => block !== header && block !== capacity)

  header?.classList.add('noxia-ship-summary')
  cargo?.classList.add('noxia-ship-cargo')
  capacity?.classList.add('noxia-ship-capacity')

  if (header) {
    const title = Array.from(header.children)
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.tagName !== 'BUTTON')
    title?.classList.add('noxia-ship-title')
    header.querySelector('button')?.classList.add('noxia-ship-enter')
  }

  if (cargo) {
    for (const row of Array.from(cargo.children)) {
      if (!(row instanceof HTMLElement)) continue
      row.classList.add('noxia-ship-cargo-row')
      const values = Array.from(row.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
      values[0]?.classList.add('noxia-ship-cargo-label')
      values[1]?.classList.add('noxia-ship-cargo-value')
    }
  }
}

/**
 * Visual-only treatment for the compact ship status panel.
 * The panel remains context-sensitive and continues to use the existing ship,
 * cargo and enter-ship behaviour. No ship/game/map state is duplicated here.
 */
export default function DashboardShipPanelPolish() {
  useEffect(() => {
    const decorate = () => decorateShipPanel()
    decorate()
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <style>{`
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="ship"] {
      width: min(440px, calc(100vw - 24px)) !important;
      max-width: 440px !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: rgba(6, 18, 28, .90) !important;
    }

    .noxia-ship-summary {
      min-height: 58px !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 14px 11px !important;
      margin: 0 !important;
      border-bottom: 1px solid rgba(105, 159, 184, .18) !important;
      background: rgba(15, 38, 52, .50) !important;
    }
    .noxia-ship-title {
      margin: 0 !important;
      color: #97b5c3 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .64rem !important;
      font-weight: 800 !important;
      line-height: 1.35 !important;
      letter-spacing: .10em !important;
      text-transform: uppercase !important;
    }
    .noxia-ship-enter {
      min-width: 84px !important;
      height: 30px !important;
      padding: 0 10px !important;
      border: 1px solid rgba(75, 192, 231, .46) !important;
      border-radius: 6px !important;
      background: rgba(34, 113, 146, .18) !important;
      color: #d2f2fb !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .65rem !important;
      font-weight: 800 !important;
      letter-spacing: .03em !important;
      cursor: pointer !important;
    }
    .noxia-ship-enter:hover {
      border-color: rgba(79, 211, 245, .72) !important;
      background: rgba(39, 137, 174, .28) !important;
      box-shadow: 0 0 14px rgba(68, 196, 232, .10) !important;
    }

    .noxia-ship-cargo {
      display: grid !important;
      gap: 2px !important;
      padding: 10px 14px 8px !important;
      margin: 0 !important;
    }
    .noxia-ship-cargo-row {
      min-height: 28px !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: center !important;
      gap: 16px !important;
      padding: 3px 5px !important;
      border: 0 !important;
      border-radius: 5px !important;
      background: transparent !important;
      color: #c6dbe4 !important;
      font-size: .75rem !important;
    }
    .noxia-ship-cargo-row:hover {
      background: rgba(79, 162, 194, .07) !important;
    }
    .noxia-ship-cargo-label {
      color: #b9d0da !important;
      min-width: 0 !important;
    }
    .noxia-ship-cargo-value {
      color: #e9f8fb !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .78rem !important;
      font-weight: 900 !important;
      text-align: right !important;
    }

    .noxia-ship-capacity {
      min-height: 35px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      margin: 0 !important;
      padding: 8px 14px 10px !important;
      border-top: 1px solid rgba(105, 159, 184, .16) !important;
      color: #789aa9 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .65rem !important;
      letter-spacing: .04em !important;
    }
    .noxia-ship-capacity > span:last-child {
      color: #bed4de !important;
      font-weight: 800 !important;
    }

    /* A contextual cockpit slot must actually disappear outside its context;
       do not rely solely on browser UA styling for the hidden attribute. */
    .noxia-cockpit > button[hidden] {
      display: none !important;
    }

    @media (max-width: 560px) {
      .noxia-ship-summary { padding: 10px 11px !important; }
      .noxia-ship-cargo { padding: 8px 11px 7px !important; }
      .noxia-ship-capacity { padding: 8px 11px 9px !important; }
      .noxia-ship-enter { min-width: 76px !important; }
    }
  `}</style>
}
