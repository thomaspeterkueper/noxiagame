'use client'

import { BuildingSVG } from './BuildingSVG'

interface Props {
  entityId: string
  planet: string
  owned?: boolean
  size?: number
  active?: boolean
}

/**
 * Lightweight pseudo-3D presentation for the existing canonical building art.
 * The SVG remains the identity/art source; this component adds an isometric
 * plinth, extrusion, shadow, lighting and deterministic operational motion.
 * It deliberately avoids GIF playback so animation can later be driven by
 * actual simulation state.
 */
export function IsometricBuilding({entityId,planet,owned=false,size=86,active=true}:Props){
  const width=size*1.22
  const height=size*1.12
  return <div className={`iso-building ${active?'operational':''}`} style={{width,height}}>
    <span className="iso-shadow"/>
    <span className="iso-plinth-side left"/>
    <span className="iso-plinth-side right"/>
    <span className="iso-plinth-top"/>
    <span className="iso-building-art"><BuildingSVG entityId={entityId} planet={planet} owned={owned} size={size}/></span>
    {active&&<><span className="iso-status-light"/><span className="iso-ground-light"/></>}
  </div>
}

export function IsometricBuildingStyles(){return <style>{`
.iso-building{position:relative;display:block;isolation:isolate;transform-origin:50% 82%}
.iso-shadow{position:absolute;z-index:0;left:8%;right:0;bottom:2%;height:22%;background:rgba(0,0,0,.48);filter:blur(5px);transform:skewX(-28deg);border-radius:50%}
.iso-plinth-top{position:absolute;z-index:1;left:8%;right:8%;bottom:12%;height:30%;background:linear-gradient(135deg,#647079,#303941);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 1px #8c989c66}
.iso-plinth-side{position:absolute;z-index:0;bottom:5%;height:15%;width:42%;filter:brightness(.72)}
.iso-plinth-side.left{left:8%;background:#303941;clip-path:polygon(0 0,100% 100%,100% 52%,0 0)}
.iso-plinth-side.right{right:8%;background:#242d34;clip-path:polygon(0 100%,100% 0,100% 0,0 52%)}
.iso-building-art{position:absolute;z-index:3;left:50%;bottom:20%;transform:translateX(-50%) scaleY(1.06);filter:drop-shadow(7px 11px 5px rgba(0,0,0,.48))}
.iso-status-light{position:absolute;z-index:5;left:51%;top:11%;width:4px;height:4px;border-radius:50%;background:#ffd86a;box-shadow:0 0 8px 2px #ffc84c;animation:noxia-status-pulse 1.9s ease-in-out infinite}
.iso-ground-light{position:absolute;z-index:2;left:29%;right:29%;bottom:12%;height:8%;border-radius:50%;background:rgba(255,204,91,.16);filter:blur(4px);animation:noxia-ground-pulse 2.8s ease-in-out infinite}
.iso-building.operational .iso-building-art{animation:noxia-building-breathe 4.2s ease-in-out infinite}
@keyframes noxia-status-pulse{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes noxia-ground-pulse{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes noxia-building-breathe{0%,100%{transform:translateX(-50%) translateY(0) scaleY(1.06)}50%{transform:translateX(-50%) translateY(-1px) scaleY(1.06)}}
`}</style>}
