'use client'

// app/dashboard/WarehouseOverlay.tsx
// Aktualisiert: 10.10.2026 — Name und Symbol des Guts `energy` aus lib/constants (NOXIA-ENERGY-0001)
// Vorher:       09.10.2026 — Direkthandel zum Marktpreis für alle Güter. Die Auktion
//               zeigte Gebote, die der Server nie abrechnete; jetzt steht nach jedem Handel,
//               was tatsächlich gebucht wurde (Menge und Betrag inkl. Abgaben).
// Vorher:       28.09.2026 — Energie ist Versorgungsware und wird direkt
//               zum lokalen Spotpreis gebunkert.
// Version:      2.0.1

import { ENERGY_GOOD_ICON, ENERGY_GOOD_LABEL } from '@/lib/constants'
import { useState } from 'react'
import BuyRow from './BuyRow'
import OrderNegotiation from './OrderNegotiation'
import BuildingOverlayShell from './BuildingOverlayShell'
import { useGameStore, type ResourceType, type LocationSlug } from '@/lib/store/gameStore'

const RES_ICON:Record<string,string>={water:'💧',energy:ENERGY_GOOD_ICON,metal:'⛏️'}
const RES_LABEL:Record<string,string>={water:'Wasser',energy:ENERGY_GOOD_LABEL,metal:'Metall'}
interface MarketRow{id:string;resource:ResourceType;buy_price:number;sell_price:number;stock:number}
interface OrderData{id:string;resource:string;amount:number;reward:number;expires_at?:string;locations?:{slug?:string;name?:string};stock?:number}
interface Props{locationSlug:LocationSlug;locationName:string;prices:any[];resources:{resource:string;stock:number;consumption:number}[];orders:OrderData[];cargo:Record<ResourceType,number>;cargoMax:number;credits:number;onTrade:(resource:ResourceType,mode:'buy'|'sell',amount:number,price:number)=>Promise<boolean>;onFulfillOrder:(orderId:string,agreedReward:number)=>Promise<boolean>;onClose:()=>void}
type Tab='markt'|'auftraege'

