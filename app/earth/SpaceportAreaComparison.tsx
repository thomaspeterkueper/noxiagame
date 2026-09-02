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

type Payload={ok:boolean;areaAnalysis?:Area[];recommendedArea?:Area|null;error?:string}

export default function SpaceportAreaComparison(){
 const[data,setData]=useState<Payload|null>(null)
 useEffect(()=>{fetch('/api/earth/spaceport-candidates?radiusKm=3').then(r=>r.json()).then(setData).catch(e=>setData({ok:false,error:String(e)}))},[])
 if(!data?.ok||!data.areaAnalysis?.length)return null
 const recommended=data.recommendedArea?.label
 return <section className="area-compare"><div className="area-head"><div><small>FLÄCHENPRÜFUNG · SAUERLAND</small><h2>A–C im direkten Vergleich</h2></div><p>Bewertet wird ein Radius von 1 km um jeden Kandidaten. Das Ergebnis ist eine planerische Vorauswahl, keine Genehmigungs- oder Sicherheitsentscheidung.</p></div><div className="cards">{data.areaAnalysis.map(area=><article key={area.label} className={recommended===area.label?'best':''}><div className="card-top"><b>{area.label}</b><strong>{area.areaScore}/100</strong></div><span className={`verdict ${area.verdict}`}>{area.verdict==='strong'?'stark':area.verdict==='conditional'?'bedingt geeignet':'schwach'}</span>{recommended===area.label&&<em>aktuell stärkste Fläche</em>}<dl><div><dt>nutzbare Fläche</dt><dd>{area.usableAreaHa.toFixed(1)} ha</dd></div><div><dt>nutzbarer Anteil</dt><dd>{Math.round(area.usableShare*100)} %</dd></div><div><dt>Korridor</dt><dd>{area.maxConnectedSpanM} m</dd></div><div><dt>Erweiterung</dt><dd>{area.expansionScore}/100</dd></div><div><dt>Erschließung</dt><dd>{area.accessScore}/100</dd></div><div><dt>Korridor-Score</dt><dd>{area.corridorScore}/100</dd></div></dl><p>{area.notes.join(' · ')}</p></article>)}</div><style jsx>{`.area-compare{background:#eef0e8;color:#1f3440;padding:8px 22px 28px;font-family:system-ui,sans-serif}.area-head{max-width:1500px;margin:0 auto 12px;display:flex;justify-content:space-between;gap:30px;align-items:end}.area-head small{letter-spacing:.14em;font-weight:800;color:#657b87}.area-head h2{font-family:Georgia,serif;font-weight:400;margin:4px 0 0}.area-head p{max-width:680px;margin:0;font-size:11px;color:#6f7c7d}.cards{max-width:1500px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cards article{position:relative;background:#faf9f3;border:1px solid #c6c9bf;border-radius:10px;padding:14px}.cards article.best{border-color:#a8893d;box-shadow:0 5px 20px #8d762226}.card-top{display:flex;justify-content:space-between;align-items:center}.card-top b{font-family:Georgia,serif;font-size:28px}.card-top strong{font-size:20px;color:#9a7622}.verdict{display:inline-block;margin:5px 0 8px;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.verdict.strong{background:#dcebd5;color:#3d6534}.verdict.conditional{background:#f1e7c6;color:#755c18}.verdict.weak{background:#eedbd5;color:#7d4336}article em{position:absolute;right:14px;top:45px;font-size:9px;color:#8d6d1d;font-style:normal;font-weight:800}dl{margin:4px 0 8px;display:grid;grid-template-columns:1fr 1fr;gap:5px 14px}dl div{display:flex;justify-content:space-between;border-bottom:1px solid #e1e2db;padding:4px 0}dt{font-size:10px;color:#748080}dd{font-size:10px;font-weight:800;margin:0}article p{margin:5px 0 0;font-size:10px;line-height:1.45;color:#536267}@media(max-width:850px){.area-head{display:block}.area-head p{margin-top:6px}.cards{grid-template-columns:1fr}}`}</style></section>
}
