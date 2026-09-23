'use client'

import BuildingOverlayShell from './BuildingOverlayShell'

interface ShipType{id:string;name:string;cost:number;cargoMax:number;speedMult:number;desc:string}
const SHIP_TYPES:ShipType[]=[
{id:'freighter_mk1',name:'Frachter Mk.I',cost:0,cargoMax:100,speedMult:1,desc:'Robustes Startschiff. Ausgewogen, kein Schnickschnack.'},
{id:'fast_courier',name:'Schnellfrachter',cost:8000,cargoMax:60,speedMult:1.7,desc:'40% schneller, aber weniger Laderaum. Für Arbitrage über kurze Routen.'},
{id:'heavy_hauler',name:'Schwerfrachter',cost:15000,cargoMax:200,speedMult:.77,desc:'Doppelter Laderaum, dafür träge. Für Großlieferungen an hungrige Kolonien.'},
]

export default function ShipyardOverlay({open,onClose,currentShipTypeId,credits,onBuyShip}:{open:boolean;onClose:()=>void;currentShipTypeId:string;credits:number;onBuyShip:(shipTypeId:string)=>Promise<void>}){
 if(!open)return null
 return <BuildingOverlayShell eyebrow="GEBÄUDE · WERFT" title="Werkstatt & Schiffswerft" subtitle={`Verfügbares Guthaben: ${credits.toLocaleString('de')} Cr`} onClose={onClose} footer="Schiffe und technische Arbeiten bleiben Teil des gemeinsamen NOXIA-Weltzustands">
   <div className="grid">{SHIP_TYPES.map(ship=>{const owned=ship.id===currentShipTypeId,affordable=credits>=ship.cost,isStarter=ship.cost===0;return <article key={ship.id} className={owned?'owned':''}><div className="head"><strong>{ship.name}</strong>{owned&&<span>● Aktuelles Schiff</span>}</div><p>{ship.desc}</p><div className="stats"><div><span>Laderaum</span><b>{ship.cargoMax}t</b></div><div><span>Tempo</span><b>{ship.speedMult}×</b></div><div><span>Preis</span><b>{isStarter?'—':`${ship.cost.toLocaleString('de')} Cr`}</b></div></div><button disabled={owned||isStarter||!affordable} onClick={()=>void onBuyShip(ship.id)}>{owned?'Im Einsatz':isStarter?'Startschiff':!affordable?'Zu teuer':'Kaufen'}</button></article>})}</div>
   <style jsx>{`.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.grid article{background:#fffdf7;border:1px solid #cfd4cc;border-radius:10px;padding:14px}.grid article.owned{border:2px solid #c9a961}.head{display:flex;justify-content:space-between;gap:8px}.head strong{font-size:14px}.head span{font-size:9px;color:#9b7a2c}.grid p{min-height:52px;color:#68777e;font-size:10px;line-height:1.5}.stats{display:grid;gap:4px;margin:10px 0}.stats div{display:flex;justify-content:space-between;font-size:10px}.stats span{color:#788589}.stats b{color:#294957}.grid button{width:100%;padding:8px;border:1px solid #476b79;border-radius:7px;background:#183e4d;color:#fff;font-weight:800;cursor:pointer}.grid button:disabled{background:#eceee9;color:#899397;border-color:#cfd4cc;cursor:default}`}</style>
 </BuildingOverlayShell>
}
