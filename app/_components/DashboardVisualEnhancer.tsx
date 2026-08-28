'use client'

import { useEffect } from 'react'

const LOCATION_IMAGE: Record<string, string> = {
  Erde: '/images/locations/earth.png',
  Mond: '/images/locations/moon.png',
  Mars: '/images/locations/mars.png',
  Phobos: '/images/locations/phobos.webp',
  Prometheus: '/images/locations/prometheus.png',
}

/**
 * Transitional dashboard enhancer. Keeps the dense DashboardClient untouched
 * while moving the compact profile values into its sticky header and enriching
 * the existing "Deine Orte" cards with already-shipped location artwork.
 * Remove once DashboardClient is split into dedicated header/location components.
 */
export default function DashboardVisualEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== '/dashboard') return

    let cancelled = false
    const enhance = async () => {
      const header = document.querySelector('header')
      const labels = Array.from(document.querySelectorAll('div')).filter(el => el.textContent?.trim() === 'Deine Orte')
      const placesSection = labels[0]?.parentElement

      if (placesSection) {
        const cards = Array.from(placesSection.querySelectorAll('[style*="cursor: pointer"]')) as HTMLElement[]
        for (const card of cards) {
          const text = card.textContent ?? ''
          const key = Object.keys(LOCATION_IMAGE).find(name => text.includes(name))
          if (!key || card.dataset.locationArtwork === '1') continue
          card.dataset.locationArtwork = '1'
          card.style.position = 'relative'
          card.style.overflow = 'hidden'
          card.style.paddingLeft = '54px'
          const image = document.createElement('img')
          image.src = LOCATION_IMAGE[key]
          image.alt = ''
          image.style.cssText = 'position:absolute;left:0;top:0;width:46px;height:100%;object-fit:cover;pointer-events:none'
          card.prepend(image)
        }
      }

      if (!header || header.querySelector('[data-noxia-profile-stats]')) return
      try {
        const token = (await import('@/lib/supabase/auth')).getToken ? await (await import('@/lib/supabase/auth')).getToken() : ''
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [profileRes, knowledgeRes, tradesRes] = await Promise.all([
          fetch('/api/game/profile', { headers }),
          fetch('/api/game/knowledge', { headers }),
          fetch('/api/game/trade?action=getTrades', { headers }),
        ])
        if (cancelled) return
        const profile = await profileRes.json()
        const knowledge = await knowledgeRes.json()
        const trades = await tradesRes.json()
        const stats = document.createElement('button')
        stats.dataset.noxiaProfileStats = '1'
        stats.type = 'button'
        stats.title = 'Vollprofil öffnen'
        stats.style.cssText = 'background:transparent;border:0;border-left:1px solid #d9d5cc;padding:2px 0 2px 14px;font:600 11px system-ui;color:#40566d;cursor:pointer;white-space:nowrap'
        stats.textContent = `⚖️ ${trades.trades?.length ?? 0} Trades · 🚀 ${profile.profile?.flight_count ?? 0} Flüge · 🧠 ${knowledge.knowledge_points ?? 0} Wissen`
        stats.onclick = () => {
          const avatar = header.querySelector('button img[src*="/images/avatars/"]')?.closest('button') as HTMLButtonElement | null
          avatar?.click()
        }
        header.lastElementChild?.prepend(stats)
      } catch { /* dashboard remains fully usable without enhancement */ }
    }

    const observer = new MutationObserver(() => void enhance())
    observer.observe(document.body, { childList: true, subtree: true })
    void enhance()
    return () => { cancelled = true; observer.disconnect() }
  }, [])

  return null
}
