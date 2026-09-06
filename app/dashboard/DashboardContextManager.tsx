'use client'

import { useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

function findCockpitButton(label: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.noxia-cockpit > button'))
    .find(button => button.querySelector('small')?.textContent?.trim().toLocaleLowerCase('de-DE') === label) ?? null
}

function shipInteriorVisible() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .some(button => (button.textContent ?? '').includes('Schiff verlassen'))
}

/**
 * Keeps context-sensitive cockpit entries honest without taking ownership of
 * map/terrain state. A ship is a current player context, not merely an owned
 * asset: the cockpit entry is visible while the player is inside the ship or
 * while a flight is in progress.
 *
 * This is intentionally a small bridge around the legacy dashboard markup.
 * Once player presence/context has a canonical shared store, this component
 * should consume that store instead of DOM discovery.
 */
export default function DashboardContextManager() {
  const inTransit = useGameStore(state => state.inTransit)

  useEffect(() => {
    const sync = () => {
      const inShipContext = inTransit || shipInteriorVisible()
      const shipButton = findCockpitButton('schiff')
      const shipPanel = document.querySelector<HTMLElement>('[data-hud-window="ship"]')

      if (shipButton) {
        shipButton.dataset.noxiaContextSlot = 'ship'
        shipButton.hidden = !inShipContext
        shipButton.setAttribute('aria-hidden', inShipContext ? 'false' : 'true')
        shipButton.title = inShipContext
          ? (inTransit ? 'Aktives Schiff während des Flugs' : 'Aktuelles Schiff')
          : 'Schiff ist nur im aktuellen Schiffskontext verfügbar'
      }

      if (!inShipContext && shipPanel) {
        shipPanel.classList.remove('noxia-cockpit-panel-active')
      }

      document.documentElement.dataset.noxiaPlayerContext = inShipContext ? 'ship' : 'surface'
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [inTransit])

  return null
}
