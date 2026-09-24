'use client'

import { useEffect, useState } from 'react'

type Area = {
  label:'A'|'B'|'C'
  usableAreaHa:number
  usableShare:number
  connectedSuitableCells:number
  maxConnectedSpanM:number
  expansionScore:number
  corridorScore:number
  accessScore:number
  areaScore:number
  verdict:'strong'|'conditional'|'weak'
  notes:string[]
}

type Corridor={label:'A'|'B'|'C';straightLineDistanceM:number;sourceResolutionM:number;sampledCells:number;elevationDeltaM:number|null;surfaceReliefM:number|null;maxObservedSurfaceSlopePercent:number|null;maxProfileGradePercent:number|null;tunnelShare:null;portalCandidates:[];engineeringStatus:'screening-only';notes:string[]}
type Payload={ok:boolean;areaAnalysis?:Area[];corridorAnalysis?:Corridor[];recommendedArea?:Area|null;error?:string}

export default function SpaceportAreaComparison(){
 const[data,setData]=useState<Payload|null>(null)
 useEffect(()=>{fetch('/api/earth/spaceport-candidates?radiusKm=3').then(r=>r.json()).then(setData).catch(e=>setData({ok:false,error:String(e)}))},[])
 if(!data?.ok||!data.areaAnalysis?.length)return null
 const recommended=data.recommendedArea?.label
 return <section className="area-compare"><div className="area-head"><div><small>FLÄCHENPRÜFUNG · SAUERLAND</small><h2>A–C im direkten Vergleich</h2></div><p>Bewertet wird ein Radius von 1 km um jeden Kandidaten. Der Selmecke-Korridor ist eine grobe Oberflächenprüfung, keine Tunnelplanung, Genehmigung oder Sicherheitsentscheidung.</p></div><div className="cards">{data.areaAnalysis.map(area=>{const corridor=data.corridorAnalysis?.find(item=>item.label===area.label);return <article key={area.label} className={recommended===area.label?'best':''}><div className="card-top"><b>{area.label}</b><strong>{area.areaScore}/100</strong></div><span className={`verdict ${area.verdict}`}>{area.verdict==='strong'?'stark':area.verdict==='conditional'?'bedingt geeignet':'schwach'}</span>{recommended===area.label&&<em>aktuell stärkste Fläche</em>}<dl><div><dt>nutzbare Fläche</dt><dd>{area.usableAreaHa.toFixed(1)} ha</dd></div><div><dt>nutzbarer Anteil</dt><dd>{Math.round(area.usableShare*100)} %</dd></div><div><dt>Korridor</dt><dd>{area.maxConnectedSpanM} m</dd></div><div><dt>Erweiterung</dt><dd>{area.expansionScore}/100</dd></div><div><dt>Erschließung</dt><dd>{area.accessScore}/100</dd></div><div><dt>Korridor-Score</dt><dd>{area.corridorScore}/100</dd></div></dl>{corridor&&<div className="route-screen"><b>Selmecke-Verbindung · Vorprüfung</b><dl><div><dt>Luftlinie</dt><dd>{(corridor.straightLineDistanceM/1000).toFixed(1)} km</dd></div><div><dt>Höhendifferenz</dt><dd>{corridor.elevationDeltaM==null?'offen':`${corridor.elevationDeltaM>0?'+':''}${corridor.elevationDeltaM.toFixed(0)} m`}</dd></div><div><dt>Oberflächenrelief</dt><dd>{corridor.surfaceReliefM==null?'offen':`${corridor.surfaceReliefM.toFixed(0)} m`}</dd></div><div><dt>max. Oberflächenneigung</dt><dd>{corridor.maxObservedSurfaceSlopePercent==null?'offen':`${corridor.maxObservedSurfaceSlopePercent.toFixed(1)} %`}</dd></div><div><dt>Tunnelanteil</dt><dd>offen</dd></div><div><dt>Portale</dt><dd>offen</dd></div></dl><small>≈ {corridor.sourceResolutionM} m Raster · {corridor.sampledCells} Korridorproben · Detail-DEM und Geologie erforderlich</small></div>}<p>{area.notes.join(' · ')}</p></article>})}</div><style jsx>{`.area-compare{background:#eef0e8;color:#1f3440;padding:8px 22px 28px;font-family:system-ui,sans-serif}.area-head{max-width:1500px;margin:0 auto 12px;display:flex;justify-content:space-between;gap:30px;align-items:end}.area-head small{letter-spacing:.14em;font-weight:800;color:#657b87}.area-head h2{font-family:Georgia,serif;font-weight:400;margin:4px 0 0}.area-head p{max-width:680px;margin:0;font-size:11px;color:#6f7c7d}.cards{max-width:1500px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cards article{position:relative;background:#faf9f3;border:1px solid #c6c9bf;border-radius:10px;padding:14px}.cards article.best{border-color:#a8893d;box-shadow:0 5px 20px #8d762226}.card-top{display:flex;justify-content:space-between;align-items:center}.card-top b{font-family:Georgia,serif;font-size:28px}.card-top strong{font-size:20px;color:#9a7622}.verdict{display:inline-block;margin:5px 0 8px;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.verdict.strong{background:#dcebd5;color:#3d6534}.verdict.conditional{background:#f1e7c6;color:#755c18}.verdict.weak{background:#eedbd5;color:#7d4336}article em{position:absolute;right:14px;top:45px;font-size:9px;color:#8d6d1d;font-style:normal;font-weight:800}dl{margin:4px 0 8px;display:grid;grid-template-columns:1fr 1fr;gap:5px 14px}dl div{display:flex;justify-content:space-between;border-bottom:1px solid #e1e2db;padding:4px 0}dt{font-size:10px;color:#748080}dd{font-size:10px;font-weight:800;margin:0}.route-screen{margin:10px 0;padding:9px;border-radius:7px;background:#eef2ec;border:1px solid #d2d8cf}.route-screen>b{font-size:10px;color:#46606a}.route-screen dl{margin-top:5px}.route-screen small{display:block;color:#718080;font-size:9px;line-height:1.35}article p{margin:5px 0 0;font-size:10px;line-height:1.45;color:#536267}@media(max-width:850px){.area-head{display:block}.area-head p{margin-top:6px}.cards{grid-template-columns:1fr}}`}</style></section>
}
