'use client'

import BuildingOverlayShell from './BuildingOverlayShell'

interface SpaceportOverlayProps {
  buildingTypeId: string
  buildingName: string
  onClose: () => void
  onOpenNavigation: () => void
  onOpenMaintenance: () => void
  onOpenCargo: () => void
}
type ActionId='navigation'|'maintenance'|'cargo'
type ActionDef={id:ActionId;icon:string;title:string;text:string;button:string}
const ACTIONS:Record<ActionId,ActionDef>={
 navigation:{id:'navigation',icon:'🧭',title:'Abflug & Navigation',text:'Reiseziel wählen, Flugplanung öffnen und den nächsten Abflug vorbereiten.',button:'Navigation öffnen'},
 maintenance:{id:'maintenance',icon:'🛠️',title:'Wartung & Werft',text:'Schiff, Module und technische Arbeiten über die vorhandene Werftfunktion verwalten.',button:'Wartung öffnen'},
 cargo:{id:'cargo',icon:'📦',title:'Fracht & Handel',text:'Frachtumschlag, Markt und offene Handelsaufträge am Standort öffnen.',button:'Fracht öffnen'},
}
function actionOrder(id:string):ActionId[]{if(id==='spaceport_service')return['maintenance','navigation','cargo'];if(id==='spaceport_storage')return['cargo','navigation','maintenance'];return['navigation','maintenance','cargo']}

export default function SpaceportOverlay({buildingTypeId,buildingName,onClose,onOpenNavigation,onOpenMaintenance,onOpenCargo}:SpaceportOverlayProps){
 const run=(id:ActionId)=>{if(id==='navigation')onOpenNavigation();if(id==='maintenance')onOpenMaintenance();if(id==='cargo')onOpenCargo()}
 return <BuildingOverlayShell eyebrow="GEBÄUDE · RAUMHAFEN" title={buildingName} subtitle={buildingTypeId} onClose={onClose} footer="Persistenter Weltzustand · gemeinsame NOXIA-Gebäudenavigation">
   <p className="intro">Von hier aus werden die bestehenden NOXIA-Systeme geöffnet. Der Raumhafen erzeugt keinen separaten Parallelzustand.</p>
   <div className="actions">{actionOrder(buildingTypeId).map((id,index)=>{const a=ACTIONS[id];return <section key={id} className={index===0?'primary':''}><div className="icon">{a.icon}</div><div><strong>{a.title}</strong><span>{a.text}</span></div><button type="button" onClick={()=>run(id)}>{a.button} →</button></section>})}</div>
   <style jsx>{`.intro{margin:0 0 16px;color:#50656d;font-size:12px;line-height:1.55}.actions{display:grid;gap:10px}.actions section{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:12px;align-items:center;background:#f9faf7;border:1px solid #c9d1ce;border-radius:10px;padding:12px 13px}.actions section.primary{background:#fff8df;border-color:#c4a451}.icon{font-size:27px;text-align:center}.actions strong,.actions span{display:block}.actions strong{font-size:13px}.actions span{margin-top:3px;color:#607178;font-size:10px;line-height:1.45}.actions button{border:1px solid #476b79;background:#183e4d;color:#fff;border-radius:7px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.primary button{background:#b48a26}@media(max-width:700px){.actions section{grid-template-columns:38px 1fr}.actions button{grid-column:1/-1}}`}</style>
 </BuildingOverlayShell>
}
