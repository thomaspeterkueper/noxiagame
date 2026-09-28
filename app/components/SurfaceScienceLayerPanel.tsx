'use client'

import type { SurfaceScienceObject } from '@/lib/game/science/surfaceScience'

type Props={
  enabled:boolean
  onToggle:()=>void
  objects:SurfaceScienceObject[]
  selectedId:string|null
  onSelect:(id:string|null)=>void
  onOpenOperations?:()=>void
}

const evidenceTone=(value:SurfaceScienceObject['evidenceClass'])=>value==='engineering'?'ENG':value==='direct'?'DIRECT':value==='sampled'?'SAMPLE':'MODEL'

export default function SurfaceScienceLayerPanel({enabled,onToggle,objects,selectedId,onSelect,onOpenOperations}:Props){
  const selected=objects.find(item=>item.id===selectedId)??null
  return <div className="science-layer">
    <button className={enabled?'science-toggle active':'science-toggle'} onClick={onToggle}><span>{enabled?'●':'○'}</span> Wissenschaft</button>
    {enabled&&<div className="science-legend"><b>SCIENCE LAYER</b><span>{objects.length} bekannte Evidenzobjekte</span><small>MODEL → SAMPLE → DIRECT → ENG</small></div>}
    {enabled&&selected&&<aside className="science-card"><div className="science-head"><div><small>{evidenceTone(selected.evidenceClass)} · {selected.resourceType}</small><strong>{selected.label}</strong></div><button onClick={()=>onSelect(null)}>×</button></div><div className="science-grid"><span>Evidenz</span><b>{selected.evidenceLabel}</b><span>Konfidenz</span><b>{selected.confidence}</b><span>Provenienz</span><b>{selected.provenance}</b><span>Prospektklasse</span><b>{selected.tier}</b><span>Probe</span><b>{selected.sampleStatus}</b><span>Bohrkern</span><b>{selected.coreStatus}</b><span>Feldmission</span><b>{selected.missionStatus}</b><span>Entwicklungsstatus</span><b>{selected.developmentStatus}</b>{selected.finding&&<><span>Befund</span><b>{selected.finding}</b></>}{selected.qualityScore!=null&&<><span>Analysequalität</span><b>{Math.round(selected.qualityScore*100)}%</b></>}</div><div className="science-note">Weltobjekt und Evidenzstufe sind In-World-Spielzustand. Provenienz und Konfidenz bleiben explizit sichtbar; ein modellierter Prospekt ist kein beobachtetes reales Vorkommen.</div>{onOpenOperations&&<button className="science-action" onClick={onOpenOperations}>Feldoperationen öffnen →</button>}</aside>}
    <style jsx>{`
      .science-layer{position:fixed;z-index:5;right:18px;top:calc(var(--noxia-topbar-h,44px) + 18px);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.science-toggle{border:1px solid rgba(140,210,190,.3);border-radius:8px;background:rgba(5,14,15,.82);color:#a7b8b1;padding:7px 10px;cursor:pointer;backdrop-filter:blur(8px)}.science-toggle.active{color:#9be5cf;border-color:rgba(120,230,200,.55);box-shadow:0 0 18px rgba(80,200,175,.08)}.science-toggle span{margin-right:7px}.science-legend{margin-top:6px;padding:8px 10px;border:1px solid rgba(120,230,200,.22);border-radius:8px;background:rgba(4,12,14,.82);display:flex;flex-direction:column;gap:2px;color:#b8c9c3;max-width:245px}.science-legend b{font-size:10px;letter-spacing:.1em;color:#7ed5bc}.science-legend span{font-size:9px}.science-legend small{font-size:8px;color:#6f817b}.science-card{margin-top:8px;width:310px;padding:12px;border:1px solid rgba(120,230,200,.28);border-radius:10px;background:rgba(4,11,13,.94);box-shadow:0 12px 36px rgba(0,0,0,.32);color:#dbe7e2}.science-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.science-head div{display:flex;flex-direction:column;gap:2px}.science-head small{font-size:9px;color:#79d2b8;letter-spacing:.07em}.science-head strong{font:700 13px/1.3 system-ui,sans-serif}.science-head button{border:0;background:transparent;color:#91a7a0;font-size:18px;cursor:pointer}.science-grid{display:grid;grid-template-columns:110px 1fr;gap:5px 8px;margin-top:10px;font-size:9px}.science-grid span{color:#738a83}.science-grid b{color:#dce9e4;font-weight:700;overflow-wrap:anywhere}.science-note{margin-top:10px;padding-top:9px;border-top:1px solid rgba(120,230,200,.14);font:9px/1.45 system-ui,sans-serif;color:#8fa19b}.science-action{margin-top:10px;width:100%;border:1px solid rgba(120,230,200,.35);border-radius:7px;background:#12332d;color:#bdebdc;padding:8px 10px;cursor:pointer;font-weight:700}
    `}</style>
  </div>
}
