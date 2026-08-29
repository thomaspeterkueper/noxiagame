'use client'

import { BuildingSVG } from './BuildingSVG'

interface Props {
  entityId: string
  planet: string
  owned?: boolean
  size?: number
  active?: boolean
}

function detailKind(entityId:string){
  const id=entityId.toLowerCase()
  if(/mine|extract|drill|refin|smelt|factory|industrial/.test(id)) return 'industrial'
  if(/energy|solar|power|reactor|battery/.test(id)) return 'power'
  if(/water|ice|hydro|recycl|life_support/.test(id)) return 'utility'
  if(/habitat|home|residen|quarter/.test(id)) return 'habitat'
  if(/lab|research|science|academy|observ/.test(id)) return 'science'
  if(/port|hangar|ship|cargo|trade|market|warehouse/.test(id)) return 'logistics'
  return 'service'
}

/**
 * Lightweight pseudo-3D presentation for the existing canonical building art.
 * The SVG remains the identity/art source. This component supplies a readable
 * footprint around it: plinth, apron, utility/service details, shadow, lighting
 * and deterministic operational motion. The details are presentation only;
 * simulation coordinates remain the source of truth.
 */
export function IsometricBuilding({entityId,planet,owned=false,size=86,active=true}:Props){
  const width=size*1.52
  const height=size*1.28
  const detail=detailKind(entityId)
  return <div className={`iso-building detail-${detail} ${active?'operational':''}`} style={{width,height}}>
    <span className="iso-shadow"/>
    <span className="iso-service-apron"/>
    <span className="iso-plinth-side left"/>
    <span className="iso-plinth-side right"/>
    <span className="iso-plinth-top"/>
    <span className="iso-building-art"><BuildingSVG entityId={entityId} planet={planet} owned={owned} size={size}/></span>
    <span className="iso-detail d1"/><span className="iso-detail d2"/><span className="iso-detail d3"/>
    {active&&<><span className="iso-status-light"/><span className="iso-ground-light"/></>}
  </div>
}

export function IsometricBuildingStyles(){return <style>{`
.iso-building{position:relative;display:block;isolation:isolate;transform-origin:50% 82%}
.iso-shadow{position:absolute;z-index:0;left:12%;right:5%;bottom:3%;height:18%;background:rgba(0,0,0,.5);filter:blur(6px);transform:skewX(-28deg);border-radius:50%}
.iso-service-apron{position:absolute;z-index:0;left:4%;right:4%;bottom:5%;height:34%;background:linear-gradient(135deg,#4f5555,#292f31);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 1px #8d969366}
.iso-service-apron:after{content:'';position:absolute;inset:18%;border:1px dashed rgba(205,181,106,.32);clip-path:inherit}
.iso-plinth-top{position:absolute;z-index:1;left:20%;right:20%;bottom:13%;height:28%;background:linear-gradient(135deg,#6c777d,#303941);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 1px #9aa4a766}
.iso-plinth-side{position:absolute;z-index:0;bottom:7%;height:14%;width:31%;filter:brightness(.72)}
.iso-plinth-side.left{left:20%;background:#303941;clip-path:polygon(0 0,100% 100%,100% 52%,0 0)}
.iso-plinth-side.right{right:20%;background:#242d34;clip-path:polygon(0 100%,100% 0,100% 0,0 52%)}
.iso-building-art{position:absolute;z-index:4;left:50%;bottom:20%;transform:translateX(-50%) scaleY(1.08);filter:drop-shadow(8px 12px 5px rgba(0,0,0,.52))}
.iso-detail{position:absolute;z-index:3;display:block}
.iso-detail.d1{left:9%;bottom:21%;width:12%;height:10%;background:#79827f;border:1px solid #1e292e;box-shadow:2px 3px 0 #1b2124}
.iso-detail.d2{right:10%;bottom:18%;width:10%;height:12%;background:#4b5f68;border:1px solid #182229;box-shadow:2px 3px 0 #171d20}
.iso-detail.d3{right:16%;bottom:34%;width:4%;height:18%;background:#7c8d90;border-radius:3px 3px 0 0;box-shadow:1px 2px 0 #20292c}
.detail-industrial .d1{width:18%;height:9%;background:#72533c}.detail-industrial .d2{width:13%;height:16%;background:#5e6768}.detail-industrial .d3{height:27%;width:5%;background:#596468}
.detail-power .d1{width:22%;height:7%;transform:skewY(-18deg);background:#39566f}.detail-power .d2{width:18%;height:7%;transform:skewY(-18deg);background:#405f78}.detail-power .d3{height:23%;background:#806d46}
.detail-utility .d1{border-radius:50%;width:14%;height:13%;background:#537485}.detail-utility .d2{border-radius:50%;width:12%;height:11%;background:#668492}.detail-utility .d3{width:3%;height:19%;background:#66808a}
.detail-habitat .d1{width:15%;height:6%;background:#786a52}.detail-habitat .d2{width:14%;height:6%;background:#6d6554}.detail-habitat .d3{height:13%;background:#78888a}
.detail-science .d1{border-radius:50%;width:10%;height:10%;background:#708a8e}.detail-science .d2{width:15%;height:6%;background:#566d78}.detail-science .d3{height:29%;width:3%;background:#829497}
.detail-logistics .d1{width:22%;height:8%;background:#6f5940}.detail-logistics .d2{width:20%;height:8%;background:#796345}.detail-logistics .d3{height:18%;background:#7d8989}
.iso-status-light{position:absolute;z-index:6;left:51%;top:11%;width:4px;height:4px;border-radius:50%;background:#ffd86a;box-shadow:0 0 8px 2px #ffc84c;animation:noxia-status-pulse 1.9s ease-in-out infinite}
.iso-ground-light{position:absolute;z-index:2;left:35%;right:35%;bottom:12%;height:7%;border-radius:50%;background:rgba(255,204,91,.16);filter:blur(4px);animation:noxia-ground-pulse 2.8s ease-in-out infinite}
.iso-building.operational .iso-building-art{animation:noxia-building-breathe 4.2s ease-in-out infinite}
@keyframes noxia-status-pulse{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes noxia-ground-pulse{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes noxia-building-breathe{0%,100%{transform:translateX(-50%) translateY(0) scaleY(1.08)}50%{transform:translateX(-50%) translateY(-1px) scaleY(1.08)}}
`}</style>}
