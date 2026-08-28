'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getToken } from '@/lib/supabase/auth'

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
    const refreshTargets = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setHeaderTarget(findHeaderTarget())
        setLocationTargets(findLocationTargets())
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