export default function WarehouseOverlay({locationSlug,locationName,prices,resources,orders,cargo,cargoMax,credits,onTrade,onFulfillOrder,onClose}:Props){
 const [tab,setTab]=useState<Tab>('markt'),[negotiateOrder,setNegotiate]=useState<OrderData|null>(null),[receipt,setReceipt]=useState<{ok:boolean;text:string}|null>(null)
 // Beleg aus dem tatsächlich gebuchten Ergebnis: Differenz von Ladung und Guthaben
 // vor und nach dem Handel. So stimmt der Betrag auch mit Steuer und Spediteurgebühr.
 async function trade(resource:ResourceType,mode:'buy'|'sell',amount:number,price:number){
  const before=useGameStore.getState()
  const ok=await onTrade(resource,mode,amount,price)
  const after=useGameStore.getState()
  const booked=Math.abs((after.cargo[resource]??0)-(before.cargo[resource]??0)),money=Math.abs(after.credits-before.credits),name=RES_LABEL[resource]??resource
  if(!ok||booked===0)setReceipt({ok:false,text:`${mode==='buy'?'Kauf':'Verkauf'} von ${name} nicht möglich.`})
  else setReceipt({ok:true,text:`${booked} t ${name} ${mode==='buy'?'gekauft':'verkauft'} · ${mode==='buy'?'−':'+'}${money.toLocaleString('de')} Cr inkl. Abgaben${booked<amount?` · angefragt waren ${amount} t`:''}`})
 }
 const cargoUsed=(Object.values(cargo) as number[]).reduce((a,b)=>a+b,0),cargoFree=cargoMax-cargoUsed
 const currentPrices:MarketRow[]=prices.filter((p:any)=>p.locations?.slug===locationSlug).map((p:any)=>({id:p.id,resource:p.resource,buy_price:p.buy_price,sell_price:p.sell_price,stock:resources.find(r=>r.resource===p.resource)?.stock??0}))
 return <>
   {negotiateOrder&&<OrderNegotiation order={negotiateOrder} onClose={()=>setNegotiate(null)} onAccept={async(orderId,reward)=>{const ok=await onFulfillOrder(orderId,reward);if(ok)setNegotiate(null);return ok}} canFulfill={(cargo[negotiateOrder.resource as ResourceType]??0)>=negotiateOrder.amount} fulfillHint={(cargo[negotiateOrder.resource as ResourceType]??0)<negotiateOrder.amount?`Zu wenig ${RES_LABEL[negotiateOrder.resource]??negotiateOrder.resource} an Bord`:undefined}/>} 
   <BuildingOverlayShell eyebrow="GEBÄUDE · WARENHAUS" title={locationName} subtitle={`${credits.toLocaleString('de')} Cr · 📦 ${cargoUsed}/${cargoMax}t`} onClose={onClose} footer="Direkthandel zum Marktpreis · Preise und Abgaben sind standortabhängig" width={760}>
     <div className="tabs"><button className={tab==='markt'?'active':''} onClick={()=>setTab('markt')}>📊 Markt</button><button className={tab==='auftraege'?'active':''} onClick={()=>setTab('auftraege')}>📋 Aufträge{orders.length?` (${orders.length})`:''}</button></div>
     {tab==='markt'&&<div>{receipt&&<div role="status" className={receipt.ok?'receipt ok':'receipt no'}>{receipt.text}</div>}{currentPrices.length===0?<div className="empty">Keine Marktpreise verfügbar.</div>:currentPrices.map((p,i)=><BuyRow key={p.id} p={p} last={i===currentPrices.length-1} cargoFree={cargoFree} owned={cargo[p.resource as ResourceType]??0} onBuy={(amt,price)=>trade(p.resource as ResourceType,'buy',amt,price)} onSell={(amt,price)=>trade(p.resource as ResourceType,'sell',amt,price)}/>)}</div>}
     {tab==='auftraege'&&<div className="orders">{orders.length===0?<div className="empty">Keine offenen Aufträge.</div>:orders.map(o=>{const hasGoods=(cargo[o.resource as ResourceType]??0)>=o.amount;return <article key={o.id}><div><strong>{RES_ICON[o.resource]} {o.amount}t {RES_LABEL[o.resource]??o.resource}</strong><span>{o.reward.toLocaleString('de')} Cr/t{o.expires_at?` · bis ${new Date(o.expires_at).toLocaleDateString('de')}`:''}</span></div><button disabled={!hasGoods} onClick={()=>setNegotiate(o)}>Erfüllen →</button></article>})}</div>}
     <style jsx>{`.receipt{margin:0 0 10px;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:700}.receipt.ok{background:#eaf6ef;border:1px solid #9fd0b4;color:#1f6b45}.receipt.no{background:#fbecea;border:1px solid #e0a79f;color:#9a3327}.tabs{display:flex;gap:4px;border-bottom:1px solid #d5d8d0;margin:-4px 0 14px}.tabs button{border:0;background:transparent;color:#6a7a8a;padding:9px 12px;font-weight:700;cursor:pointer;border-bottom:2px solid transparent}.tabs button.active{color:#2a4e7a;border-color:#2a4e7a}.empty{padding:22px;text-align:center;color:#8a9ab0;font-size:12px}.orders{display:grid;gap:8px}.orders article{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid #d2d0c4;border-radius:8px;background:#fffdf7}.orders strong,.orders span{display:block}.orders span{margin-top:3px;color:#6a7a8a;font-size:10px}.orders button{border:0;border-radius:6px;background:#2a4e7a;color:#fff;padding:8px 12px;font-weight:800;cursor:pointer}.orders button:disabled{background:#e0ddd6;color:#8a9ab0;cursor:not-allowed}`}</style>
   </BuildingOverlayShell>
 </>
}
