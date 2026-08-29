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
 * Isometric presentation for canonical building art.
 * Simulation coordinates stay authoritative; this layer only makes the site
 * readable as a real installation at strategy zoom levels.
 */
export function IsometricBuilding({entityId,planet,owned=false,size=86,active=true}:Props){
  const width=size*2.05
  const height=size*1.52
  const artSize=size*1.22
  const detail=detailKind(entityId)
  return <div className={`iso-building detail-${detail} ${active?'operational':''}`} style={{width,height}}>
    <span className="iso-shadow"/>
    <span className="iso-service-apron"/>
    <span className="iso-service-lane"/>
    <span className="iso-plinth-side left"/>
    <span className="iso-plinth-side right"/>
    <span className="iso-plinth-top"/>
    <span className="iso-building-art"><BuildingSVG entityId={entityId} planet={planet} owned={owned} size={artSize}/></span>
    <span className="iso-detail d1"/><span className="iso-detail d2"/><span className="iso-detail d3"/>
    {active&&<><span className="iso-status-light"/><span className="iso-ground-light"/></>}
  </div>
}

export function IsometricBuildingStyles(){return <style>{`
.iso-building{position:relative;display:block;isolation:isolate;transform-origin:50% 82%}
.iso-shadow{position:absolute;z-index:0;left:15%;right:7%;bottom:2%;height:20%;background:rgba(0,0,0,.56);filter:blur(7px);transform:skewX(-28deg);border-radius:50%}
.iso-service-apron{position:absolute;z-index:0;left:2%;right:2%;bottom:3%;height:48%;background:linear-gradient(135deg,#59605f,#292f31 58%,#202629);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 2px rgba(151,163,158,.34)}
.iso-service-apron:after{content:'';position:absolute;inset:14%;border:2px dashed rgba(222,190,94,.42);clip-path:inherit}
.iso-service-lane{position:absolute;z-index:1;left:6%;bottom:20%;width:30%;height:7%;background:#5f6562;border-top:2px solid #c4a752;border-bottom:2px solid #313735;transform:rotate(18deg);transform-origin:right center;box-shadow:0 3px 0 #171c1e}
.iso-plinth-top{position:absolute;z-index:2;left:25%;right:25%;bottom:14%;height:30%;background:linear-gradient(135deg,#758087,#343d43);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 2px #9aa4a766}
.iso-plinth-side{position:absolute;z-index:1;bottom:7%;height:16%;width:25%;filter:brightness(.72)}
.iso-plinth-side.left{left:25%;background:#303941;clip-path:polygon(0 0,100% 100%,100% 52%,0 0)}
.iso-plinth-side.right{right:25%;background:#242d34;clip-path:polygon(0 100%,100% 0,100% 0,0 52%)}
.iso-building-art{position:absolute;z-index:5;left:50%;bottom:20%;transform:translateX(-50%) scaleY(1.08);filter:drop-shadow(10px 14px 6px rgba(0,0,0,.58))}
.iso-detail{position:absolute;z-index:4;display:block}
.iso-detail.d1{left:8%;bottom:24%;width:15%;height:12%;background:#89918d;border:2px solid #1e292e;box-shadow:3px 4px 0 #1b2124}
.iso-detail.d2{right:8%;bottom:20%;width:13%;height:14%;background:#536b74;border:2px solid #182229;box-shadow:3px 4px 0 #171d20}
.iso-detail.d3{right:15%;bottom:38%;width:5%;height:22%;background:#87999b;border-radius:3px 3px 0 0;box-shadow:2px 3px 0 #20292c}
.detail-industrial .d1{width:22%;height:11%;background:#79583f}.detail-industrial .d2{width:16%;height:19%;background:#697273}.detail-industrial .d3{height:31%;width:6%;background:#667276}
.detail-power .d1{width:26%;height:8%;transform:skewY(-18deg);background:#41647f}.detail-power .d2{width:22%;height:8%;transform:skewY(-18deg);background:#496b85}.detail-power .d3{height:26%;background:#927a49}
.detail-utility .d1{border-radius:50%;width:17%;height:16%;background:#5d8091}.detail-utility .d2{border-radius:50%;width:15%;height:14%;background:#7593a0}.detail-utility .d3{width:4%;height:23%;background:#78909a}
.detail-habitat .d1{width:18%;height:8%;background:#85765b}.detail-habitat .d2{width:17%;height:8%;background:#786f5b}.detail-habitat .d3{height:16%;background:#879698}
.detail-science .d1{border-radius:50%;width:13%;height:13%;background:#7f999d}.detail-science .d2{width:18%;height:8%;background:#607985}.detail-science .d3{height:33%;width:4%;background:#91a3a6}
.detail-logistics .d1{width:26%;height:10%;background:#7f6648}.detail-logistics .d2{width:24%;height:10%;background:#896f4d}.detail-logistics .d3{height:21%;background:#899696}
.iso-status-light{position:absolute;z-index:7;left:51%;top:8%;width:6px;height:6px;border-radius:50%;background:#ffd86a;box-shadow:0 0 10px 3px #ffc84c;animation:noxia-status-pulse 1.9s ease-in-out infinite}
.iso-ground-light{position:absolute;z-index:3;left:37%;right:37%;bottom:13%;height:9%;border-radius:50%;background:rgba(255,204,91,.2);filter:blur(5px);animation:noxia-ground-pulse 2.8s ease-in-out infinite}
.iso-building.operational .iso-building-art{animation:noxia-building-breathe 4.2s ease-in-out infinite}
@keyframes noxia-status-pulse{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes noxia-ground-pulse{0%,100%{opacity:.4}50%{opacity:.95}}
@keyframes noxia-building-breathe{0%,100%{transform:translateX(-50%) translateY(0) scaleY(1.08)}50%{transform:translateX(-50%) translateY(-2px) scaleY(1.08)}}
`}</style>}
