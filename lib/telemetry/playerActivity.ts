// lib/telemetry/playerActivity.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Verhaltensaufzeichnung der Testphase: Klicks, tote Klicks, Wutklicks, Ansichten, Spielaktionen, Fehler, Laufwege (Wunsch Thomas)
// Version:      1.0.0
//
// Nur im Browser. Allgemein statt je Ansicht: Ein Klick-Lauscher, ein
// fetch-Umschlag und Fehler-Lauscher decken das ganze Spiel ab. Ansichten
// melden nur ihre Figurenposition (reportPlayerPosition).
//
// Nicht aufgezeichnet: Tastendrücke, Inhalte von Eingabefeldern, Antworten
// des Servers. Bereiche mit data-noxia-private werden übersprungen.

import { getToken } from '@/lib/supabase/auth'
import {
  apiActionParam,
  cleanLabel,
  isRageClick,
  normalizeApiPath,
  roundPosition,
  shouldReportPosition,
  MAX_EVENTS_PER_BATCH,
  type ActivityKind,
  type ClickSample,
} from './activityRules'

export interface ActivityContext {
  location?: string | null
  mode?: string | null
}

interface QueuedEvent {
  kind: ActivityKind
  at: string
  path: string
  location: string | null
  mode: string | null
  target?: string | null
  data?: Record<string, unknown>
}

const ENDPOINT = '/api/game/activity'
const FLUSH_MS = 15_000
const MAX_QUEUE = 300
const INTERACTIVE = 'button,a,[role="button"],[role="tab"],[role="menuitem"],input,select,textarea,label,summary,[data-track]'

let started = false
let sessionId = ''
let contextProvider: () => ActivityContext = () => ({})
const queue: QueuedEvent[] = []
const recentClicks: ClickSample[] = []
let lastPosition: { t: number; x: number; y: number; scope: string } | null = null
let activeSinceBeat = false
let flushing = false

