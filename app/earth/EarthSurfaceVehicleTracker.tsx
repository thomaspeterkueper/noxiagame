'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { deriveSurfaceMissionProgress } from '@/lib/game/vehicles/surfaceProgress'

type TransportJob = {
  id: string
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  vehicle_role: string | null
  resource: string
  amount: number
  status: string
  route_snapshot?: Record<string, unknown> | null
  started_at?: string | null
  arrives_at?: string | null
  failure_code?: string | null
}

type Inventory = {
  id: string
  label: string
  inventory_kind: string
}

type LogisticsPayload = {
  ok?: boolean
  jobs?: TransportJob[]
  inventories?: Inventory[]
  error?: string
}

type SpatialPayload = {
  location?: { id: string }
  error?: string
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])

function formatDuration(seconds: number | null) {
  if (seconds == null) return '–'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function shortInventoryLabel(inventories: Inventory[], id: string) {
  return inventories.find(item => item.id === id)?.label ?? id.slice(0, 8)
}

export default function EarthSurfaceVehicleTracker() {
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let refreshTimer: number | null = null

    const load = async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const spatialResponse = await fetch('/api/game/build/spatial?location=earth', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        })
        const spatial = await spatialResponse.json() as SpatialPayload
        if (!spatialResponse.ok || !spatial.location?.id) throw new Error(spatial.error ?? 'Earth-Location nicht verfügbar')

        const response = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatial.location.id)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        })
        const payload = await response.json() as LogisticsPayload
        if (!response.ok) throw new Error(payload.error ?? 'Transportzustand konnte nicht geladen werden')
        if (cancelled) return
        setJobs(payload.jobs ?? [])
        setInventories(payload.inventories ?? [])
        setMessage(null)
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
      }
    }

    void load()
    refreshTimer = window.setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      if (refreshTimer != null) window.clearInterval(refreshTimer)
    }
  }, [])

  const activeJobs = useMemo(() => jobs.filter(job => ACTIVE.has(job.status)), [jobs])

  return <section className="surface-tracker">
    <header>
      <div>
        <small>EARTH VEHICLES · LIVE</small>
        <h2>Fahrzeuge unterwegs</h2>
        <p>Direkte Projektion der persistierten Core-Transportzeiten. Keine lokale Simulation.</p>
      </div>
      <b>{activeJobs.length}</b>
    </header>

    {message && <div className="notice">{message}</div>}
    {!message && !activeJobs.length && <div className="empty">Aktuell ist kein Earth-Surface-Transport aktiv.</div>}

    <div className="tracks">{activeJobs.map(job => {
      const progress = deriveSurfaceMissionProgress(job, now)
      const vehicle = job.vehicle_inventory_id
        ? shortInventoryLabel(inventories, job.vehicle_inventory_id).replace(/ · Fracht$/, '')
        : job.vehicle_role ?? 'Surface-Fahrzeug'
      const source = shortInventoryLabel(inventories, job.source_inventory_id)
      const destination = shortInventoryLabel(inventories, job.destination_inventory_id)
      const progressPercent = Math.round(progress.progress01 * 100)

      return <article key={job.id} className={`track ${progress.phase}`}>
        <div className="track-head">
          <div><strong>{vehicle}</strong><span>{job.amount} {job.resource}</span></div>
          <span className="phase">{job.status.replace('_', ' ')}</span>
        </div>
        <div className="route-label"><span>{source}</span><span>{destination}</span></div>
        <div className="rail" aria-label={`Fahrtfortschritt ${progressPercent}%`}>
          <div className="fill" style={{ width: `${progressPercent}%` }} />
          <div className="vehicle" style={{ left: `${progressPercent}%` }} aria-hidden="true">◆</div>
        </div>
        <div className="facts">
          <span><b>{progressPercent}%</b> Strecke</span>
          <span><b>{progress.travelledKm == null ? '–' : progress.travelledKm.toFixed(2)}</b> km gefahren</span>
          <span><b>{formatDuration(progress.remainingSeconds)}</b> verbleibend</span>
          <span><b>{job.arrives_at ? new Date(job.arrives_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'}</b> Ankunft</span>
        </div>
      </article>
    })}</div>

    <style jsx>{`
      .surface-tracker{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;font-family:system-ui,sans-serif}
      header{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:12px}header small{font-size:9px;letter-spacing:.16em;color:#d1ad55;font-weight:900}h2{font-family:Georgia,serif;font-weight:400;font-size:23px;margin:3px 0}header p{margin:0;color:#9fb0b5;font-size:10px}header>b{font-size:26px;color:#f0cc6c}.tracks{display:grid;gap:9px}.track{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px}.track.moving{border-color:#557a76}.track.arrived{border-color:#6d7c4a}.track-head,.route-label,.facts{display:flex;justify-content:space-between;gap:10px;align-items:center}.track-head strong{font-size:12px}.track-head div span{display:block;color:#95a8ad;font-size:8px;margin-top:2px}.phase{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#d8bf77}.route-label{font-size:8px;color:#8fa2a8;margin:10px 0 5px}.rail{height:8px;background:#0b202a;border:1px solid #35525d;border-radius:999px;position:relative;margin:0 6px}.fill{height:100%;border-radius:999px;background:#5e8175}.vehicle{position:absolute;top:50%;transform:translate(-50%,-50%);font-size:15px;color:#efc95f;text-shadow:0 0 8px #efc95f66;transition:left .8s linear}.facts{margin-top:9px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.facts span{font-size:8px;color:#8fa2a8;background:#0d2530;border-radius:6px;padding:6px}.facts b{display:block;color:#dfe7e4;font-size:10px}.empty,.notice{padding:10px;border-radius:7px;background:#173541;color:#9fb0b5;font-size:9px}.notice{background:#532f31;color:#f2d6d2}@media(max-width:760px){.facts{grid-template-columns:repeat(2,1fr)}.route-label{align-items:start;flex-direction:column}}
    `}</style>
  </section>
}
