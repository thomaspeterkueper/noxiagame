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
const SAUERLAND_ROOT = '/assets/environments/earth/sauerland'

function parseScale(transform: string): number {
  const scale = transform.match(/scale\(([-\d.]+)\)/)
  if (scale) return Number(scale[1]) || 1
  const matrix = transform.match(/matrix\(([-\d.]+),/)
  if (matrix) return Number(matrix[1]) || 1
  return 1
}

function earthBuildingAsset(entityId: string): string {
  const id = entityId.toLowerCase()
  if (id.includes('school') || id.includes('academy')) return `${SAUERLAND_ROOT}/buildings/school_01.svg`
  if (id.includes('admin') || id.includes('town') || id.includes('government')) return `${SAUERLAND_ROOT}/buildings/town_hall_01.svg`
  if (id.includes('factory') || id.includes('smelt') || id.includes('industrial')) return `${SAUERLAND_ROOT}/buildings/factory_small_01.svg`
  if (id.includes('warehouse') || id.includes('storage') || id.includes('depot')) return `${SAUERLAND_ROOT}/buildings/warehouse_01.svg`
  if (id.includes('farm') || id.includes('plant')) return `${SAUERLAND_ROOT}/buildings/farm_01.svg`
  if (id.includes('fire')) return `${SAUERLAND_ROOT}/buildings/fire_station_01.svg`
  if (id.includes('chapel')) return `${SAUERLAND_ROOT}/buildings/chapel_01.svg`
  if (id.includes('spaceport') || id.includes('control') || id.includes('command')) return `${SAUERLAND_ROOT}/hub/hub_control_01.svg`
  if (id.includes('hangar')) return `${SAUERLAND_ROOT}/hub/hub_hangar_01.svg`
  if (id.includes('lab') || id.includes('research')) return `${SAUERLAND_ROOT}/hub/hub_module_01.svg`
  if (id.includes('habitat') || id.includes('residential') || id.includes('house')) return `${SAUERLAND_ROOT}/buildings/house_01.svg`
  return `${SAUERLAND_ROOT}/hub/hub_module_01.svg`
}

type WorldEntity = {
  id: string
  entity_id: string
  tile_row: number
  tile_col: number
  locations?: { slug?: string; name?: string } | null
}

async function openSauerlandIsometric(): Promise<void> {
  document.querySelector('[data-noxia-sauerland-iso]')?.remove()

  const overlay = document.createElement('div')
  overlay.dataset.noxiaSauerlandIso = '1'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(18,25,28,.76);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px'

  const shell = document.createElement('section')
  shell.style.cssText = 'width:min(1500px,96vw);height:min(900px,92vh);background:#f7f5ee;border:1px solid #cfc7b8;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column'

  const header = document.createElement('header')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #ddd6c8;background:#fbfaf6;min-height:48px'
  header.innerHTML = '<div><strong style="font:700 14px system-ui;color:#24415e">Erde · Sauerland</strong><span style="font:500 11px system-ui;color:#7d7467;margin-left:10px">Neue isometrische Ansicht</span></div>'

  const controls = document.createElement('div')
  controls.style.cssText = 'display:flex;gap:6px;align-items:center'
  const makeButton = (label: string, title: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.title = title
    button.style.cssText = 'height:30px;min-width:32px;border:1px solid #d8d0c2;border-radius:7px;background:#fff;color:#24415e;font:700 13px system-ui;cursor:pointer;padding:0 9px'
    return button
  }
  const minus = makeButton('−', 'Verkleinern')
  const zoomLabel = document.createElement('span')
  zoomLabel.style.cssText = 'min-width:44px;text-align:center;font:600 11px ui-monospace,monospace;color:#6b6357'
  const plus = makeButton('+', 'Vergrößern')
  const reset = makeButton('100%', 'Zoom zurücksetzen')
  const close = makeButton('✕', 'Schließen')
  controls.append(minus, zoomLabel, plus, reset, close)
  header.appendChild(controls)

  const viewport = document.createElement('div')
  viewport.style.cssText = 'position:relative;flex:1;overflow:auto;background:linear-gradient(#dcebf0 0,#edf1df 32%,#d5dfbf 100%);cursor:grab;overscroll-behavior:contain'

  const sceneFrame = document.createElement('div')
  sceneFrame.style.cssText = 'position:relative;width:1550px;height:1040px;transform-origin:top left'
  const scene = document.createElement('div')
  scene.style.cssText = 'position:absolute;inset:0'
  sceneFrame.appendChild(scene)
  viewport.appendChild(sceneFrame)
  shell.append(header, viewport)
  overlay.appendChild(shell)
  document.body.appendChild(overlay)

  let zoom = 0.85
  const applyZoom = () => {
    zoom = Math.max(0.35, Math.min(2.2, Math.round(zoom * 100) / 100))
    sceneFrame.style.zoom = String(zoom)
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`
  }
  plus.onclick = () => { zoom += 0.15; applyZoom() }
  minus.onclick = () => { zoom -= 0.15; applyZoom() }
  reset.onclick = () => { zoom = 1; applyZoom() }
  close.onclick = () => overlay.remove()
  overlay.addEventListener('mousedown', event => { if (event.target === overlay) overlay.remove() })
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    zoom += event.deltaY < 0 ? 0.1 : -0.1
    applyZoom()
  }, { passive: false })
  applyZoom()

  let panning = false
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0
  viewport.addEventListener('mousedown', event => {
    if ((event.target as HTMLElement).closest('button')) return
    panning = true
    startX = event.clientX
    startY = event.clientY
    startLeft = viewport.scrollLeft
    startTop = viewport.scrollTop
    viewport.style.cursor = 'grabbing'
  })
  window.addEventListener('mousemove', event => {
    if (!panning) return
    viewport.scrollLeft = startLeft - (event.clientX - startX)
    viewport.scrollTop = startTop - (event.clientY - startY)
  })
  window.addEventListener('mouseup', () => { panning = false; viewport.style.cursor = 'grab' })

  const tileW = 46
  const tileH = 24
  const originX = 760
  const originY = 42
  const cols = 32
  const rows = 24
  const project = (row: number, col: number) => ({
    x: originX + (col - row) * tileW / 2,
    y: originY + (col + row) * tileH / 2,
  })

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const point = project(row, col)
      const tile = document.createElement('div')
      const variant = (row * 17 + col * 29) % 13 === 0 ? 'terrain_grass_dark_01.svg' : 'terrain_grass_01.webp'
      tile.style.cssText = `position:absolute;left:${point.x - tileW / 2}px;top:${point.y}px;width:${tileW}px;height:${tileH}px;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:#78985f url(${SAUERLAND_ROOT}/terrain/${variant}) center/cover no-repeat;filter:saturate(.88);box-shadow:inset 0 0 0 1px rgba(60,82,48,.12)`
      scene.appendChild(tile)
    }
  }

  const terrainAccent = [
    [3, 3, 'tree_conifer_01.svg'], [4, 3, 'tree_conifer_02.svg'], [5, 4, 'tree_birch_01.svg'],
    [18, 25, 'tree_broadleaf_01.svg'], [19, 26, 'tree_broadleaf_02.svg'], [20, 25, 'tree_conifer_01.svg'],
    [2, 24, 'rock_02.svg'], [21, 6, 'rock_04.svg'],
  ] as const
  for (const [row, col, asset] of terrainAccent) {
    const point = project(row, col)
    const image = document.createElement('img')
    image.src = `${SAUERLAND_ROOT}/nature/${asset}`
    image.alt = ''
    image.style.cssText = `position:absolute;left:${point.x - 34}px;top:${point.y - 54}px;width:68px;height:68px;object-fit:contain;z-index:${100 + row + col};pointer-events:none`
    scene.appendChild(image)
  }

  const loading = document.createElement('div')
  loading.textContent = 'Weltdaten werden geladen …'
  loading.style.cssText = 'position:absolute;left:14px;bottom:14px;z-index:2000;padding:7px 10px;border-radius:7px;background:rgba(248,245,238,.9);border:1px solid #d8d0c2;font:600 11px system-ui;color:#526477'
  viewport.appendChild(loading)

  try {
    const response = await fetch('/api/game/world')
    const world = await response.json()
    const entities = (Array.isArray(world.entities) ? world.entities : []) as WorldEntity[]
    const earthEntities = entities.filter(entity => {
      const slug = entity.locations?.slug?.toLowerCase() ?? ''
      const name = entity.locations?.name?.toLowerCase() ?? ''
      return slug === 'earth' || slug === 'erde' || slug.includes('sauerland') || name.includes('erde') || name.includes('sauerland')
    })

    for (const entity of earthEntities.sort((a, b) => (a.tile_row + a.tile_col) - (b.tile_row + b.tile_col))) {
      if (!Number.isFinite(entity.tile_row) || !Number.isFinite(entity.tile_col)) continue
      const point = project(entity.tile_row, entity.tile_col)
      const image = document.createElement('img')
      image.src = earthBuildingAsset(entity.entity_id)
      image.alt = entity.entity_id
      image.title = entity.entity_id.replace(/_/g, ' ')
      image.style.cssText = `position:absolute;left:${point.x - 46}px;top:${point.y - 77}px;width:92px;height:92px;object-fit:contain;z-index:${300 + entity.tile_row + entity.tile_col};filter:drop-shadow(0 8px 5px rgba(31,43,35,.22));cursor:pointer`
      scene.appendChild(image)
    }
    loading.textContent = `${earthEntities.length} Gebäude · 32×24 · Sauerland-Grafiksatz`
  } catch {
    loading.textContent = 'Weltdaten nicht erreichbar · Terrainansicht aktiv'
  }

  requestAnimationFrame(() => {
    viewport.scrollLeft = Math.max(0, (1550 * zoom - viewport.clientWidth) / 2)
    viewport.scrollTop = 0
  })
}

