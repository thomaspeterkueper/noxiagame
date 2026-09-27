'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type FleetRole = 'prospector' | 'excavator' | 'hauler' | 'maintenance'
type FleetRobot = {
  id: string
  frame_id: string
  label: string
  status: string
  condition: number
  wear: number
  modifications?: { fleetRole?: FleetRole } | null
}

type FleetReadiness = {
  id: string
  role: FleetRole
  label: string
  status: string
  condition: number
  wear: number
  ready: boolean
}

const ROLE_LABEL: Record<FleetRole, string> = {
  prospector: 'Prospektion',
  excavator: 'Aushub',
  hauler: 'Transport',
  maintenance: 'Wartung',
}

const ROLE_TASK: Record<FleetRole, string> = {
  prospector: 'Spektrometer · GPR · Zielcharakterisierung',
  excavator: 'Ankern · Regolith lösen · Testabbau',
  hauler: 'Testmasse sichern · wiegen · zurückführen',
  maintenance: 'Inspektion · Werkzeugwechsel · Feldreparatur',
}

const statusLabel = (status: string) => status.replaceAll('_', ' ')

export default function PhobosRobotFleetPanel() {
  const [robots, setRobots] = useState<FleetRobot[]>([])
  const [readiness, setReadiness] = useState<FleetReadiness[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const response = await fetch('/api/game/phobos/pilot-extraction', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error ?? 'Robotikflotte nicht verfügbar.')
    setRobots(Array.isArray(payload.robots) ? payload.robots : [])
    setReadiness(Array.isArray(payload.fleetReadiness) ? payload.fleetReadiness : [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
        if (!cancelled) setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    const interval = window.setInterval(() => { void load().catch(() => {}) }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [load])

  const readinessById = useMemo(() => new Map(readiness.map(item => [item.id, item])), [readiness])
  const allReady = readiness.length === 4 && readiness.every(item => item.ready)
  const active = robots.some(robot => ['in_transit', 'loading', 'unloading', 'reserved'].includes(robot.status))
  const needsMaintenance = readiness.some(item => !item.ready || item.wear >= 35 || item.condition <= 80)

  const maintainFleet = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/phobos/pilot-extraction', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'maintain-fleet' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? 'Flottenwartung fehlgeschlagen.')
      setMessage('Wartungszyklus abgeschlossen · 8 Energie und 1 Komponente verbraucht.')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return <aside className="fleet-panel" aria-label="Stickney Robotikflotte">
    <header>
      <div><small>STICKNEY · ROBOTIKFLOTTE</small><strong>{allReady ? '4/4 einsatzbereit' : `${readiness.filter(item => item.ready).length}/4 einsatzbereit`}</strong></div>
      <span className={allReady ? 'fleet-state ready' : 'fleet-state'}>{active ? 'Einsatz läuft' : allReady ? 'Bereit' : 'Prüfung/Wartung'}</span>
    </header>

    {loading && <p className="state">Flottenstatus wird geladen …</p>}
    {error && <p className="state error">{error}</p>}

    {!loading && !error && <div className="robot-grid">
      {robots.map(robot => {
        const status = readinessById.get(robot.id)
        const role = (status?.role ?? robot.modifications?.fleetRole ?? 'excavator') as FleetRole
        return <article key={robot.id} className={status?.ready ? 'robot-card ready' : 'robot-card'}>
          <div className="robot-head"><b>{ROLE_LABEL[role]}</b><span>{statusLabel(robot.status)}</span></div>
          <strong>{robot.label}</strong>
          <p>{ROLE_TASK[role]}</p>
          <div className="metrics">
            <span><i style={{ width: `${Math.max(0, Math.min(100, Number(robot.condition ?? 0)))}%` }}/><em>Zustand {Math.round(Number(robot.condition ?? 0))}%</em></span>
            <span className="wear"><i style={{ width: `${Math.max(0, Math.min(100, Number(robot.wear ?? 0)))}%` }}/><em>Verschleiß {Math.round(Number(robot.wear ?? 0))}%</em></span>
          </div>
        </article>
      })}
    </div>}

    <footer>
      <button disabled={busy || active || !robots.length || !needsMaintenance} onClick={maintainFleet}>{busy ? 'Wartung läuft …' : 'Flotte warten'}</button>
      <span>Wartung: 8 Energie · 1 Komponente</span>
    </footer>
    {message && <p className="message">{message}</p>}

    <style jsx>{`
      .fleet-panel{position:fixed;z-index:3;right:18px;top:calc(var(--noxia-topbar-h,44px) + 16px);width:min(560px,calc(100vw - 36px));padding:12px;border:1px solid rgba(203,190,168,.22);border-radius:10px;background:rgba(14,12,10,.86);backdrop-filter:blur(10px);color:#e7ddd0;font:11px/1.3 system-ui,sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.28)}
      header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}header div{display:grid;gap:2px}header small{font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#d99a4e}header strong{font-size:13px}.fleet-state{padding:4px 7px;border:1px solid rgba(219,169,91,.35);border-radius:999px;color:#d7b375;font-size:9px}.fleet-state.ready{border-color:rgba(122,182,148,.4);color:#8fc7a3}.robot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.robot-card{padding:9px;border:1px solid rgba(210,200,182,.14);border-radius:8px;background:rgba(255,255,255,.035)}.robot-card.ready{border-color:rgba(119,170,142,.28)}.robot-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}.robot-head b{color:#d9a864;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.robot-head span{font-size:8px;color:#a99d8c}.robot-card>strong{display:block;font-size:10px}.robot-card p{margin:4px 0 7px;color:#9f9384;font-size:9px}.metrics{display:grid;gap:5px}.metrics span{position:relative;height:13px;overflow:hidden;border-radius:4px;background:rgba(255,255,255,.06)}.metrics i{position:absolute;inset:0 auto 0 0;background:rgba(107,161,135,.42)}.metrics .wear i{background:rgba(190,137,76,.42)}.metrics em{position:relative;z-index:1;display:block;padding:1px 4px;font-style:normal;font-size:8px;color:#ded5c8}.state,.message{margin:8px 0;padding:7px;border-radius:6px;background:rgba(255,255,255,.05);color:#bdb1a2}.state.error{color:#e2a58b}.message{margin-bottom:0;color:#cbbd9e}footer{display:flex;align-items:center;gap:10px;margin-top:10px}footer button{border:1px solid rgba(213,169,98,.45);border-radius:7px;background:rgba(124,86,43,.38);color:#f0dbc1;padding:7px 10px;font:700 9px/1 system-ui;cursor:pointer}footer button:disabled{opacity:.4;cursor:not-allowed}footer span{font-size:8px;color:#8f8477}@media(max-width:700px){.fleet-panel{top:calc(var(--noxia-topbar-h,44px) + 8px);right:8px;width:calc(100vw - 16px)}.robot-grid{grid-template-columns:1fr}}
    `}</style>
  </aside>
}
