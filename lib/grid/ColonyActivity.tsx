'use client'

import React from 'react'

export function ColonyActivityStyles(){return <style>{`
.noxia-rover{position:absolute;width:34px;height:20px;pointer-events:none;filter:drop-shadow(0 4px 3px #0008);animation:rover-idle 2.8s ease-in-out infinite}.noxia-rover .deck{position:absolute;left:5px;top:5px;width:24px;height:10px;border:1px solid #26333d;border-radius:3px;background:#d5c28a}.noxia-rover .cab{position:absolute;left:10px;top:0;width:11px;height:7px;border:1px solid #26333d;background:#7892a1}.noxia-rover .wheel{position:absolute;top:13px;width:7px;height:7px;border-radius:50%;background:#15191d;border:2px solid #51575b}.noxia-rover .w1{left:3px}.noxia-rover .w2{right:3px}.noxia-rover .mast{position:absolute;left:23px;top:-5px;width:2px;height:10px;background:#aab3b5}.noxia-rover .mast:after{content:'';position:absolute;left:-3px;top:-2px;width:8px;height:3px;background:#c8d0d0}
.noxia-machine-active{position:absolute;width:44px;height:44px;pointer-events:none}.noxia-machine-active:before{content:'';position:absolute;inset:8px;border:2px solid #4cc4e7;border-right-color:transparent;border-radius:50%;animation:noxia-spin 2.2s linear infinite}.noxia-machine-active:after{content:'';position:absolute;left:20px;top:1px;width:4px;height:10px;border-radius:4px;background:#70ddff;box-shadow:0 0 8px #70ddff;animation:noxia-pulse 1.3s ease-in-out infinite}.noxia-service-crate{position:absolute;width:18px;height:13px;border:1px solid #342d23;background:#b58a43;box-shadow:inset 0 0 0 2px #6e512d,0 3px 4px #0007;pointer-events:none}.noxia-service-crate:after{content:'+';display:grid;place-items:center;color:#342818;font:bold 8px monospace}
@keyframes noxia-spin{to{transform:rotate(360deg)}}@keyframes noxia-pulse{50%{opacity:.25;transform:scaleY(.55)}}@keyframes rover-idle{50%{transform:translateY(-1px)}}
`}</style>}

export function Rover({left,top}:{left:number;top:number}){return <div className="noxia-rover" style={{left,top}} aria-label="Wartungsrover"><i className="deck"/><i className="cab"/><i className="wheel w1"/><i className="wheel w2"/><i className="mast"/></div>}
export function MachineActivity({left,top}:{left:number;top:number}){return <div className="noxia-machine-active" style={{left,top}} aria-label="Aktive Maschine"/>}
export function ServiceCrate({left,top}:{left:number;top:number}){return <div className="noxia-service-crate" style={{left,top}} aria-label="Versorgungskiste"/>}
