'use client'

import { useEffect } from 'react'
import { getToken } from '@/lib/supabase/auth'

type SpatialEntity = {
  id: string
  name?: string
  x_m: number | null
  y_m: number | null
  isOwn?: boolean
}

type QuotePayload = {
  error?: string
  quote?: {
    valueNormal: number
    rueckbau: number
  }
  demolitionCost?: number
  saleDurationTicks?: number
  childCount?: number
}

const EARTH_REGION_COOKIE = 'noxia-earth-region'
const SAUERLAND_REGION = 'earth-sauerland'
const NAMIBIA_REGION = 'earth-namibia-erongo'

function readEarthRegion() {
  if (typeof document === 'undefined') return SAUERLAND_REGION
  const item = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${EARTH_REGION_COOKIE}=`))
  const value = item ? decodeURIComponent(item.slice(EARTH_REGION_COOKIE.length + 1)) : SAUERLAND_REGION
  return value === NAMIBIA_REGION ? NAMIBIA_REGION : SAUERLAND_REGION
}

function selectEarthRegion(regionId: string) {
  document.cookie = `${EARTH_REGION_COOKIE}=${encodeURIComponent(regionId)}; Path=/; Max-Age=31536000; SameSite=Lax`
  window.location.reload()
}

function buttonStyle(kind: 'primary' | 'danger'): string {
  if (kind === 'danger') {
    return 'flex:1;border:1px solid #9a5750;background:#fff7f3;color:#8b332d;border-radius:7px;padding:8px 9px;font:800 10px system-ui;cursor:pointer'
  }
  return 'flex:1;border:1px solid #476c78;background:#173f4d;color:#fffaf0;border-radius:7px;padding:8px 9px;font:800 10px system-ui;cursor:pointer'
}

function parseSelectedObject(panel: HTMLElement) {
  const name = panel.querySelector<HTMLElement>('.earth-site-head strong')?.textContent?.trim()
  const facts = Array.from(panel.querySelectorAll<HTMLElement>('.earth-site-facts > div'))
  const position = facts.find(row => (row.querySelector('span')?.textContent ?? '').trim() === 'Position')
    ?.querySelector('b')?.textContent ?? ''
  const match = position.match(/(-?\d+)\s*m\s*E\s*·\s*(-?\d+)\s*m\s*N/)
  if (!name || !match) return null
  return { name, xM: Number(match[1]), yM: Number(match[2]) }
}

function isInteractiveMapTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'button,input,select,textarea,a,[role="button"],.earth-site-panel,.earth-object-panel,.earth-layer-control,.earth-map-tools,.earth-candidate',
  ))
}

async function authHeaders() {
  const token = await getToken()
  if (!token) throw new Error('Nicht angemeldet')
  return { Authorization: `Bearer ${token}` }
}

export default function EarthInteractionManager() {
  useEffect(() => {
    let cancelled = false
    let objectLookupSerial = 0
    const mapCleanups: Array<() => void> = []
    const controlCleanups: Array<() => void> = []

    const enhanceRegionControls = () => {
      const actions = document.querySelector<HTMLElement>('.earth-actions')
      const head = document.querySelector<HTMLElement>('.earth-head')
      if (!actions || !head) return

      const current = readEarthRegion()
      let switcher = actions.querySelector<HTMLElement>('[data-noxia-earth-region-switcher]')
      if (!switcher) {
        switcher = document.createElement('div')
        switcher.dataset.noxiaEarthRegionSwitcher = '1'
        switcher.style.cssText = 'display:flex;gap:4px;align-items:center;padding:3px;border:1px solid #9aa9a1;border-radius:8px;background:#f7f6ef'

        const makeButton = (id: string, label: string) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.dataset.regionId = id
          button.textContent = label
          button.style.cssText = 'border:0;background:transparent;color:#52666d;border-radius:5px;padding:6px 8px;font:800 9px system-ui;cursor:pointer'
          button.onclick = () => selectEarthRegion(id)
          return button
        }

        switcher.append(
          makeButton(SAUERLAND_REGION, 'Deutschland · Sauerland'),
          makeButton(NAMIBIA_REGION, 'Namibia · Erongo'),
        )
        actions.prepend(switcher)
      }

      for (const button of Array.from(switcher.querySelectorAll<HTMLButtonElement>('button[data-region-id]'))) {
        const active = button.dataset.regionId === current
        button.style.background = active ? '#173f4d' : 'transparent'
        button.style.color = active ? '#fffaf0' : '#52666d'
      }

      const eyebrow = head.querySelector<HTMLElement>('small')
      const title = head.querySelector<HTMLElement>('h1')
      const copy = head.querySelector<HTMLElement>('p')
      if (current === NAMIBIA_REGION) {
        if (eyebrow && eyebrow.textContent !== 'NOXIA EARTH · NAMIBIA 2086') eyebrow.textContent = 'NOXIA EARTH · NAMIBIA 2086'
        if (title && title.textContent !== 'Erongo-Korridor · Walvis Bay') title.textContent = 'Erongo-Korridor · Walvis Bay'
        if (copy && copy.textContent !== 'Reale OSM- und Geländedaten für den zweiten Erdraum. Analyse ist aktiv; Baupersistenz bleibt bis zur regionalen Frame-Migration im Sauerland gesperrt.') {
          copy.textContent = 'Reale OSM- und Geländedaten für den zweiten Erdraum. Analyse ist aktiv; Baupersistenz bleibt bis zur regionalen Frame-Migration im Sauerland gesperrt.'
        }
      }

      if (current === NAMIBIA_REGION) {
        let badge = actions.querySelector<HTMLElement>('[data-noxia-earth-analysis-mode]')
        if (!badge) {
          badge = document.createElement('div')
          badge.dataset.noxiaEarthAnalysisMode = '1'
          badge.textContent = 'ANALYSEMODUS · REGIONALE BAUPERSISTENZ FOLGT'
          badge.style.cssText = 'padding:6px 8px;border:1px solid #b99542;border-radius:6px;background:#fff5d8;color:#765b18;font:800 8px system-ui;letter-spacing:.05em'
          actions.appendChild(badge)
        }
      }
    }

    const enhanceMapControlGuards = () => {
      const controls = document.querySelectorAll<HTMLElement>(
        '.earth-layer-control,.earth-map-tools,.earth-site-panel,.earth-object-panel,.earth-candidate',
      )
      for (const control of Array.from(controls)) {
        if (control.dataset.noxiaPointerGuard === '1') continue
        control.dataset.noxiaPointerGuard = '1'
        const stopDragStart = (event: PointerEvent) => event.stopPropagation()
        control.addEventListener('pointerdown', stopDragStart)
        controlCleanups.push(() => {
          control.removeEventListener('pointerdown', stopDragStart)
          delete control.dataset.noxiaPointerGuard
        })
      }
    }

    const enforceRegionalBuildBoundary = () => {
      if (readEarthRegion() !== NAMIBIA_REGION) return
      const buildButton = document.querySelector<HTMLButtonElement>('.earth-site-panel .earth-build-open')
      if (!buildButton) return
      buildButton.disabled = true
      buildButton.textContent = 'Analysemodus · Bauen in Namibia folgt'
      buildButton.title = 'Weltobjekte benötigen vor dem Bauen einen persistenten Earth-Region-Key.'
      buildButton.style.opacity = '.65'
      buildButton.style.cursor = 'not-allowed'
    }

    const enhanceMapClickBridge = () => {
      const map = document.querySelector<HTMLElement>('.earth-map')
      if (!map || map.dataset.noxiaSpotClickBridge === '1') return
      map.dataset.noxiaSpotClickBridge = '1'
      map.style.cursor = 'crosshair'

      let press: { pointerId: number; x: number; y: number; interactive: boolean } | null = null

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return
        press = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          interactive: isInteractiveMapTarget(event.target),
        }
        if (!press.interactive) map.style.cursor = 'grabbing'
      }

      const onPointerUp = (event: PointerEvent) => {
        const current = press
        press = null
        map.style.cursor = 'crosshair'
        if (!current || current.pointerId !== event.pointerId || current.interactive) return
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 4) return

        // EarthRegionPreview captures the pointer on the map container while
        // dragging. Browsers can therefore retarget the resulting click to the
        // container instead of the SVG, so the native SVG onClick never sees a
        // simple tap. Re-dispatch that click to the SVG after React has handled
        // pointerup; its existing pointerToSpot logic remains authoritative.
        window.setTimeout(() => {
          if (cancelled || !document.body.contains(map)) return
          const svg = map.querySelector<SVGSVGElement>('svg')
          if (!svg) return
          svg.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
          }))
        }, 0)
      }

      const onPointerCancel = () => {
        press = null
        map.style.cursor = 'crosshair'
      }

      map.addEventListener('pointerdown', onPointerDown, true)
      map.addEventListener('pointerup', onPointerUp, true)
      map.addEventListener('pointercancel', onPointerCancel, true)
      mapCleanups.push(() => {
        map.removeEventListener('pointerdown', onPointerDown, true)
        map.removeEventListener('pointerup', onPointerUp, true)
        map.removeEventListener('pointercancel', onPointerCancel, true)
        delete map.dataset.noxiaSpotClickBridge
      })
    }

    const openBuildAtMapCenter = () => {
      const svg = document.querySelector<SVGSVGElement>('.earth-map svg')
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const dispatchCenterClick = () => svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }))

      // A previous drag may intentionally suppress the next map click. Try once,
      // then retry only when React still has not produced a selected-site panel.
      dispatchCenterClick()
      window.setTimeout(() => {
        if (!document.querySelector('.earth-site-panel')) dispatchCenterClick()
      }, 40)

      // Candidate -> selected spot -> native site-first building picker. Keep the
      // existing React flow authoritative; this bridge only opens it reliably.
      let attempts = 0
      const openPicker = () => {
        if (cancelled) return
        const buildButton = document.querySelector<HTMLButtonElement>('.earth-site-panel .earth-build-open')
        if (buildButton) {
          buildButton.click()
          return
        }
        attempts += 1
        if (attempts < 20) window.setTimeout(openPicker, 50)
      }
      window.setTimeout(openPicker, 0)
    }

    const enhanceCandidate = () => {
      if (readEarthRegion() !== SAUERLAND_REGION) return
      const panel = document.querySelector<HTMLElement>('.earth-candidate')
      if (!panel) return

      const localFocus = document.querySelector<HTMLElement>('.earth-focus')
      const ready = Boolean(localFocus && /Prüfstandort/i.test(localFocus.textContent ?? ''))
      const label = ready ? 'An diesem Standort bauen' : 'Standortdetails werden geladen …'
      const opacity = ready ? '1' : '0.55'
      const cursor = ready ? 'pointer' : 'wait'

      let button = panel.querySelector<HTMLButtonElement>('[data-noxia-candidate-build]')
      if (!button) {
        button = document.createElement('button')
        button.type = 'button'
        button.dataset.noxiaCandidateBuild = '1'
        button.style.cssText = 'position:static;right:auto;top:auto;margin-top:7px;width:100%;border:1px solid #80651d;background:#c89d35;color:#fffaf0;border-radius:7px;padding:9px 10px;font:900 10px system-ui;cursor:pointer'
        button.onclick = event => {
          event.preventDefault()
          event.stopPropagation()
          if (!button?.disabled) openBuildAtMapCenter()
        }
        panel.appendChild(button)
      }

      // Do not rewrite textContent on every MutationObserver pass. Replacing the
      // text node creates a new mutation and previously caused a self-triggering
      // observer loop exactly after opening a spaceport candidate.
      if (button.disabled !== !ready) button.disabled = !ready
      if (button.textContent !== label) button.textContent = label
      if (button.style.opacity !== opacity) button.style.opacity = opacity
      if (button.style.cursor !== cursor) button.style.cursor = cursor
    }

    const enhanceWorldObject = async () => {
      const panel = document.querySelector<HTMLElement>('.earth-object-panel')
      if (!panel) return
      const selected = parseSelectedObject(panel)
      if (!selected) return

      const signature = `${selected.name}|${selected.xM}|${selected.yM}`
      if (panel.dataset.noxiaWorldActionsFor === signature) return
      panel.dataset.noxiaWorldActionsFor = signature
      panel.querySelector('[data-noxia-world-actions]')?.remove()
      const serial = ++objectLookupSerial

      const box = document.createElement('div')
      box.dataset.noxiaWorldActions = '1'
      box.style.cssText = 'margin-top:10px;padding-top:9px;border-top:1px solid #d7d9d1'
      box.innerHTML = '<div style="font:800 9px system-ui;color:#62767d;letter-spacing:.08em;margin-bottom:6px">EIGENTÜMER-AKTIONEN</div><div data-state style="font:10px system-ui;color:#718087">Objekt wird geprüft …</div>'
      panel.appendChild(box)

      try {
        const headers = await authHeaders()
        const response = await fetch('/api/game/build/spatial?location=earth', { headers, cache: 'no-store' })
        const spatial = await response.json() as { entities?: SpatialEntity[]; error?: string }
        if (!response.ok) throw new Error(spatial.error ?? 'Weltobjekte konnten nicht geladen werden')
        if (cancelled || serial !== objectLookupSerial || !document.body.contains(panel)) return

        const entity = (spatial.entities ?? []).find(row =>
          row.isOwn &&
          row.name === selected.name &&
          row.x_m != null && row.y_m != null &&
          Math.round(Number(row.x_m)) === selected.xM &&
          Math.round(Number(row.y_m)) === selected.yM
        )
        const state = box.querySelector<HTMLElement>('[data-state]')!
        if (!entity) {
          state.textContent = 'Nur eigene Gebäude können verkauft oder abgerissen werden.'
          return
        }

        const quoteResponse = await fetch(`/api/game/build/world-object?entityId=${encodeURIComponent(entity.id)}`, { headers, cache: 'no-store' })
        const quote = await quoteResponse.json() as QuotePayload
        if (!quoteResponse.ok) throw new Error(quote.error ?? 'Gebäudewert konnte nicht ermittelt werden')
        if (cancelled || serial !== objectLookupSerial || !document.body.contains(panel)) return

        state.remove()
        const summary = document.createElement('div')
        summary.style.cssText = 'display:grid;gap:3px;margin-bottom:7px;font:10px system-ui;color:#627178'
        const saleValue = Number(quote.quote?.valueNormal ?? 0)
        const demolitionCost = Number(quote.demolitionCost ?? quote.quote?.rueckbau ?? 0)
        const saleText = saleValue >= 0
          ? `Verkaufswert: ${saleValue.toLocaleString('de-DE')} Cr`
          : `Verkauf/Rückbau: ${Math.abs(saleValue).toLocaleString('de-DE')} Cr Kosten`
        summary.innerHTML = `<span>${saleText}</span><span>Rückbau: ${demolitionCost.toLocaleString('de-DE')} Cr · Verkauf ${quote.saleDurationTicks ?? 2} Tick${(quote.saleDurationTicks ?? 2) === 1 ? '' : 's'}</span>`
        box.appendChild(summary)

        const actions = document.createElement('div')
        actions.style.cssText = 'display:flex;gap:6px'
        const sellButton = document.createElement('button')
        sellButton.type = 'button'
        sellButton.textContent = 'Verkaufen'
        sellButton.style.cssText = buttonStyle('primary')
        const demolishButton = document.createElement('button')
        demolishButton.type = 'button'
        demolishButton.textContent = 'Abreißen'
        demolishButton.style.cssText = buttonStyle('danger')
        actions.append(sellButton, demolishButton)
        box.appendChild(actions)

        const feedback = document.createElement('div')
        feedback.style.cssText = 'display:none;margin-top:7px;padding:7px 8px;border-radius:6px;background:#f2e8c7;color:#735b1f;font:800 9px system-ui'
        box.appendChild(feedback)

        const runAction = async (action: 'sell' | 'demolish') => {
          const children = Number(quote.childCount ?? 0)
          if (children > 0) {
            feedback.style.display = 'block'
            feedback.textContent = `Das Objekt besitzt noch ${children} untergeordnete Module. Diese müssen zuerst entfernt werden.`
            return
          }

          const question = action === 'sell'
            ? saleValue >= 0
              ? `${selected.name} für ${saleValue.toLocaleString('de-DE')} Cr verkaufen? Die Auszahlung erfolgt nach ${quote.saleDurationTicks ?? 2} NOXIA-Ticks.`
              : `${selected.name} verkaufen? Dabei entstehen ${Math.abs(saleValue).toLocaleString('de-DE')} Cr Kosten.`
            : `${selected.name} endgültig abreißen? Der Rückbau kostet ${demolitionCost.toLocaleString('de-DE')} Cr.`
          if (!window.confirm(question)) return

          sellButton.disabled = true
          demolishButton.disabled = true
          feedback.style.display = 'block'
          feedback.textContent = action === 'sell' ? 'Verkauf wird angelegt …' : 'Rückbau wird ausgeführt …'
          try {
            const actionHeaders = await authHeaders()
            const resultResponse = await fetch('/api/game/build/world-object', {
              method: 'POST',
              headers: { ...actionHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entityId: entity.id, action }),
            })
            const result = await resultResponse.json() as { error?: string; payout?: number; cost?: number }
            if (!resultResponse.ok) throw new Error(result.error ?? 'Aktion fehlgeschlagen')
            feedback.textContent = action === 'sell'
              ? `Verkauf läuft · ${Number(result.payout ?? saleValue).toLocaleString('de-DE')} Cr nach Abschluss.`
              : `Rückbau abgeschlossen · ${Number(result.cost ?? demolitionCost).toLocaleString('de-DE')} Cr.`
            window.setTimeout(() => window.location.reload(), 700)
          } catch (error) {
            feedback.textContent = error instanceof Error ? error.message : String(error)
            sellButton.disabled = false
            demolishButton.disabled = false
          }
        }

        sellButton.onclick = () => void runAction('sell')
        demolishButton.onclick = () => void runAction('demolish')
      } catch (error) {
        const state = box.querySelector<HTMLElement>('[data-state]')
        if (state) state.textContent = error instanceof Error ? error.message : String(error)
      }
    }

    const enhance = () => {
      enhanceRegionControls()
      enhanceMapControlGuards()
      enforceRegionalBuildBoundary()
      enhanceMapClickBridge()
      enhanceCandidate()
      void enhanceWorldObject()
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelled = true
      observer.disconnect()
      for (const cleanup of mapCleanups) cleanup()
      for (const cleanup of controlCleanups) cleanup()
    }
  }, [])

  return null
}
