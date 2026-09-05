'use client'

import React from 'react'
import type { ColonySimulationResult } from '@/lib/game/colonySimulation'

const ICON: Record<string,string> = { water:'💧', energy:'⚡', metal:'⬡', oxygen:'O₂', food:'◉', knowledge:'◈' }
const LABEL: Record<string,string> = { water:'Wasser', energy:'Energie', metal:'Metall', oxygen:'Sauerstoff', food:'Nahrung', knowledge:'Wissen' }

export default function ColonyHudOverlay({ builds, simulation }:{ builds:any[]; simulation:ColonySimulationResult }){
  const visible = simulation.resources.filter(resource=>['water','energy','metal','oxygen','food'].includes(resource.resource)).slice(0,5)
  const active = builds.find((build:any)=>build.status==='building') ?? null
  const progress = active?.completes_at ? Math.max(0, Math.min(99, Math.round(100 - ((new Date(active.completes_at).getTime()-Date.now())/(24*60*60*1000))*25))) : 0

  return <div className="noxia-game-hud" aria-label="Kolonie-Telemetrie">
    {simulation.status!=='stable' && <div className={`noxia-sim-status ${simulation.status}`} role="status">
      <b>{simulation.status==='critical'?'KRITISCH':'ENGPASS'}</b>
      <span>{simulation.shortages.length?simulation.shortages.join(', '):'Ressourcenversorgung'}</span>
    </div>}

    <div className="noxia-resource-hud" aria-label="Ressourcen-Telemetrie">
      {visible.map(resource=>{
        const delta=resource.netDelta
        const name=LABEL[resource.resource] ?? resource.resource
        return <div className={`noxia-resource-chip ${delta<0?'warning':''}`} key={resource.resource} title={`${name}: ${resource.stock} → ${resource.nextStock} im nächsten Simulations-Tick`}>
          <span className="ico">{ICON[resource.resource] ?? '◆'}</span>
          <span className="resource-copy"><b>{name}</b><em>{resource.stock.toLocaleString('de-DE')}</em><small className={delta<0?'neg':'pos'}>{delta>=0?'+':''}{delta}</small></span>
        </div>
      })}
    </div>

    {active && <div className="noxia-build-status" aria-label="Aktiver Bau" aria-live="polite">
      <span><b>BAU</b> {active.buildable_id}</span>
      <div className="build-progress"><i style={{width:`${progress}%`}} /></div>
      <em>{progress}%</em>
    </div>}
  </div>
}

export function ColonyHudStyles(){ return <style>{`
/*
 * Telemetrie ist kein Fenster: Sie bleibt als schmale, nicht-interaktive
 * Instrumentenzeile über der Welt sichtbar. Warnungen und aktive Bauten sind
 * rein kontextuell und existieren nur solange ihr Zustand relevant ist.
 */
.noxia-game-hud{position:relative;height:44px;z-index:140;pointer-events:none;font-family:system-ui,sans-serif;color:#e7eef4}
.noxia-resource-hud{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;max-width:min(55vw,520px);pointer-events:none}
.noxia-resource-chip{min-width:78px;height:29px;padding:3px 6px;border:1px solid rgba(74,99,119,.68);border-radius:7px;background:rgba(7,17,28,.76);box-shadow:0 3px 10px #0003;display:flex;gap:5px;align-items:center;backdrop-filter:blur(8px)}
.noxia-resource-chip.warning{border-color:rgba(192,112,32,.85);background:rgba(47,31,16,.84)}
.noxia-resource-chip .ico{font-size:14px;color:#47b8e8}.resource-copy{display:grid;grid-template-columns:auto auto;gap:0 4px;align-items:baseline}.resource-copy b{grid-column:1/3;font-size:7.5px;line-height:1;letter-spacing:.035em;color:#aebdca}.resource-copy em{font-style:normal;font-size:10px;color:#fff}.resource-copy small{font-size:8px;font-weight:750}.resource-copy .pos{color:#49d17d}.resource-copy .neg{color:#ff8b78}
.noxia-sim-status{position:absolute;left:12px;top:8px;display:flex;gap:7px;align-items:center;max-width:220px;height:29px;padding:0 8px;border:1px solid #9a703f;border-radius:7px;background:rgba(41,29,15,.88);box-shadow:0 3px 10px #0003;font-size:9px;backdrop-filter:blur(8px)}.noxia-sim-status b{color:#f1d57a;letter-spacing:.08em}.noxia-sim-status.critical{border-color:#a95050;background:rgba(50,20,20,.90)}.noxia-sim-status.critical b{color:#ff8f8f}.noxia-sim-status span{color:#d4c6b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.noxia-build-status{position:absolute;right:12px;top:8px;width:170px;height:29px;padding:3px 8px;border:1px solid rgba(74,99,119,.72);border-radius:7px;background:rgba(7,17,28,.80);box-shadow:0 3px 10px #0004;backdrop-filter:blur(8px);font-size:9px;animation:noxia-build-appear .18s ease-out}.noxia-build-status span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.noxia-build-status span b{color:#f1d57a;letter-spacing:.08em}.noxia-build-status em{display:block;margin-top:0;text-align:right;font-size:8px;font-style:normal;color:#9eb1c0}.build-progress{height:3px;background:#1a2936;border-radius:4px;overflow:hidden;margin-top:2px}.build-progress i{display:block;height:100%;background:linear-gradient(90deg,#20a963,#67e49b)}
@keyframes noxia-build-appear{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media(max-width:1180px){.noxia-resource-hud{max-width:48vw}.noxia-resource-chip{min-width:63px}.resource-copy b{display:none}.resource-copy{grid-template-columns:auto auto}.resource-copy em{font-size:9px}}
@media(max-width:900px){.noxia-resource-hud{left:8px;right:8px;transform:none;max-width:none;overflow:hidden;justify-content:center}.noxia-resource-chip{min-width:54px;padding:3px 5px}.noxia-build-status,.noxia-sim-status{display:none}}
@media(max-width:620px){.noxia-resource-hud{justify-content:flex-start;overflow-x:auto;scrollbar-width:none}.noxia-resource-hud::-webkit-scrollbar{display:none}.noxia-resource-chip{flex:0 0 auto}}
`}</style> }
