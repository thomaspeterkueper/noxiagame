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
  energy?: Array<{ carrier?: string; stateOfCharge?: number; nominalKWh?: number }> | null
  modules?: string[] | null
  modifications?: { fleetRole?: FleetRole } | null
  emergent_state?: Record<string, unknown> | null
}
type FleetReadiness = { id: string; role: FleetRole; label: string; status: string; condition: number; wear: number; ready: boolean }
type PilotJob = { id: string; status: string; started_at?: string | null; completes_at?: string | null; result?: Record<string, any> | null }
type Props = { selectedRobotId?: string | null; onSelectedRobotChange?: (id: string | null) => void }

const ROLE_LABEL: Record<FleetRole, string> = { prospector: 'Prospektion', excavator: 'Aushub', hauler: 'Transport', maintenance: 'Wartung' }
const ROLE_TASK: Record<FleetRole, string> = {
  prospector: 'Spektrometer · GPR · Zielcharakterisierung',
  excavator: 'Ankern · Regolith lösen · Testabbau',
  hauler: 'Testmasse sichern · wiegen · zurückführen',
  maintenance: 'Inspektion · Werkzeugwechsel · Feldreparatur',
}
const statusLabel = (status: string) => status.replaceAll('_', ' ')

export default function PhobosRobotFleetPanel({ selectedRobotId = null, onSelectedRobotChange }: Props) {
  const [robots, setRobots] = useState<FleetRobot[]>([])
  const [readiness, setReadiness] = useState<FleetReadiness[]>([])
  const [jobs, setJobs] = useState<PilotJob[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const token = await getToken(); if (!token) return
    const response = await fetch('/api/game/phobos/pilot-extraction', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error ?? 'Robotikflotte nicht verfügbar.')
    setRobots(Array.isArray(payload.robots) ? payload.robots : [])
    setReadiness(Array.isArray(payload.fleetReadiness) ? payload.fleetReadiness : [])
    setJobs(Array.isArray(payload.jobs) ? payload.jobs : [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async()=>{try{await load();if(!cancelled)setError(null)}catch(err){if(!cancelled)setError(err instanceof Error?err.message:String(err))}finally{if(!cancelled)setLoading(false)}})()
    const interval=window.setInterval(()=>void load().catch(()=>{}),15000)
    return()=>{cancelled=true;window.clearInterval(interval)}
  },[load])

  const readinessById=useMemo(()=>new Map(readiness.map(item=>[item.id,item])),[readiness])
  const allReady=readiness.length===4&&readiness.every(item=>item.ready)
  const active=robots.some(robot=>['in_transit','loading','unloading','reserved'].includes(robot.status))
  const needsMaintenance=readiness.some(item=>!item.ready||item.wear>=35||item.condition<=80)
  const selected=robots.find(robot=>robot.id===selectedRobotId)??null
  const activeJob=jobs.find(job=>job.status==='running')??null
  const paused=activeJob?.result?.control_state==='paused'

  const maintainFleet=async()=>{
    setBusy(true);setMessage(null)
    try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const response=await fetch('/api/game/phobos/pilot-extraction',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'maintain-fleet'})});const payload=await response.json();if(!response.ok)throw new Error(payload?.error??'Flottenwartung fehlgeschlagen.');setMessage('Wartungszyklus abgeschlossen · 8 Energie und 1 Komponente verbraucht.');await load()}catch(err){setMessage(err instanceof Error?err.message:String(err))}finally{setBusy(false)}
  }
  const control=async(action:'pause'|'resume'|'recall'|'request-maintenance')=>{
    setBusy(true);setMessage(null)
    try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const response=await fetch('/api/game/phobos/robot-control',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,robotId:selected?.id})});const payload=await response.json();if(!response.ok)throw new Error(payload?.error??'Befehl fehlgeschlagen.');setMessage(action==='pause'?'Einsatz pausiert.':action==='resume'?'Einsatz fortgesetzt.':action==='recall'?'Flotte zurückgerufen · Versuch ohne Ergebnis beendet.':'Wartung für diese Maschine vorgemerkt.');await load()}catch(err){setMessage(err instanceof Error?err.message:String(err))}finally{setBusy(false)}
  }

  const selectedRole=(selected?.modifications?.fleetRole??'excavator') as FleetRole
  const battery=selected?.energy?.[0]
  const soc=Math.round(Math.max(0,Math.min(1,Number(battery?.stateOfCharge??0)))*100)
  const phase=String(selected?.emergent_state?.phase??selected?.emergent_state?.duty??'Bereit')
  const xM=Number(selected?.emergent_state?.xM),yM=Number(selected?.emergent_state?.yM)

  return <aside className="fleet-panel" aria-label="Stickney Robotikflotte">
    <header><div><small>STICKNEY · ROBOTIKFLOTTE</small><strong>{allReady?'4/4 einsatzbereit':`${readiness.filter(item=>item.ready).length}/4 einsatzbereit`}</strong></div><span className={allReady?'fleet-state ready':'fleet-state'}>{activeJob?(paused?'Einsatz pausiert':'Einsatz läuft'):allReady?'Bereit':'Prüfung/Wartung'}</span></header>
    {loading&&<p className="state">Flottenstatus wird geladen …</p>}{error&&<p className="state error">{error}</p>}
    {!loading&&!error&&<div className="robot-grid">{robots.map(robot=>{const status=readinessById.get(robot.id),role=(status?.role??robot.modifications?.fleetRole??'excavator') as FleetRole,chosen=robot.id===selectedRobotId;return <button key={robot.id} className={`${status?.ready?'robot-card ready':'robot-card'} ${chosen?'selected':''}`} onClick={()=>onSelectedRobotChange?.(chosen?null:robot.id)}><div className="robot-head"><b>{ROLE_LABEL[role]}</b><span>{statusLabel(robot.status)}</span></div><strong>{robot.label}</strong><p>{ROLE_TASK[role]}</p><div className="metrics"><span><i style={{width:`${Math.max(0,Math.min(100,Number(robot.condition??0)))}%`}}/><em>Zustand {Math.round(Number(robot.condition??0))}%</em></span><span className="wear"><i style={{width:`${Math.max(0,Math.min(100,Number(robot.wear??0)))}%`}}/><em>Verschleiß {Math.round(Number(robot.wear??0))}%</em></span></div></button>})}</div>}

    {selected&&<section className="robot-detail"><div className="detail-head"><div><small>{ROLE_LABEL[selectedRole].toUpperCase()}</small><strong>{selected.label}</strong></div><button onClick={()=>onSelectedRobotChange?.(null)}>×</button></div><div className="facts"><span><em>Status</em><b>{statusLabel(selected.status)}</b></span><span><em>Batterie</em><b>{soc}%{battery?.nominalKWh?` · ${battery.nominalKWh} kWh`:''}</b></span><span><em>Aktueller Auftrag</em><b>{phase.replaceAll('-',' ')}</b></span><span><em>Position</em><b>{Number.isFinite(xM)&&Number.isFinite(yM)?`${Math.round(xM)} m E · ${Math.round(yM)} m N`:'Rover Yard'}</b></span><span><em>Frame</em><b>{selected.frame_id}</b></span><span><em>Rollenbindung</em><b>{ROLE_LABEL[selectedRole]} · hardwaregebunden</b></span></div><div className="modules"><em>Module</em><div>{(selected.modules??[]).map(module=><span key={module}>{module.replaceAll('-',' ')}</span>)}</div></div><div className="commands">{activeJob&&<button disabled={busy} onClick={()=>void control(paused?'resume':'pause')}>{paused?'Fortsetzen':'Pause'}</button>}{activeJob&&<button className="danger" disabled={busy} onClick={()=>void control('recall')}>Rückruf</button>}<button disabled={busy} onClick={()=>void control('request-maintenance')}>Wartung anfordern</button><button disabled title="Rollenwechsel ist nur nach kompatiblem Modulumbau vorgesehen.">Rolle wechseln</button></div><p className="role-note">Rollenwechsel bleibt gesperrt, solange die erforderlichen Module nicht physisch umgebaut wurden.</p></section>}

    <footer><button disabled={busy||active||!robots.length||!needsMaintenance} onClick={maintainFleet}>{busy?'Wartung läuft …':'Flotte warten'}</button><span>Wartung: 8 Energie · 1 Komponente</span></footer>{message&&<p className="message">{message}</p>}
    <style jsx>{`
      .fleet-panel{position:fixed;z-index:3;right:18px;top:calc(var(--noxia-topbar-h,44px) + 16px);width:min(620px,calc(100vw - 36px));max-height:calc(100dvh - var(--noxia-topbar-h,44px) - 32px);overflow:auto;padding:12px;border:1px solid rgba(203,190,168,.22);border-radius:10px;background:rgba(14,12,10,.88);backdrop-filter:blur(10px);color:#e7ddd0;font:11px/1.3 system-ui,sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.28)}header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}header div{display:grid;gap:2px}header small,.robot-detail small{font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#d99a4e}header strong{font-size:13px}.fleet-state{padding:4px 7px;border:1px solid rgba(219,169,91,.35);border-radius:999px;color:#d7b375;font-size:9px}.fleet-state.ready{border-color:rgba(122,182,148,.4);color:#8fc7a3}.robot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.robot-card{appearance:none;text-align:left;color:inherit;padding:9px;border:1px solid rgba(210,200,182,.14);border-radius:8px;background:rgba(255,255,255,.035);cursor:pointer}.robot-card.ready{border-color:rgba(119,170,142,.28)}.robot-card.selected{border-color:#d99a4e;background:rgba(217,154,78,.09)}.robot-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}.robot-head b{color:#d9a864;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.robot-head span{font-size:8px;color:#a99d8c}.robot-card>strong{display:block;font-size:10px}.robot-card p{margin:4px 0 7px;color:#9f9384;font-size:9px}.metrics{display:grid;gap:5px}.metrics span{position:relative;height:13px;overflow:hidden;border-radius:4px;background:rgba(255,255,255,.06)}.metrics i{position:absolute;inset:0 auto 0 0;background:rgba(107,161,135,.42)}.metrics .wear i{background:rgba(190,137,76,.42)}.metrics em{position:relative;z-index:1;display:block;padding:1px 4px;font-style:normal;font-size:8px;color:#ded5c8}.robot-detail{margin-top:10px;padding:10px;border:1px solid rgba(217,154,78,.25);border-radius:9px;background:rgba(5,9,11,.45)}.detail-head{display:flex;justify-content:space-between;gap:12px}.detail-head>div{display:grid;gap:2px}.detail-head button{border:0;background:none;color:#c9b9a5;font-size:18px;cursor:pointer}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}.facts span{display:grid;gap:2px;padding:6px;background:rgba(255,255,255,.035);border-radius:6px}.facts em,.modules>em{font-style:normal;font-size:8px;color:#8f8477}.facts b{font-size:9px;font-weight:650}.modules{margin-top:8px}.modules>div{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.modules span{padding:3px 5px;border-radius:999px;background:rgba(105,145,153,.15);color:#9cc2c7;font-size:8px}.commands{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.commands button,footer button{border:1px solid rgba(213,169,98,.45);border-radius:7px;background:rgba(124,86,43,.38);color:#f0dbc1;padding:7px 10px;font:700 9px/1 system-ui;cursor:pointer}.commands .danger{border-color:rgba(195,104,83,.45);background:rgba(111,48,37,.38)}button:disabled{opacity:.4;cursor:not-allowed}.role-note{margin:7px 0 0;color:#857a6e;font-size:8px}.state,.message{margin:8px 0;padding:7px;border-radius:6px;background:rgba(255,255,255,.05);color:#bdb1a2}.state.error{color:#e2a58b}.message{margin-bottom:0;color:#cbbd9e}footer{display:flex;align-items:center;gap:10px;margin-top:10px}footer span{font-size:8px;color:#8f8477}@media(max-width:700px){.fleet-panel{top:calc(var(--noxia-topbar-h,44px) + 8px);right:8px;width:calc(100vw - 16px)}.robot-grid,.facts{grid-template-columns:1fr}}
    `}</style>
  </aside>
}
