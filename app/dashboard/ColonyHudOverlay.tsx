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

export default function ColonyHudOverlay({ current, builds, entityCount, onPlan }:{ current:any; builds:any[]; entityCount:number; onPlan:()=>void }){
  const resources = Array.isArray(current?.location_resources) ? current.location_resources : []
  const visible = resources.filter((r:any)=>['water','energy','metal','oxygen','food'].includes(r.resource)).slice(0,5)
  const active = builds.find((b:any)=>b.status==='building') ?? null
  const progress = active?.completes_at ? Math.max(0, Math.min(99, Math.round(100 - ((new Date(active.completes_at).getTime()-Date.now())/(24*60*60*1000))*25))) : 0

  return <div className="noxia-game-hud" aria-label="Kolonie HUD">
    <div className="noxia-resource-hud">
      {visible.map((r:any)=>{ const v=value(r); return <div className="noxia-resource-chip" key={r.resource}>
        <span className="ico">{ICON[r.resource] ?? '◆'}</span>
        <span><b>{LABEL[r.resource] ?? r.resource}</b><em>{v.stock.toLocaleString('de-DE')}</em><small className={v.delta<0?'neg':'pos'}>{v.delta>=0?'+':''}{v.delta}/Tick</small></span>
      </div>})}
      {visible.length===0 && <div className="noxia-resource-chip muted">Ressourcendaten werden geladen …</div>}
    </div>

    <aside className="noxia-context-inspector">
      <div className="inspector-kicker">KOLONIE</div>
      <h3>{current?.name ?? current?.slug}</h3>
      <div className="inspector-meta"><span>👥 {(current?.population ?? 0).toLocaleString('de-DE')}</span><span>▦ {entityCount} Anlagen</span></div>
      {active ? <>
        <div className="inspector-divider" />
        <div className="inspector-kicker">AKTIVER BAU</div>
        <strong>{active.buildable_id}</strong>
        <div className="build-progress"><i style={{width:`${progress}%`}} /></div>
        <div className="inspector-meta"><span>{progress}%</span><span>{new Date(active.completes_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></div>
      </> : <><div className="inspector-divider"/><p>Keine laufende Konstruktion. Wähle eine Anlage in der Kolonie oder öffne den Planungsmodus.</p></>}
      <button onClick={onPlan}>▦ Planen & Bauen</button>
    </aside>

    <div className="noxia-bottom-commandbar">
      <button className="active">⌖ Auswählen</button>
      <button>ⓘ Info</button>
      <button>◉ Ansicht</button>
      <button onClick={onPlan}>▦ Bauen</button>
    </div>
  </div>
}

export function ColonyHudStyles(){ return <style>{`
.noxia-game-hud{position:absolute;inset:0;z-index:80;pointer-events:none;font-family:system-ui,sans-serif;color:#e7eef4}.noxia-resource-hud{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:7px;max-width:72%;pointer-events:auto}.noxia-resource-chip{min-width:112px;padding:7px 10px;border:1px solid #32495c;border-radius:8px;background:rgba(7,17,28,.91);box-shadow:0 4px 14px #0005;display:flex;gap:8px;align-items:center;backdrop-filter:blur(8px)}.noxia-resource-chip .ico{font-size:20px;color:#47b8e8}.noxia-resource-chip span:last-child{display:grid;grid-template-columns:auto auto;gap:1px 8px}.noxia-resource-chip b{grid-column:1/3;font-size:10px;letter-spacing:.04em}.noxia-resource-chip em{font-style:normal;font-size:11px;color:#fff}.noxia-resource-chip small{font-size:9px;font-weight:700}.noxia-resource-chip .pos{color:#49d17d}.noxia-resource-chip .neg{color:#ff6b6b}.noxia-context-inspector{position:absolute;right:10px;top:70px;width:238px;padding:13px;border:1px solid #35506a;border-radius:9px;background:rgba(7,17,28,.94);box-shadow:0 8px 22px #0007;pointer-events:auto;backdrop-filter:blur(9px)}.noxia-context-inspector h3{margin:2px 0 7px;font-size:16px}.inspector-kicker{font-size:9px;font-weight:800;letter-spacing:.13em;color:#7ca6c5}.inspector-meta{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#a9bac8}.inspector-divider{height:1px;background:#25394b;margin:11px 0}.noxia-context-inspector p{font-size:10px;line-height:1.5;color:#a9bac8}.noxia-context-inspector strong{font-size:12px}.build-progress{height:7px;background:#1a2936;border-radius:6px;overflow:hidden;margin:8px 0}.build-progress i{display:block;height:100%;background:linear-gradient(90deg,#20a963,#67e49b)}.noxia-context-inspector button{width:100%;margin-top:12px;padding:8px;border:1px solid #2c78b6;border-radius:7px;background:#075fa3;color:white;font-weight:800;cursor:pointer}.noxia-bottom-commandbar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;overflow:hidden;border:1px solid #334b61;border-radius:9px;background:rgba(7,17,28,.92);box-shadow:0 5px 18px #0007;pointer-events:auto}.noxia-bottom-commandbar button{padding:9px 13px;border:0;border-right:1px solid #263b4e;background:transparent;color:#b7c6d2;font-size:10px;cursor:pointer}.noxia-bottom-commandbar button:last-child{border-right:0}.noxia-bottom-commandbar button.active,.noxia-bottom-commandbar button:hover{background:#0b5d9c;color:white}@media(max-width:1000px){.noxia-resource-hud{left:12px;right:12px;transform:none;max-width:none;overflow-x:auto}.noxia-resource-chip{min-width:102px}.noxia-context-inspector{display:none}}
`}</style> }
