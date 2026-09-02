'use client'

import { useEffect } from 'react'

/** Routes the Earth/Sauerland isometric action to the native React renderer.
 * The capture-phase handler deliberately runs before legacy WalkableColony/
 * transitional dashboard handlers so there is exactly one Earth isometric view.
 */
export default function SauerlandIsoLinkInterceptor() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (window.location.pathname !== '/dashboard') return
      const target = event.target as HTMLElement | null
      const trigger = target?.closest('button,a,[role="button"]') as HTMLElement | null
      if (!trigger) return
      const text = `${trigger.textContent ?? ''} ${trigger.getAttribute('title') ?? ''} ${trigger.getAttribute('aria-label') ?? ''}`.toLowerCase()
      if (!text.includes('isometr')) return
      const pageText = document.body.textContent?.toLowerCase() ?? ''
      if (!pageText.includes('sauerland') && !pageText.includes('erde')) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      window.location.assign('/dashboard/sauerland-isometric')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
