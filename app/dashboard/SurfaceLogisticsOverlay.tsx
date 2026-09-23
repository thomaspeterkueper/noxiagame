'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type Inventory = {
  id: string
  label: string
  inventory_kind: string
  subject_type: string
  subject_id: string | null
}

type TransportJob = {
  id: string
  domain: string
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_role: string | null
  resource: string
  amount: number
  status: string
  started_at?: string | null
  arrives_at?: string | null
}

type Props = {
  locationSlug: string
  locationName: string
  onClose: () => void
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

export default function SurfaceLogisticsOverlay({ locationSlug, locationName, onClose }: Props) {
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const headers = { Authorization: `Bearer ${token}` }
        const spatialResponse = await fetch(`/api/game/build/spatial?location=${encodeURIComponent(locationSlug)}`, { headers, cache: 'no-store' })
        const spatial = await spatialResponse.json()
        if (!spatialResponse.ok || !spatial?.location?.id) throw new Error(spatial?.error ?? 'Standort nicht verfügbar')
        const logisticsResponse = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatial.location.id)}`, { headers, cache: 'no-store' })
        const logistics = await logisticsResponse.json()
        if (!logisticsResponse.ok) throw new Error(logistics?.error ?? 'Logistik nicht verfügbar')
        if (cancelled) return
        setInventories(Array.isArray(logistics.inventories) ? logistics.inventories : [])
        setJobs(Array.isArray(logistics.jobs) ? logistics.jobs : [])
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [locationSlug])

  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])
  const activeJobs = useMemo(() => jobs.filter(job => job.domain === 'surface' && ACTIVE.has(job.status)), [jobs])
  const fixedNodes = useMemo(() => inventories.filter(item => item.inventory_kind !== 'vehicle'), [inventories])

  return (
    <div className="logistics-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <section className="logistics-panel" aria-label={`Logistikzentrum ${locationName}`}>
        <header>
          <div><small>GEBÄUDE · LOGISTIKZENTRUM</small><h2>{locationName}</h2></div>
          <button type="button" onClick={onClose} aria-label="Logistikzentrum schließen">×</button>
        </header>

        <div className="logistics-summary">
          <div><b>{activeJobs.length}</b><span>aktive Transporte</span></div>
          <div><b>{fixedNodes.length}</b><span>Logistikknoten</span></div>
          <div><b>{jobs.length}</b><span>Transportaufträge gesamt</span></div>
        </div>

        {loading && <div className="state">Logistikdaten werden geladen …</div>}
        {error && <div className="state error">{error}</div>}

        {!loading && !error && <>
          <section className="block">
            <div className="block-head"><small>TRANSPORTE</small><strong>Aktive Oberflächenlogistik</strong></div>
            {!activeJobs.length && <div className="empty">Aktuell fährt kein Oberflächentransport.</div>}
            <div className="job-list">
              {activeJobs.map(job => <article key={job.id}>
                <div><strong>{job.vehicle_role ?? 'Surface-Fahrzeug'}</strong><span>{statusLabel(job.status)}</span></div>
                <b>{job.amount} {job.resource}</b>
                <p>{inventoryById.get(job.source_inventory_id)?.label ?? 'Quelle'} → {inventoryById.get(job.destination_inventory_id)?.label ?? 'Ziel'}</p>
              </article>)}
            </div>
          </section>

          <section className="block">
            <div className="block-head"><small>KNOTEN</small><strong>Lokale Lager- und Übergabepunkte</strong></div>
            <div className="node-grid">
              {fixedNodes.map(node => <article key={node.id}><strong>{node.label}</strong><span>{node.subject_type}</span></article>)}
            </div>
          </section>
        </>}
      </section>

      <style jsx>{`
        .logistics-overlay{position:fixed;inset:0;z-index:2450;display:grid;place-items:center;padding:1rem;background:rgba(2,7,12,.84);backdrop-filter:blur(5px)}
        .logistics-panel{width:min(980px,96vw);max-height:92vh;overflow:auto;border:1px solid #526b74;border-radius:14px;background:#f2f1e9;color:#1e3540;box-shadow:0 22px 70px rgba(0,0,0,.5)}
        header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 18px;background:#0d2935;color:#eef3ef;border-bottom:1px solid #34515c}
        header small,.block-head small{display:block;color:#d5b65d;font:800 9px/1.2 ui-monospace,monospace;letter-spacing:.13em}h2{margin:3px 0 0;font:400 24px/1.2 Georgia,serif}header button{border:0;background:transparent;color:#e5ecec;font-size:25px;cursor:pointer}
        .logistics-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 18px}.logistics-summary div{padding:12px;border:1px solid #cfd4cc;border-radius:9px;background:#faf9f2}.logistics-summary b{display:block;font-size:22px;color:#315968}.logistics-summary span{font-size:9px;color:#738085;text-transform:uppercase;letter-spacing:.08em}
        .block{padding:0 18px 18px}.block-head{margin-bottom:8px}.block-head strong{display:block;margin-top:2px;font-size:15px}.empty,.state{padding:13px;border:1px solid #d2d0c4;border-radius:8px;background:#faf9f2;color:#6f7c80;font-size:11px}.state{margin:0 18px 18px}.state.error{border-color:#c98d77;background:#f7e5dc;color:#7f4a35}
        .job-list{display:grid;gap:8px}.job-list article{padding:11px 12px;border:1px solid #d2d0c4;border-radius:8px;background:#fffdf7}.job-list article>div{display:flex;justify-content:space-between;gap:12px}.job-list article span{font-size:9px;color:#8b742f}.job-list article>b{display:block;margin-top:5px}.job-list article p{margin:4px 0 0;color:#718085;font-size:10px}
        .node-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.node-grid article{padding:10px 11px;border:1px solid #d2d0c4;border-radius:8px;background:#fffdf7}.node-grid strong,.node-grid span{display:block}.node-grid span{margin-top:3px;color:#7b878a;font-size:9px}
        @media(max-width:700px){.logistics-summary{grid-template-columns:1fr}.logistics-panel{width:98vw}}
      `}</style>
    </div>
  )
}
