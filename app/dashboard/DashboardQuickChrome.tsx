'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getToken } from '@/lib/supabase/auth'
import DashboardPrimaryColony from './DashboardPrimaryColony'

const LOCATION_ASSETS: Record<string, string> = {
  Mars: '/images/locations/mars.png',
  Prometheus: '/images/locations/prometheus.png',
  Mond: '/images/locations/moon.png',
  Phobos: '/images/locations/phobos.webp',
  Erde: '/images/locations/earth.png',
}

type Stats = {
  trades: number
  flights: number
  knowledge: number
}

type LocationTarget = {
  node: HTMLElement
  name: string
  src: string
}

function findLocationTargets(): LocationTarget[] {
  const leftColumn = document.querySelector('.noxia-dashboard-shell > div > header + div > div:first-child')
  if (!(leftColumn instanceof HTMLElement)) return []

  const groups = Array.from(leftColumn.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  const locationGroup = groups.find(group => (group.firstElementChild?.textContent ?? '').trim().includes('Deine Orte'))
  if (!locationGroup) return []

  const cardsContainer = locationGroup.lastElementChild
  if (!(cardsContainer instanceof HTMLElement)) return []

  const result: LocationTarget[] = []
  for (const raw of Array.from(cardsContainer.children)) {
    if (!(raw instanceof HTMLElement)) continue
    const text = raw.textContent ?? ''
    const name = Object.keys(LOCATION_ASSETS).find(key => text.includes(key))
    if (!name) continue
    raw.classList.add('noxia-location-card-with-image')
    result.push({ node: raw, name, src: LOCATION_ASSETS[name] })
  }
  return result
}

function findHeaderTarget(): HTMLElement | null {
  const node = document.querySelector('.noxia-dashboard-shell > div > header > div:last-child')
  return node instanceof HTMLElement ? node : null
}

/**
 * Navigation bridge for persisted scanner discoveries.
 *
 * The scanner passes only the canonical discovery coordinates in the URL.
 * This function does not create a second marker model: it locates the matching
 * cell in the already-rendered ColonyGrid and highlights that existing cell.
 * Grid dimensions are read from the live CSS grid instead of being assumed.
 */
function focusScannerDiscovery(): boolean {
  const params = new URLSearchParams(window.location.search)
  const rawFocus = params.get('focus')
  if (!rawFocus) return false

  const match = rawFocus.match(/^(\d+),(\d+)$/)
  if (!match) return false
  const row = Number(match[1])
  const col = Number(match[2])

  const scroller = document.querySelector('.grid-pan-container')
  if (!(scroller instanceof HTMLElement)) return false

  const grid = Array.from(scroller.querySelectorAll('div')).find(node => {
    if (!(node instanceof HTMLElement) || node.children.length === 0) return false
    return getComputedStyle(node).display === 'grid'
  })
  if (!(grid instanceof HTMLElement)) return false

  const columnTemplate = getComputedStyle(grid).gridTemplateColumns
  const columns = columnTemplate.split(/\s+/).filter(Boolean).length
  if (!columns || col >= columns) return false

  const index = row * columns + col
  const cell = grid.children.item(index)
  if (!(cell instanceof HTMLElement)) return false

  document.querySelectorAll('.noxia-scanner-focus').forEach(node => node.classList.remove('noxia-scanner-focus'))
  cell.classList.add('noxia-scanner-focus')

  const left = Math.max(0, cell.offsetLeft - scroller.clientWidth / 2 + cell.offsetWidth / 2)
  const top = Math.max(0, cell.offsetTop - scroller.clientHeight / 2 + cell.offsetHeight / 2)
  scroller.scrollTo({ left, top, behavior: 'smooth' })
  return true
}

export default function DashboardQuickChrome() {
  const [stats, setStats] = useState<Stats>({ trades: 0, flights: 0, knowledge: 0 })
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const [locationTargets, setLocationTargets] = useState<LocationTarget[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      try {
        const token = await getToken()
        if (!token) return
        const headers = { Authorization: `Bearer ${token}` }
        const [profileRes, knowledgeRes, tradesRes] = await Promise.all([
          fetch('/api/game/profile', { headers }),
          fetch('/api/game/knowledge', { headers }),
          fetch('/api/game/trade?action=getTrades', { headers }),
        ])
        const [profileData, knowledgeData, tradesData] = await Promise.all([
          profileRes.json(), knowledgeRes.json(), tradesRes.json(),
        ])
        if (cancelled) return
        setStats({
          trades: Array.isArray(tradesData?.trades) ? tradesData.trades.length : 0,
          flights: Number(profileData?.profile?.flight_count ?? 0),
          knowledge: Number(knowledgeData?.knowledge_points ?? 0),
        })
      } catch {
        // Dashboard bleibt auch ohne Zusatzwerte vollständig bedienbar.
      }
    }

    loadStats()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let raf = 0
    let focusDone = false
    const refreshTargets = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setHeaderTarget(findHeaderTarget())
        setLocationTargets(findLocationTargets())
        if (!focusDone) focusDone = focusScannerDiscovery()
      })
    }

    refreshTargets()
    const root = document.querySelector('.noxia-dashboard-shell')
    const observer = root ? new MutationObserver(refreshTargets) : null
    observer?.observe(root!, { childList: true, subtree: true })
    window.addEventListener('resize', refreshTargets)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', refreshTargets)
      document.querySelectorAll('.noxia-scanner-focus').forEach(node => node.classList.remove('noxia-scanner-focus'))
    }
  }, [])

  const statLabel = useMemo(
    () => `Handel ${stats.trades}, Flüge ${stats.flights}, Wissen ${stats.knowledge}`,
    [stats],
  )

  function openProfile() {
    const avatar = document.querySelector('.noxia-dashboard-shell > div > header button img[src*="/images/avatars/"]')
    const button = avatar?.closest('button')
    if (button instanceof HTMLButtonElement) button.click()
  }

  return (
    <>
      <style>{`
        @keyframes noxia-scanner-focus-pulse {
          0%,100% { outline-color: rgba(217,194,123,.65); }
          50% { outline-color: rgba(217,194,123,1); }
        }
        .noxia-scanner-focus {
          outline: 3px solid #d9c27b !important;
          outline-offset: -3px !important;
          z-index: 30 !important;
          animation: noxia-scanner-focus-pulse 1.25s ease-in-out infinite !important;
        }
        .noxia-scanner-focus::after {
          content: 'SCAN';
          position: absolute;
          top: 3px;
          right: 3px;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(8,19,26,.9);
          color: #f0d47c;
          font: 800 8px/1.4 monospace;
          letter-spacing: .08em;
          pointer-events: none;
        }
      `}</style>

      <DashboardPrimaryColony />

      {headerTarget && createPortal(
        <button
          type="button"
          className="noxia-profile-stats-compact"
          onClick={openProfile}
          aria-label={`${statLabel}. Vollprofil öffnen.`}
          title="Vollprofil & Kompetenzen"
        >
          <span><b>⚖</b>{stats.trades}</span>
          <span><b>🚀</b>{stats.flights}</span>
          <span><b>🧠</b>{stats.knowledge}</span>
        </button>,
        headerTarget,
      )}

      {locationTargets.map(({ node, name, src }) => createPortal(
        <span className="noxia-location-thumb" key={`${name}-${src}`} aria-hidden="true">
          <Image src={src} alt="" width={54} height={44} sizes="54px" />
        </span>,
        node,
      ))}
    </>
  )
}