function newSessionId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${random}`
}

function tabSession(): string {
  try {
    const existing = sessionStorage.getItem('noxia-activity-session')
    if (existing) return existing
    const id = newSessionId()
    sessionStorage.setItem('noxia-activity-session', id)
    return id
  } catch { return newSessionId() }
}

function push(kind: ActivityKind, target?: string | null, data?: Record<string, unknown>) {
  const ctx = contextProvider()
  queue.push({
    kind,
    at: new Date().toISOString(),
    path: cleanLabel(location.pathname, 120),
    location: ctx.location ?? null,
    mode: ctx.mode ?? null,
    target: target ?? null,
    data,
  })
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
  if (queue.length >= 40) void flush()
}

async function flush(useKeepalive = false) {
  if (flushing || queue.length === 0) return
  flushing = true
  try {
    const token = await getToken()
    if (!token) return // ohne Anmeldung bleibt die Warteschlange stehen
    const batch = queue.splice(0, MAX_EVENTS_PER_BATCH)
    const response = await originalFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, events: batch }),
      keepalive: useKeepalive,
    }).catch(() => null)
    if (!response || (!response.ok && response.status >= 500)) queue.unshift(...batch.slice(0, MAX_QUEUE - queue.length))
  } catch {
    // Aufzeichnung ist Beiwerk; sie darf das Spiel nie stören.
  } finally {
    flushing = false
  }
}

/** Beschriftung des angeklickten Elements – aus Attributen, nie aus Eingabefeldern. */
function describe(element: Element): { label: string; interactive: boolean } {
  const interactiveEl = element.closest(INTERACTIVE)
  const svgGroup = element.closest('g')
  const svgTitle = svgGroup?.querySelector(':scope > title')?.textContent ?? null
  let pointer = false
  for (let el: Element | null = element, i = 0; el && i < 5; el = el.parentElement, i++) {
    if (getComputedStyle(el).cursor === 'pointer') { pointer = true; break }
  }
  const source = interactiveEl ?? element
  const tag = source.tagName.toLowerCase()
  const text = tag === 'input' || tag === 'textarea' || tag === 'select'
    ? `${tag}${(source as HTMLInputElement).name ? ':' + (source as HTMLInputElement).name : ''}`
    : source.getAttribute('data-track')
      ?? source.getAttribute('aria-label')
      ?? source.getAttribute('title')
      ?? svgTitle
      ?? (interactiveEl ? (interactiveEl as HTMLElement).innerText : null)
      ?? tag
  return { label: cleanLabel(text), interactive: Boolean(interactiveEl) || pointer || Boolean(svgTitle && pointer) }
}

function onClick(event: MouseEvent) {
  const target = event.target as Element | null
  if (!target || target.closest('[data-noxia-private]')) return
  activeSinceBeat = true
  const sample = { t: Date.now(), x: event.clientX, y: event.clientY }
  const rage = isRageClick(recentClicks, sample)
  recentClicks.push(sample)
  while (recentClicks.length > 8) recentClicks.shift()
  const { label, interactive } = describe(target)
  const data = {
    x: Math.round((event.clientX / Math.max(1, window.innerWidth)) * 100) / 100,
    y: Math.round((event.clientY / Math.max(1, window.innerHeight)) * 100) / 100,
    tag: target.tagName.toLowerCase(),
  }
  push(rage ? 'rage_click' : interactive ? 'click' : 'dead_click', label, data)
}

let originalFetch: typeof fetch = (input, init) => fetch(input, init)

function wrapFetch() {
  const native = window.fetch.bind(window)
  originalFetch = native
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const tracked = url.includes('/api/') && !url.includes(ENDPOINT)
    if (!tracked) return native(input, init)
    const started = performance.now()
    try {
      const response = await native(input, init)
      const ms = Math.round(performance.now() - started)
      if (method !== 'GET' || !response.ok) {
        push(response.ok ? 'action' : 'api_error', normalizeApiPath(url), {
          method, status: response.status, ms, action: apiActionParam(url),
        })
      }
      return response
    } catch (error) {
      push('api_error', normalizeApiPath(url), {
        method, status: 0, ms: Math.round(performance.now() - started), action: apiActionParam(url),
        error: cleanLabel(error instanceof Error ? error.name : 'network', 40),
      })
      throw error
    }
  }
}

function onError(event: ErrorEvent) {
  const file = (event.filename ?? '').split('/').pop() ?? ''
  push('js_error', cleanLabel(event.message, 160), { file: cleanLabel(file, 60), line: event.lineno ?? null })
}

function onRejection(event: PromiseRejectionEvent) {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
  push('js_error', cleanLabel(reason, 160), { unhandled: true })
}

/** Ansicht, Ort oder Spielmodus hat gewechselt. */
export function reportView(target: string, data?: Record<string, unknown>) {
  if (!started) return
  push('view', cleanLabel(target), data)
}

/**
 * Standort der Spielfigur in einer begehbaren Ansicht. scope benennt die
 * Szene (z. B. „moon“, „cafe:<haus>“); x/y in den Einheiten der Szene.
 * Gedrosselt: höchstens alle 5 s und nur nach mindestens 3 m Weg.
 */
export function reportPlayerPosition(scope: string, x: number, y: number) {
  if (!started || !Number.isFinite(x) || !Number.isFinite(y)) return
  const next = { t: Date.now(), x, y, scope: cleanLabel(scope, 60) }
  if (!shouldReportPosition(lastPosition, next)) return
  lastPosition = next
  activeSinceBeat = true
  push('position', next.scope, { x: roundPosition(x), y: roundPosition(y) })
}

/** Startet die Aufzeichnung einmal je Browserfenster. */
export function startPlayerActivity(provider: () => ActivityContext) {
  if (started || typeof window === 'undefined') return
  started = true
  contextProvider = provider
  sessionId = tabSession()
  wrapFetch()
  document.addEventListener('click', onClick, { capture: true, passive: true })
  document.addEventListener('keydown', () => { activeSinceBeat = true }, { capture: true, passive: true })
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(true) })
  window.addEventListener('pagehide', () => { void flush(true) })
  setInterval(() => {
    if (activeSinceBeat && document.visibilityState === 'visible') push('heartbeat')
    activeSinceBeat = false
  }, 60_000)
  setInterval(() => { void flush() }, FLUSH_MS)

  let timeZone: string | null = null
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { timeZone = null }
  push('session_start', null, {
    w: window.innerWidth, h: window.innerHeight,
    lang: navigator.language, tz: timeZone,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
  })
}
