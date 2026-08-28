'use client'

import { useEffect } from 'react'

const SSF_HOSTS = new Set([
  'solarsciencefoundation.vercel.app',
  'solarsciencefoundation.org',
])

function toInGameLearningUrl(rawHref: string): string | null {
  try {
    const url = new URL(rawHref, window.location.origin)
    if (!SSF_HOSTS.has(url.hostname)) return null

    const pathId = url.searchParams.get('path')
    const moduleId = url.searchParams.get('module')

    if (pathId) return `/academy/learn?path=${encodeURIComponent(pathId)}`
    if (moduleId) return `/academy/learn?module=${encodeURIComponent(moduleId)}`

    return null
  } catch {
    return null
  }
}

export default function LearningLinkInterceptor() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const inGameUrl = toInGameLearningUrl(anchor.href)
      if (!inGameUrl) return

      event.preventDefault()
      event.stopPropagation()
      window.location.assign(inGameUrl)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
