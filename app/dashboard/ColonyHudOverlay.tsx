'use client'

import React from 'react'

const ICON: Record<string,string> = { water:'💧', energy:'⚡', metal:'⬡', oxygen:'O₂', food:'◉', knowledge:'◈' }
const LABEL: Record<string,string> = { water:'Wasser', energy:'Energie', metal:'Metall', oxygen:'Sauerstoff', food:'Nahrung', knowledge:'Wissen' }

function value(row:any){
  const stock = Number(row?.stock ?? 0)
  const production = Number(row?.production ?? 0)
  const consumption = Number(row?.consumption ?? 0)
  return { stock, delta: production - consumption }
}

export default function ColonyHudOverlay({ current, builds }:{ current:any; builds:any[]; entityCount:number; residentCount:number; onPlan:()=>void }){
  const resources = Array.isArray(current?.location_resources) ? current.location_resources : []
  const visible = resources.filter((r:any)=>['water','energy','metal','oxygen','food'].includes(r.resource)).slice(0,5)
  const active = builds.find((b:any)=>b.status==='building') ?? null
  const progress = active?.completes_at ? Math.max(0, Math.min(99, Math.round(100 - ((new Date(active.completes_at).getTime()-Date.now())/(24*60*60*1000))*25))) : 0

  return <div className="noxia-game-hud" aria-label="Kolonie Status">
    <div className="noxia-resource-hud">
      {visible.map((r:any)=>{ const v=value(r); return <div className="noxia-resource-chip" key={r.resource} title={`${LABEL[r.resource] ?? r.resource}: ${v.stock}`}>
        <span className="ico">{ICON[r.resource] ?? '◆'}</span>
        <span className="resource-copy"><b>{LABEL[r.resource] ?? r.resource}</b><em>{v.stock.toLocaleString('de-DE')}</em><small className={v.delta<0?'neg':'pos'}>{v.delta>=0?'+':''}{v.delta}</small></span>
      </div>})}
    </div>

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
.noxia-build-status{position:absolute;right:12px;top:46px;width:180px;padding:6px 8px;border:1px solid rgba(74,99,119,.72);border-radius:6px;background:rgba(7,17,28,.82);box-shadow:0 3px 10px #0004;backdrop-filter:blur(7px);font-size:9px}.noxia-build-status span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.noxia-build-status span b{color:#f1d57a;letter-spacing:.08em}.noxia-build-status em{display:block;margin-top:2px;text-align:right;font-size:8px;font-style:normal;color:#9eb1c0}.build-progress{height:3px;background:#1a2936;border-radius:4px;overflow:hidden;margin-top:4px}.build-progress i{display:block;height:100%;background:linear-gradient(90deg,#20a963,#67e49b)}
@media(max-width:1000px){.noxia-resource-hud{left:10px;right:10px;transform:none;max-width:none;overflow:hidden;justify-content:center}.noxia-resource-chip{min-width:72px}.noxia-build-status{display:none}}
`}</style> }
