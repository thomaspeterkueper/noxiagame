'use client'

import React from 'react'
import type { ColonySimulationResult } from '@/lib/game/colonySimulation'

const ICON: Record<string,string> = { water:'💧', energy:'⚡', metal:'⬡', oxygen:'O₂', food:'◉', knowledge:'◈' }
const LABEL: Record<string,string> = { water:'Wasser', energy:'Energie', metal:'Metall', oxygen:'Sauerstoff', food:'Nahrung', knowledge:'Wissen' }

export default function ColonyHudOverlay({ builds, simulation }:{ builds:any[]; simulation:ColonySimulationResult }){
  const visible = simulation.resources.filter(resource=>['water','energy','metal','oxygen','food'].includes(resource.resource)).slice(0,5)
  const active = builds.find((build:any)=>build.status==='building') ?? null
  const progress = active?.completes_at ? Math.max(0, Math.min(99, Math.round(100 - ((new Date(active.completes_at).getTime()-Date.now())/(24*60*60*1000))*25))) : 0

  return <div className="noxia-game-hud" aria-label="Kolonie Status">
    <div className="noxia-resource-hud">
      {visible.map(resource=>{
        const delta=resource.netDelta
        const name=LABEL[resource.resource] ?? resource.resource
        return <div className="noxia-resource-chip" key={resource.resource} title={`${name}: ${resource.stock} → ${resource.nextStock} im nächsten Simulations-Tick`}>
          <span className="ico">{ICON[resource.resource] ?? '◆'}</span>
          <span className="resource-copy"><b>{name}</b><em>{resource.stock.toLocaleString('de-DE')}</em><small className={delta<0?'neg':'pos'}>{delta>=0?'+':''}{delta}</small></span>
        </div>
      })}
    </div>

    {simulation.status!=='stable' && <div className={`noxia-sim-status ${simulation.status}`}>
      <b>{simulation.status==='critical'?'KRITISCH':'ENGPASS'}</b>
      <span>{simulation.shortages.length?simulation.shortages.join(', '):'Ressourcenversorgung'}</span>
    </div>}

    {active && <div className="noxia-build-status" aria-label="Aktiver Bau">
      <span><b>BAU</b> {active.buildable_id}</span>
      <div className="build-progress"><i style={{width:`${progress}%`}} /></div>
      <em>{progress}%</em>
    </div>}
  </div>
}

export function ColonyHudStyles(){ return <style>{`
.noxia-game-hud{position:absolute;inset:0;z-index:140;pointer-events:none;font-family:system-ui,sans-serif;color:#e7eef4}
.noxia-resource-hud{position:absolute;top:46px;left:50%;transform:translateX(-50%);display:flex;gap:5px;max-width:68%;pointer-events:none}
.noxia-resource-chip{min-width:88px;height:32px;padding:4px 7px;border:1px solid rgba(74,99,119,.72);border-radius:6px;background:rgba(7,17,28,.78);box-shadow:0 3px 10px #0004;display:flex;gap:6px;align-items:center;backdrop-filter:blur(7px)}
.noxia-resource-chip .ico{font-size:15px;color:#47b8e8}.resource-copy{display:grid;grid-template-columns:auto auto;gap:0 5px;align-items:baseline}.resource-copy b{grid-column:1/3;font-size:8px;line-height:1;letter-spacing:.04em;color:#aebdca}.resource-copy em{font-style:normal;font-size:10px;color:#fff}.resource-copy small{font-size:8px;font-weight:700}.resource-copy .pos{color:#49d17d}.resource-copy .neg{color:#ff7777}
.noxia-sim-status{position:absolute;left:12px;top:46px;display:flex;gap:7px;align-items:center;padding:6px 8px;border:1px solid #9a703f;border-radius:6px;background:rgba(41,29,15,.9);font-size:9px}.noxia-sim-status b{color:#f1d57a;letter-spacing:.08em}.noxia-sim-status.critical{border-color:#a95050;background:rgba(50,20,20,.92)}.noxia-sim-status.critical b{color:#ff8f8f}.noxia-sim-status span{color:#d4c6b5}
.noxia-build-status{position:absolute;right:12px;top:46px;width:180px;padding:6px 8px;border:1px solid rgba(74,99,119,.72);border-radius:6px;background:rgba(7,17,28,.82);box-shadow:0 3px 10px #0004;backdrop-filter:blur(7px);font-size:9px}.noxia-build-status span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.noxia-build-status span b{color:#f1d57a;letter-spacing:.08em}.noxia-build-status em{display:block;margin-top:2px;text-align:right;font-size:8px;font-style:normal;color:#9eb1c0}.build-progress{height:3px;background:#1a2936;border-radius:4px;overflow:hidden;margin-top:4px}.build-progress i{display:block;height:100%;background:linear-gradient(90deg,#20a963,#67e49b)}
@media(max-width:1000px){.noxia-resource-hud{left:10px;right:10px;transform:none;max-width:none;overflow:hidden;justify-content:center}.noxia-resource-chip{min-width:72px}.noxia-build-status,.noxia-sim-status{display:none}}
`}</style> }
