'use client'

import { useState } from 'react'
import BuyRow from './BuyRow'
import MarketAuction from './MarketAuction'
import OrderNegotiation from './OrderNegotiation'
import BuildingOverlayShell from './BuildingOverlayShell'
import type { ResourceType, LocationSlug } from '@/lib/store/gameStore'

const RES_ICON:Record<string,string>={water:'💧',energy:'⚡',metal:'⛏️'}
const RES_LABEL:Record<string,string>={water:'Wasser',energy:'Energie',metal:'Metall'}
interface MarketRow{id:string;resource:ResourceType;buy_price:number;sell_price:number;stock:number}
interface OrderData{id:string;resource:string;amount:number;reward:number;expires_at?:string;locations?:{slug?:string;name?:string};stock?:number}
interface Props{locationSlug:LocationSlug;locationName:string;prices:any[];resources:{resource:string;stock:number;consumption:number}[];orders:OrderData[];cargo:Record<ResourceType,number>;cargoMax:number;credits:number;onTrade:(resource:ResourceType,mode:'buy'|'sell',amount:number,price:number)=>Promise<boolean>;onFulfillOrder:(orderId:string,agreedReward:number)=>Promise<boolean>;onClose:()=>void}
type Tab='markt'|'auftraege'

export default function WarehouseOverlay({locationSlug,locationName,prices,resources,orders,cargo,cargoMax,credits,onTrade,onFulfillOrder,onClose}:Props){
 const [tab,setTab]=useState<Tab>('markt'),[auctionConfig,setAuction]=useState<{resource:ResourceType;mode:'buy'|'sell';qty:number;limit:number}|null>(null),[negotiateOrder,setNegotiate]=useState<OrderData|null>(null)
 const cargoUsed=(Object.values(cargo) as number[]).reduce((a,b)=>a+b,0),cargoFree=cargoMax-cargoUsed
 const currentPrices:MarketRow[]=prices.filter((p:any)=>p.locations?.slug===locationSlug).map((p:any)=>({id:p.id,resource:p.resource,buy_price:p.buy_price,sell_price:p.sell_price,stock:resources.find(r=>r.resource===p.resource)?.stock??0}))
 return <>
   {auctionConfig&&<MarketAuction open onClose={()=>setAuction(null)} location={locationSlug} locationName={locationName} rows={currentPrices} credits={credits} cargo={cargo} cargoMax={cargoMax} onTrade={onTrade} initialResource={auctionConfig.resource} initialMode={auctionConfig.mode} initialQty={auctionConfig.qty} playerLimit={auctionConfig.limit} skipConfig/>}
   {negotiateOrder&&<OrderNegotiation order={negotiateOrder} onClose={()=>setNegotiate(null)} onAccept={async(orderId,reward)=>{const ok=await onFulfillOrder(orderId,reward);if(ok)setNegotiate(null);return ok}} canFulfill={(cargo[negotiateOrder.resource as ResourceType]??0)>=negotiateOrder.amount} fulfillHint={(cargo[negotiateOrder.resource as ResourceType]??0)<negotiateOrder.amount?`Zu wenig ${RES_LABEL[negotiateOrder.resource]??negotiateOrder.resource} an Bord`:undefined}/>} 
   <BuildingOverlayShell eyebrow="GEBÄUDE · WARENHAUS" title={locationName} subtitle={`${credits.toLocaleString('de')} Cr · 📦 ${cargoUsed}/${cargoMax}t`} onClose={onClose} footer="Preise reagieren auf Kauf und Verkauf · Steuern je nach Koloniepolitik" width={760}>
     <div className="tabs"><button className={tab==='markt'?'active':''} onClick={()=>setTab('markt')}>📊 Markt</button><button className={tab==='auftraege'?'active':''} onClick={()=>setTab('auftraege')}>📋 Aufträge{orders.length?` (${orders.length})`:''}</button></div>
     {tab==='markt'&&<div>{currentPrices.length===0?<div className="empty">Keine Marktpreise verfügbar.</div>:currentPrices.map((p,i)=><BuyRow key={p.id} p={p} last={i===currentPrices.length-1} cargoFree={cargoFree} owned={cargo[p.resource as ResourceType]??0} costBasis={0} onBuy={(amt,limit)=>setAuction({resource:p.resource as ResourceType,mode:'buy',qty:amt,limit})} onSell={(amt,limit)=>setAuction({resource:p.resource as ResourceType,mode:'sell',qty:amt,limit})}/>)}</div>}
     {tab==='auftraege'&&<div className="orders">{orders.length===0?<div className="empty">Keine offenen Aufträge.</div>:orders.map(o=>{const hasGoods=(cargo[o.resource as ResourceType]??0)>=o.amount;return <article key={o.id}><div><strong>{RES_ICON[o.resource]} {o.amount}t {RES_LABEL[o.resource]??o.resource}</strong><span>{o.reward.toLocaleString('de')} Cr/t{o.expires_at?` · bis ${new Date(o.expires_at).toLocaleDateString('de')}`:''}</span></div><button disabled={!hasGoods} onClick={()=>setNegotiate(o)}>Erfüllen →</button></article>})}</div>}
     <style jsx>{`.tabs{display:flex;gap:4px;border-bottom:1px solid #d5d8d0;margin:-4px 0 14px}.tabs button{border:0;background:transparent;color:#6a7a8a;padding:9px 12px;font-weight:700;cursor:pointer;border-bottom:2px solid transparent}.tabs button.active{color:#2a4e7a;border-color:#2a4e7a}.empty{padding:22px;text-align:center;color:#8a9ab0;font-size:12px}.orders{display:grid;gap:8px}.orders article{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid #d2d0c4;border-radius:8px;background:#fffdf7}.orders strong,.orders span{display:block}.orders span{margin-top:3px;color:#6a7a8a;font-size:10px}.orders button{border:0;border-radius:6px;background:#2a4e7a;color:#fff;padding:8px 12px;font-weight:800;cursor:pointer}.orders button:disabled{background:#e0ddd6;color:#8a9ab0;cursor:not-allowed}`}</style>
   </BuildingOverlayShell>
 </>
}
