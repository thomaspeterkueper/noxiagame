'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import {
  ROBOT_FLEET_ROLES,
  ROBOT_MODULE_DEFINITIONS,
  ROBOT_RETROFIT_PROFILES,
  replaceableRobotModules,
  type RobotFleetRole as FleetRole,
} from '@/lib/game/vehicles/robotRetrofit'

type FleetRobot = {
  id: string
  frame_id: string
  label: string
  status: string
  condition: number
  wear: number
  cargo_capacity_t?: number | null
  energy?: Array<{ carrier?: string; stateOfCharge?: number; nominalKWh?: number }> | null
  modules?: string[] | null
  modifications?: { fleetRole?: FleetRole; dryMassKg?: number; peakPowerKw?: number; capabilities?: string[] } | null
  emergent_state?: Record<string, unknown> | null
}
type FleetReadiness = { id: string; role: FleetRole; label: string; status: string; condition: number; wear: number; ready: boolean }
type PilotJob = { id: string; status: string; result?: Record<string, any> | null }
type EquipmentItem = { id: string; equipment_key: string; serial_number: string; status: string; condition: number; wear: number; metadata?: Record<string, unknown> | null }
type RetrofitData = {
  profiles: typeof ROBOT_RETROFIT_PROFILES[ FleetRole ][]
  workshop: { id: string; label: string; available: Record<string, number>; equipment: EquipmentItem[] }
  installedEquipment: EquipmentItem[]
}
type Props = { selectedRobotId?: string | null; onSelectedRobotChange?: (id: string | null) => void }

const ROLE_LABEL: Record<FleetRole, string> = { prospector: 'Prospektion', excavator: 'Aushub', hauler: 'Transport', maintenance: 'Wartung' }
const ROLE_TASK: Record<FleetRole, string> = {
  prospector: 'Spektrometer · GPR · Zielcharakterisierung',
  excavator: 'Ankern · Regolith lösen · Testabbau',
  hauler: 'Testmasse sichern · wiegen · zurückführen',
  maintenance: 'Inspektion · Werkzeugwechsel · Feldreparatur',
}
const statusLabel = (status: string) => status.replaceAll('_', ' ')
const moduleLabel = (key: string) => ROBOT_MODULE_DEFINITIONS[key]?.label ?? key.replaceAll('-', ' ')

