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

async function authHeaders() {
  const token = await getToken()
  if (!token) throw new Error('Nicht angemeldet')
  return { Authorization: `Bearer ${token}` }
}

export default function EarthInteractionManager() {
  useEffect(() => {
    let cancelled = false
    let objectLookupSerial = 0

    const enhanceCandidate = () => {
      const panel = document.querySelector<HTMLElement>('.earth-candidate')
      if (!panel) return
      let button = panel.querySelector<HTMLButtonElement>('[data-noxia-candidate-build]')
      if (!button) {
        button = document.createElement('button')
        button.type = 'button'
        button.dataset.noxiaCandidateBuild = '1'
        button.style.cssText = 'position:static;right:auto;top:auto;margin-top:7px;width:100%;border:1px solid #80651d;background:#c89d35;color:#fffaf0;border-radius:7px;padding:9px 10px;font:900 10px system-ui;cursor:pointer'
        button.onclick = event => {
          event.preventDefault()
          event.stopPropagation()
          const svg = document.querySelector<SVGSVGElement>('.earth-map svg')
          if (!svg) return
          const rect = svg.getBoundingClientRect()
          svg.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }))
        }
        panel.appendChild(button)
      }

      const localFocus = document.querySelector<HTMLElement>('.earth-focus')
      const ready = Boolean(localFocus && /Prüfstandort/i.test(localFocus.textContent ?? ''))
      button.disabled = !ready
      button.textContent = ready ? 'An diesem Standort bauen' : 'Standortdetails werden geladen …'
      button.style.opacity = ready ? '1' : '.55'
      button.style.cursor = ready ? 'pointer' : 'wait'
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
      enhanceCandidate()
      void enhanceWorldObject()
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  return null
}