/**
 * Transitional dashboard enhancer. Keeps the dense DashboardClient untouched
 * while moving the compact profile values into its sticky header and enriching
 * the existing "Deine Orte" cards with already-shipped location artwork.
 * It also fixes the legacy transform-based grid zoom and routes the old
 * isometric trigger to the new Sauerland asset renderer.
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

    const installIsometricTrigger = () => {
      const candidates = Array.from(document.querySelectorAll('button,[role="button"],a')) as HTMLElement[]
      let trigger = candidates.find(element => {
        const haystack = `${element.textContent ?? ''} ${element.getAttribute('title') ?? ''} ${element.getAttribute('aria-label') ?? ''}`.toLowerCase()
        return haystack.includes('isometr')
      })

      if (!trigger) {
        const pan = document.querySelector('.grid-pan-container') as HTMLElement | null
        const host = pan?.parentElement
        if (!host || host.querySelector('[data-noxia-iso-trigger]')) return
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.noxiaIsoTrigger = '1'
        button.textContent = '◇ Isometrie'
        button.title = 'Neue Sauerland-Isometrie öffnen'
        button.style.cssText = 'position:absolute;top:6px;left:6px;z-index:20;border:1px solid #d8d0c2;border-radius:8px;background:rgba(248,245,238,.94);color:#24415e;padding:6px 10px;font:700 11px system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)'
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
        host.appendChild(button)
        trigger = button
      }

      if (trigger.dataset.noxiaIsoWired === '1') return
      trigger.dataset.noxiaIsoWired = '1'
      trigger.setAttribute('title', 'Neue Sauerland-Isometrie öffnen')
      trigger.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        void openSauerlandIsometric()
      }, true)
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
        installIsometricTrigger()
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
      document.querySelector('[data-noxia-sauerland-iso]')?.remove()
    }
  }, [])

  return null
}
