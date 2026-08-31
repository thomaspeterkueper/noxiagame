'use client'

import { BuildingSVG } from './BuildingSVG'
import BuildingVisual from '@/lib/assets/BuildingVisual'
import type { ConstructionPhase } from '@/lib/game/constructionProgress'

interface Props {
  entityId: string
  planet: string
  owned?: boolean
  size?: number
  active?: boolean
  construction?: { phase:ConstructionPhase; progress:number } | null
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

function art(entityId:string,planet:string,owned:boolean,artSize:number){
  return <BuildingVisual
    entityId={entityId}
    world={planet}
    fallback={<BuildingSVG entityId={entityId} planet={planet} owned={owned} size={artSize}/>}
  />
}

export function IsometricBuilding({entityId,planet,owned=false,size=86,active=true,construction=null}:Props){
  const width=size*2.05,height=size*1.52,artSize=size*1.22,detail=detailKind(entityId)
  if(construction)return <div className={`iso-building construction phase-${construction.phase}`} style={{width,height}}>
    <span className="iso-shadow"/><span className="iso-service-apron construction-apron"/>
    <span className="construction-foundation"/>
    {construction.phase!=='foundation'&&<><span className="construction-frame f1"/><span className="construction-frame f2"/><span className="construction-frame f3"/><span className="construction-frame f4"/></>}
    {(construction.phase==='systems'||construction.phase==='commissioning')&&<span className="construction-shell">{art(entityId,planet,owned,artSize)}</span>}
    {construction.phase==='commissioning'&&<><span className="construction-light"/><span className="construction-light l2"/></>}
    <span className="construction-crane"><i/><b/></span>
  </div>
  return <div className={`iso-building detail-${detail} ${active?'operational':''}`} style={{width,height}}><span className="iso-shadow"/><span className="iso-service-apron"/><span className="iso-service-lane"/><span className="iso-plinth-side left"/><span className="iso-plinth-side right"/><span className="iso-plinth-top"/><span className="iso-building-art">{art(entityId,planet,owned,artSize)}</span><span className="iso-detail d1"/><span className="iso-detail d2"/><span className="iso-detail d3"/>{active&&<><span className="iso-status-light"/><span className="iso-ground-light"/></>}</div>
}

export function IsometricBuildingStyles(){return <style>{`
.iso-building{position:relative;display:block;isolation:isolate;transform-origin:50% 82%}.iso-shadow{position:absolute;z-index:0;left:15%;right:7%;bottom:2%;height:20%;background:rgba(0,0,0,.56);filter:blur(7px);transform:skewX(-28deg);border-radius:50%}.iso-service-apron{position:absolute;z-index:0;left:2%;right:2%;bottom:3%;height:48%;background:linear-gradient(135deg,#59605f,#292f31 58%,#202629);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 2px rgba(151,163,158,.34)}.iso-service-apron:after{content:'';position:absolute;inset:14%;border:2px dashed rgba(222,190,94,.42);clip-path:inherit}.iso-service-lane{position:absolute;z-index:1;left:6%;bottom:20%;width:30%;height:7%;background:#5f6562;border-top:2px solid #c4a752;border-bottom:2px solid #313735;transform:rotate(18deg);transform-origin:right center;box-shadow:0 3px 0 #171c1e}.iso-plinth-top{position:absolute;z-index:2;left:25%;right:25%;bottom:14%;height:30%;background:linear-gradient(135deg,#758087,#343d43);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:inset 0 0 0 2px #9aa4a766}.iso-plinth-side{position:absolute;z-index:1;bottom:7%;height:16%;width:25%;filter:brightness(.72)}.iso-plinth-side.left{left:25%;background:#303941;clip-path:polygon(0 0,100% 100%,100% 52%,0 0)}.iso-plinth-side.right{right:25%;background:#242d34;clip-path:polygon(0 100%,100% 0,100% 0,0 52%)}.iso-building-art{position:absolute;z-index:5;left:50%;bottom:20%;width:62%;height:62%;transform:translateX(-50%) scaleY(1.08);filter:drop-shadow(10px 14px 6px rgba(0,0,0,.58))}.iso-detail{position:absolute;z-index:4;display:block}.iso-detail.d1{left:8%;bottom:24%;width:15%;height:12%;background:#89918d;border:2px solid #1e292e;box-shadow:3px 4px 0 #1b2124}.iso-detail.d2{right:8%;bottom:20%;width:13%;height:14%;background:#536b74;border:2px solid #182229;box-shadow:3px 4px 0 #171d20}.iso-detail.d3{right:15%;bottom:38%;width:5%;height:22%;background:#87999b;border-radius:3px 3px 0 0;box-shadow:2px 3px 0 #20292c}.detail-industrial .d1{width:22%;height:11%;background:#79583f}.detail-industrial .d2{width:16%;height:19%;background:#697273}.detail-industrial .d3{height:31%;width:6%;background:#667276}.detail-power .d1{width:26%;height:8%;transform:skewY(-18deg);background:#41647f}.detail-power .d2{width:22%;height:8%;transform:skewY(-18deg);background:#496b85}.detail-power .d3{height:26%;background:#927a49}.detail-utility .d1{border-radius:50%;width:17%;height:16%;background:#5d8091}.detail-utility .d2{border-radius:50%;width:15%;height:14%;background:#7593a0}.detail-utility .d3{width:4%;height:23%;background:#78909a}.detail-habitat .d1{width:18%;height:8%;background:#85765b}.detail-habitat .d2{width:17%;height:8%;background:#786f5b}.detail-habitat .d3{height:16%;background:#879698}.detail-science .d1{border-radius:50%;width:13%;height:13%;background:#7f999d}.detail-science .d2{width:18%;height:8%;background:#607985}.detail-science .d3{height:33%;width:4%;background:#91a3a6}.detail-logistics .d1{width:26%;height:10%;background:#7f6648}.detail-logistics .d2{width:24%;height:10%;background:#896f4d}.detail-logistics .d3{height:21%;background:#899696}.iso-status-light{position:absolute;z-index:7;left:51%;top:8%;width:6px;height:6px;border-radius:50%;background:#ffd86a;box-shadow:0 0 10px 3px #ffc84c;animation:noxia-status-pulse 1.9s ease-in-out infinite}.iso-ground-light{position:absolute;z-index:3;left:37%;right:37%;bottom:13%;height:9%;border-radius:50%;background:rgba(255,204,91,.2);filter:blur(5px);animation:noxia-ground-pulse 2.8s ease-in-out infinite}.iso-building.operational .iso-building-art{animation:noxia-building-breathe 4.2s ease-in-out infinite}
.construction-apron{filter:saturate(.55);background:linear-gradient(135deg,#705f43,#37342f 58%,#25282a)}.construction-foundation{position:absolute;z-index:2;left:27%;right:27%;bottom:14%;height:27%;background:#73736c;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);box-shadow:0 7px 0 #393b3a}.construction-frame{position:absolute;z-index:4;bottom:28%;width:4px;height:42%;background:#c08e45;box-shadow:2px 2px 0 #4c3b28}.construction-frame:after{content:'';position:absolute;left:-15px;top:4px;width:34px;height:3px;background:#a8783c}.construction-frame.f1{left:35%}.construction-frame.f2{left:46%;height:50%}.construction-frame.f3{right:43%;height:47%}.construction-frame.f4{right:32%;height:38%}.construction-shell{position:absolute;z-index:5;left:50%;bottom:20%;width:62%;height:62%;transform:translateX(-50%) scaleY(1.08);filter:grayscale(.75) opacity(.64) drop-shadow(8px 12px 5px #0008)}.phase-commissioning .construction-shell{filter:saturate(.75) opacity(.88) drop-shadow(8px 12px 5px #0008)}.construction-crane{position:absolute;z-index:6;right:18%;bottom:24%;width:4px;height:64%;background:#c79742;transform:skewY(-4deg);box-shadow:2px 2px #392d21}.construction-crane i{position:absolute;top:0;right:0;width:48px;height:3px;background:#d0a14c}.construction-crane b{position:absolute;top:3px;right:34px;width:1px;height:26px;background:#8f754c;animation:noxia-hook 2.2s ease-in-out infinite}.construction-light{position:absolute;z-index:8;left:38%;bottom:31%;width:5px;height:5px;border-radius:50%;background:#ffd45c;box-shadow:0 0 9px #ffd45c;animation:noxia-status-pulse 1.2s infinite}.construction-light.l2{left:auto;right:36%;animation-delay:.5s}
@keyframes noxia-status-pulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes noxia-ground-pulse{0%,100%{opacity:.4}50%{opacity:.95}}@keyframes noxia-building-breathe{0%,100%{transform:translateX(-50%) translateY(0) scaleY(1.08)}50%{transform:translateX(-50%) translateY(-2px) scaleY(1.08)}}@keyframes noxia-hook{0%,100%{height:18px}50%{height:34px}}
`}</style>}