export default function PhobosRobotFleetPanel({ selectedRobotId = null, onSelectedRobotChange }: Props) {
  const [robots, setRobots] = useState<FleetRobot[]>([])
  const [readiness, setReadiness] = useState<FleetReadiness[]>([])
  const [jobs, setJobs] = useState<PilotJob[]>([])
  const [retrofitData, setRetrofitData] = useState<RetrofitData | null>(null)
  const [retrofitOpen, setRetrofitOpen] = useState(false)
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

  const loadRetrofit = useCallback(async (robotId: string) => {
    const token = await getToken(); if (!token) return
    const response = await fetch(`/api/game/vehicles/retrofit?robotId=${encodeURIComponent(robotId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error ?? 'Werkstattdaten nicht verfügbar.')
    setRetrofitData(payload as RetrofitData)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async()=>{try{await load();if(!cancelled)setError(null)}catch(err){if(!cancelled)setError(err instanceof Error?err.message:String(err))}finally{if(!cancelled)setLoading(false)}})()
    const interval = window.setInterval(() => void load().catch(() => {}), 15000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [load])

  useEffect(() => {
    setRetrofitOpen(false)
    setRetrofitData(null)
    if (selectedRobotId) void loadRetrofit(selectedRobotId).catch(() => {})
  }, [selectedRobotId, loadRetrofit])

  const readinessById = useMemo(() => new Map(readiness.map(item => [item.id, item])), [readiness])
  const roleCounts = useMemo(() => readiness.reduce((acc,item) => { acc[item.role] = (acc[item.role] ?? 0) + 1; return acc }, {} as Partial<Record<FleetRole,number>>), [readiness])
  const roleComplete = ROBOT_FLEET_ROLES.every(role => (roleCounts[role] ?? 0) >= 1)
  const allReady = readiness.length === 4 && readiness.every(item => item.ready) && roleComplete
  const active = robots.some(robot => ['in_transit','loading','unloading','reserved'].includes(robot.status))
  const needsMaintenance = readiness.some(item => !item.ready || item.wear >= 35 || item.condition <= 80)
  const selected = robots.find(robot => robot.id === selectedRobotId) ?? null
  const activeJob = jobs.find(job => job.status === 'running') ?? null
  const paused = activeJob?.result?.control_state === 'paused'

  const maintainFleet = async () => {
    setBusy(true); setMessage(null)
    try {
      const token=await getToken(); if(!token) throw new Error('Nicht angemeldet')
      const response=await fetch('/api/game/phobos/pilot-extraction',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'maintain-fleet'})})
      const payload=await response.json(); if(!response.ok) throw new Error(payload?.error??'Flottenwartung fehlgeschlagen.')
      setMessage('Wartungszyklus abgeschlossen · 8 Energie und 1 Komponente verbraucht.'); await load()
    } catch(err) { setMessage(err instanceof Error?err.message:String(err)) } finally { setBusy(false) }
  }

  const control = async (action:'pause'|'resume'|'recall'|'request-maintenance') => {
    setBusy(true); setMessage(null)
    try {
      const token=await getToken(); if(!token) throw new Error('Nicht angemeldet')
      const response=await fetch('/api/game/phobos/robot-control',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,robotId:selected?.id})})
      const payload=await response.json(); if(!response.ok) throw new Error(payload?.error??'Befehl fehlgeschlagen.')
      setMessage(action==='pause'?'Einsatz pausiert.':action==='resume'?'Einsatz fortgesetzt.':action==='recall'?'Flotte zurückgerufen · Versuch ohne Ergebnis beendet.':'Wartung für diese Maschine vorgemerkt.')
      await load()
    } catch(err) { setMessage(err instanceof Error?err.message:String(err)) } finally { setBusy(false) }
  }

  const retrofit = async (targetRole:FleetRole) => {
    if(!selected) return
    setBusy(true); setMessage(null)
    try {
      const token=await getToken(); if(!token) throw new Error('Nicht angemeldet')
      const response=await fetch('/api/game/vehicles/retrofit',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({robotId:selected.id,locationSlug:'phobos',targetRole})})
      const payload=await response.json(); if(!response.ok) throw new Error(payload?.error??'Modulumbau fehlgeschlagen.')
      const p=ROBOT_RETROFIT_PROFILES[targetRole]
      setMessage(`Umbau abgeschlossen: ${ROLE_LABEL[targetRole]} · ${p.energyCost} Energie · ${p.componentCost} Komponenten.`)
      await Promise.all([load(),loadRetrofit(selected.id)])
    } catch(err) { setMessage(err instanceof Error?err.message:String(err)) } finally { setBusy(false) }
  }

  const repairModule = async (item: EquipmentItem) => {
    if(!selected) return
    setBusy(true); setMessage(null)
    try {
      const token=await getToken(); if(!token) throw new Error('Nicht angemeldet')
      const response=await fetch('/api/game/vehicles/equipment',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'repair',equipmentId:item.id})})
      const payload=await response.json(); if(!response.ok) throw new Error(payload?.error??'Modulreparatur fehlgeschlagen.')
      setMessage(`${moduleLabel(item.equipment_key)} ${item.serial_number} repariert.`)
      await loadRetrofit(selected.id)
    } catch(err) { setMessage(err instanceof Error?err.message:String(err)) } finally { setBusy(false) }
  }

  const selectedRole = (selected?.modifications?.fleetRole ?? 'excavator') as FleetRole
  const selectedProfile = ROBOT_RETROFIT_PROFILES[selectedRole]
  const battery = selected?.energy?.[0]
  const soc = Math.round(Math.max(0,Math.min(1,Number(battery?.stateOfCharge??0)))*100)
  const phase = String(selected?.emergent_state?.phase ?? selected?.emergent_state?.duty ?? 'Bereit')
  const xM=Number(selected?.emergent_state?.xM), yM=Number(selected?.emergent_state?.yM)
  const installedEquipment = retrofitData?.installedEquipment ?? []
  const workshopEquipment = retrofitData?.workshop?.equipment ?? []
  const available = retrofitData?.workshop?.available ?? {}
  const currentReplaceable = new Set(replaceableRobotModules(selected?.modules))

  return <aside className="fleet-panel" aria-label="Stickney Robotikflotte">
    <header><div><small>STICKNEY · ROBOTIKFLOTTE</small><strong>{allReady?'4/4 Rollen einsatzbereit':roleComplete?`${readiness.filter(item=>item.ready).length}/4 Maschinen bereit`:'Rollenkonfiguration unvollständig'}</strong></div><span className={allReady?'fleet-state ready':'fleet-state'}>{activeJob?(paused?'Einsatz pausiert':'Einsatz läuft'):allReady?'Bereit':'Umbau/Wartung'}</span></header>
    {loading&&<p className="state">Flottenstatus wird geladen …</p>}{error&&<p className="state error">{error}</p>}
    {!loading&&!error&&<div className="robot-grid">{robots.map(robot=>{const status=readinessById.get(robot.id),role=(status?.role??robot.modifications?.fleetRole??'excavator') as FleetRole,chosen=robot.id===selectedRobotId;return <button key={robot.id} className={`${status?.ready?'robot-card ready':'robot-card'} ${chosen?'selected':''}`} onClick={()=>onSelectedRobotChange?.(chosen?null:robot.id)}><div className="robot-head"><b>{ROLE_LABEL[role]}</b><span>{statusLabel(robot.status)}</span></div><strong>{robot.label}</strong><p>{ROLE_TASK[role]}</p><div className="metrics"><span><i style={{width:`${Math.max(0,Math.min(100,Number(robot.condition??0)))}%`}}/><em>Zustand {Math.round(Number(robot.condition??0))}%</em></span><span className="wear"><i style={{width:`${Math.max(0,Math.min(100,Number(robot.wear??0)))}%`}}/><em>Verschleiß {Math.round(Number(robot.wear??0))}%</em></span></div></button>})}</div>}

    {selected&&<section className="robot-detail">
      <div className="detail-head"><div><small>{ROLE_LABEL[selectedRole].toUpperCase()}</small><strong>{selected.label}</strong></div><button onClick={()=>onSelectedRobotChange?.(null)}>×</button></div>
      <div className="facts"><span><em>Status</em><b>{statusLabel(selected.status)}</b></span><span><em>Batterie</em><b>{soc}% · {battery?.nominalKWh??selectedProfile.batteryKWh} kWh</b></span><span><em>Aktueller Auftrag</em><b>{phase.replaceAll('-',' ')}</b></span><span><em>Position</em><b>{Number.isFinite(xM)&&Number.isFinite(yM)?`${Math.round(xM)} m E · ${Math.round(yM)} m N`:'Rover Yard'}</b></span><span><em>Trockenmasse</em><b>{selected.modifications?.dryMassKg??selectedProfile.dryMassKg} kg</b></span><span><em>Spitzenleistung</em><b>{selected.modifications?.peakPowerKw??selectedProfile.peakPowerKw} kW</b></span><span><em>Cargo</em><b>{Number(selected.cargo_capacity_t??selectedProfile.cargoCapacityT).toFixed(1)} t</b></span><span><em>Frame</em><b>{selected.frame_id}</b></span></div>
      <div className="modules"><em>Eingebaute Arbeitsmodule</em>{installedEquipment.length?<div className="equipment-list">{installedEquipment.map(item=><span key={item.id}><b>{moduleLabel(item.equipment_key)}</b><small>{item.serial_number} · Zustand {item.condition}% · Verschleiß {item.wear}%</small></span>)}</div>:<p>Noch nicht serialisiert · beim ersten physischen Umbau wird die bestehende Hardware registriert.</p>}</div>
      <div className="commands">{activeJob&&<button disabled={busy} onClick={()=>void control(paused?'resume':'pause')}>{paused?'Fortsetzen':'Pause'}</button>}{activeJob&&<button className="danger" disabled={busy} onClick={()=>void control('recall')}>Rückruf</button>}<button disabled={busy} onClick={()=>void control('request-maintenance')}>Wartung anfordern</button><button disabled={busy||Boolean(activeJob)||!['ready','configuration'].includes(selected.status)} onClick={()=>setRetrofitOpen(v=>!v)}>Module umbauen</button></div>

      {retrofitOpen&&<div className="retrofit">
        <div className="retrofit-title"><b>Surface Workshop · physisches Modullager</b><span>Einbau nur aus tatsächlich verfügbarem Equipment</span></div>
        {ROBOT_FLEET_ROLES.map(role=>{const p=ROBOT_RETROFIT_PROFILES[role],current=role===selectedRole,targetKeys=replaceableRobotModules(p.modules),missing=targetKeys.filter(key=>!currentReplaceable.has(key)&&(available[key]??0)<1);return <button key={role} disabled={busy||current||missing.length>0} onClick={()=>void retrofit(role)}><div><strong>{ROLE_LABEL[role]}{current?' · aktuell':''}</strong><span>{p.dryMassKg} kg · {p.peakPowerKw} kW · {p.batteryKWh} kWh · Cargo {p.cargoCapacityT} t</span><small>{targetKeys.map(key=>`${moduleLabel(key)}${currentReplaceable.has(key)?' · eingebaut':` · Lager ${available[key]??0}`}`).join(' | ')}</small>{missing.length>0&&<small className="missing">Fehlt: {missing.map(moduleLabel).join(', ')}</small>}</div><em>{current?'installiert':missing.length?'nicht verfügbar':`${p.energyCost} E · ${p.componentCost} K`}</em></button>})}
        <div className="workshop-stock"><b>Werkstattbestand · {retrofitData?.workshop?.label??'wird geladen'}</b>{workshopEquipment.length===0?<p>Kein Equipment eingelagert.</p>:workshopEquipment.map(item=>{const def=ROBOT_MODULE_DEFINITIONS[item.equipment_key],needsRepair=item.condition<100||item.wear>0;return <div key={item.id}><span><strong>{moduleLabel(item.equipment_key)}</strong><small>{item.serial_number} · Zustand {item.condition}% · Verschleiß {item.wear}%</small></span>{needsRepair&&def?<button disabled={busy} onClick={()=>void repairModule(item)}>Reparieren · {def.repairEnergyCost} E · {def.repairComponentCost} K</button>:<em>einsatzbereit</em>}</div>})}</div>
        <p>Ausgebaute Module bleiben als serialisierte Einzelteile im Lager. Fertigung neuer Module bleibt bis zur Anbindung an Technologie- und Produktionspfade gesperrt.</p>
      </div>}
    </section>}

    <footer><button disabled={busy||active||!robots.length||!needsMaintenance} onClick={maintainFleet}>{busy?'Wartung läuft …':'Flotte warten'}</button><span>Fahrzeugwartung: 8 Energie · 1 Komponente</span></footer>{message&&<p className="message">{message}</p>}
    <style jsx>{`
      .fleet-panel{position:fixed;z-index:3;right:18px;top:calc(var(--noxia-topbar-h,44px) + 16px);width:min(680px,calc(100vw - 36px));max-height:calc(100dvh - var(--noxia-topbar-h,44px) - 32px);overflow:auto;padding:12px;border:1px solid rgba(203,190,168,.22);border-radius:10px;background:rgba(14,12,10,.9);backdrop-filter:blur(10px);color:#e7ddd0;font:11px/1.3 system-ui,sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.28)}header,.detail-head,footer{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}header{margin-bottom:10px}header div,.detail-head>div{display:grid;gap:2px}header small,.robot-detail small{font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:#d99a4e}header strong{font-size:13px}.fleet-state{padding:4px 7px;border:1px solid rgba(219,169,91,.35);border-radius:999px;color:#d7b375;font-size:9px}.fleet-state.ready{border-color:rgba(122,182,148,.4);color:#8fc7a3}.robot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.robot-card{appearance:none;text-align:left;color:inherit;padding:9px;border:1px solid rgba(210,200,182,.14);border-radius:8px;background:rgba(255,255,255,.035);cursor:pointer}.robot-card.ready{border-color:rgba(119,170,142,.28)}.robot-card.selected{border-color:#d99a4e;background:rgba(217,154,78,.09)}.robot-head{display:flex;justify-content:space-between;gap:8px}.robot-head b{color:#d9a864;font-size:9px;text-transform:uppercase}.robot-head span,.robot-card p{font-size:8px;color:#9f9384}.metrics{display:grid;gap:4px}.metrics span{position:relative;height:13px;overflow:hidden;border-radius:4px;background:rgba(255,255,255,.06)}.metrics i{position:absolute;inset:0 auto 0 0;background:rgba(107,161,135,.42)}.metrics .wear i{background:rgba(190,137,76,.42)}.metrics em{position:relative;z-index:1;padding:1px 4px;font-style:normal;font-size:8px}.robot-detail{margin-top:10px;padding:10px;border:1px solid rgba(217,154,78,.25);border-radius:9px;background:rgba(5,9,11,.45)}.detail-head button{border:0;background:none;color:#c9b9a5;font-size:18px;cursor:pointer}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}.facts span{display:grid;gap:2px;padding:6px;background:rgba(255,255,255,.035);border-radius:6px}.facts em,.modules>em{font-style:normal;font-size:8px;color:#8f8477}.facts b{font-size:9px}.modules{margin-top:8px}.modules p,.retrofit p,.workshop-stock p{margin:5px 0;color:#8f8477;font-size:8px}.equipment-list{display:grid;gap:4px;margin-top:4px}.equipment-list>span{display:grid;padding:5px;border-radius:6px;background:rgba(105,145,153,.1)}.equipment-list small{color:#8fb0b5}.commands{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.commands button,footer button,.retrofit button,.workshop-stock button{border:1px solid rgba(213,169,98,.45);border-radius:7px;background:rgba(124,86,43,.38);color:#f0dbc1;padding:7px 10px;font:700 9px/1 system-ui;cursor:pointer}.commands .danger{border-color:rgba(195,104,83,.45);background:rgba(111,48,37,.38)}button:disabled{opacity:.4;cursor:not-allowed}.retrofit{display:grid;gap:6px;margin-top:9px;padding:8px;border-radius:8px;background:rgba(217,154,78,.05)}.retrofit-title{display:flex;justify-content:space-between;gap:8px}.retrofit-title span{font-size:8px;color:#8f8477}.retrofit>button{display:flex;justify-content:space-between;gap:12px;text-align:left}.retrofit>button div{display:grid;gap:2px}.retrofit>button span,.retrofit>button small{font-weight:400;color:#a99d8c}.retrofit>button .missing{color:#e0a28b}.retrofit>button em{font-style:normal;white-space:nowrap}.workshop-stock{display:grid;gap:5px;margin-top:5px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08)}.workshop-stock>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px;border-radius:6px;background:rgba(255,255,255,.025)}.workshop-stock span{display:grid}.workshop-stock small{color:#8f9da1}.workshop-stock em{font-style:normal;font-size:8px;color:#8fc7a3}.state,.message{margin:8px 0;padding:7px;border-radius:6px;background:rgba(255,255,255,.05);color:#bdb1a2}.state.error{color:#e2a58b}.message{margin-bottom:0;color:#cbbd9e}footer{align-items:center;margin-top:10px}footer span{font-size:8px;color:#8f8477}@media(max-width:700px){.fleet-panel{top:calc(var(--noxia-topbar-h,44px) + 8px);right:8px;width:calc(100vw - 16px)}.robot-grid,.facts{grid-template-columns:1fr}}
    `}</style>
  </aside>
}
