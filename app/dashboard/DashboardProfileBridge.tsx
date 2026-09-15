'use client'

import { useEffect } from 'react'

function findFullProfileButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.noxia-dashboard-shell button'))
    .find(button => Boolean(button.querySelector('img[src*="/images/avatars/"]')))
}

export default function DashboardProfileBridge() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null
      const cockpitButton = element?.closest<HTMLButtonElement>('.noxia-cockpit button')
      if (!cockpitButton) return
      if ((cockpitButton.textContent ?? '').trim().toLocaleLowerCase('de-DE') !== '◉profil' &&
          !(cockpitButton.textContent ?? '').toLocaleLowerCase('de-DE').includes('profil')) return

      const profileButton = findFullProfileButton()
      if (!profileButton || profileButton === cockpitButton) return

      event.preventDefault()
      event.stopImmediatePropagation()
      profileButton.click()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
