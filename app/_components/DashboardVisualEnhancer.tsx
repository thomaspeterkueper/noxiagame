'use client'

import { useEffect } from 'react'

const LOCATION_IMAGE: Record<string, string> = {
  Erde: '/images/locations/earth.png',
  Mond: '/images/locations/moon.png',
  Mars: '/images/locations/mars.png',
  Phobos: '/images/locations/phobos.webp',
  Prometheus: '/images/locations/prometheus.png',
}

const CREDIT_MODULE_ID = 'ECO-L0-000001'
const CREDIT_LEARNING_URL = `/academy/learn?module=${CREDIT_MODULE_ID}`

function parseScale(transform: string): number {
  const scale = transform.match(/scale\(([-\d.]+)\)/)
  if (scale) return Number(scale[1]) || 1
  const matrix = transform.match(/matrix\(([-\d.]+),/)
  if (matrix) return Number(matrix[1]) || 1
  return 1
}

/**
 * Transitional dashboard enhancer. Keeps the dense DashboardClient untouched
 * while moving the compact profile values into its sticky header and enriching
 * the existing "Deine Orte" cards with already-shipped location artwork.
 * It also fixes the legacy transform-based grid zoom. The Earth/Sauerland
 * isometric view has its own explicit, non-hijacking entry in
 * DashboardPrimaryColony (app/dashboard/sauerland-isometric) and is not
 * wired up here.
 */
export default function DashboardVisualEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== '/dashboard') return

    let cancelled = false
    let enhancing = false
    let statsInstalled = false

    const zoomStyle = document.createElement('style')
    zoomStyle.dataset.noxiaZoomStyle = '1'
    zoomStyle.textContent = '[data-noxia-zoom-fixed="1"]{transform:none!important;zoom:var(--noxia-grid-zoom,1)!important;transition:zoom .12s ease!important}'
    document.head.appendChild(zoomStyle)

    const fixGridZoom = () => {
      const pan = document.querySelector('.grid-pan-container') as HTMLElement | null
      const scaled = pan?.firstElementChild as HTMLElement | null
      if (!pan || !scaled) return
      const inlineTransform = scaled.style.transform || getComputedStyle(scaled).transform
      const scale = parseScale(inlineTransform)
      if (scale <= 0) return
      scaled.dataset.noxiaZoomFixed = '1'
      scaled.style.setProperty('--noxia-grid-zoom', String(scale))
      pan.style.overscrollBehavior = 'contain'
    }

    const enhanceBankLearningLinks = () => {
      const candidates = Array.from(document.querySelectorAll('strong')).filter(el => {
        const text = el.textContent ?? ''
        return text.includes('ECO-L0-0001') || text.includes(CREDIT_MODULE_ID)
      }) as HTMLElement[]

      for (const moduleLabel of candidates) {
        if (moduleLabel.textContent?.includes('Was ist ein Kredit?')) {
          moduleLabel.textContent = `${CREDIT_MODULE_ID} — Was ist ein Kredit?`
        } else if (moduleLabel.textContent?.includes('ECO-L0-0001')) {
          moduleLabel.textContent = moduleLabel.textContent.replace('ECO-L0-0001', CREDIT_MODULE_ID)
        }

        const container = moduleLabel.closest('div')?.parentElement as HTMLElement | null
        if (!container || container.dataset.bankLearningLink === '1') continue
        container.dataset.bankLearningLink = '1'

        const link = document.createElement('a')
        link.href = CREDIT_LEARNING_URL
        link.textContent = 'Modul jetzt lernen →'
        link.setAttribute('aria-label', `Lernmodul ${CREDIT_MODULE_ID} öffnen`)
        link.style.cssText = 'display:inline-block;margin-top:12px;padding:8px 13px;border-radius:8px;background:#2a4e7a;color:#fff;text-decoration:none;font:700 12px system-ui;line-height:1.2'
        container.appendChild(link)
      }
    }

    const enhance = async () => {
      if (enhancing || cancelled) return
      enhancing = true
      try {
        fixGridZoom()
        enhanceBankLearningLinks()

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

        if (!header) return
        const existing = document.querySelectorAll('[data-noxia-profile-stats]')
        if (existing.length > 0) {
          statsInstalled = true
          existing.forEach((node, index) => { if (index > 0) node.remove() })
          return
        }
        if (statsInstalled) return

        const { getToken } = await import('@/lib/supabase/auth')
        const token = await getToken()
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [profileRes, knowledgeRes, tradesRes] = await Promise.all([
          fetch('/api/game/profile', { headers }),
          fetch('/api/game/knowledge', { headers }),
          fetch('/api/game/trade?action=getTrades', { headers }),
        ])
        if (cancelled || statsInstalled || document.querySelector('[data-noxia-profile-stats]')) return
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
        statsInstalled = true
      } catch { /* dashboard remains fully usable without enhancement */ }
      finally { enhancing = false }
    }

    const observer = new MutationObserver(() => void enhance())
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    void enhance()
    return () => {
      cancelled = true
      observer.disconnect()
      zoomStyle.remove()
    }
  }, [])

  return null
}
