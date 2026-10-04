import type { PlanetarySurfaceEntity, PreparedCorridor, MobileSurfaceObject } from '@/app/components/PlanetarySurfaceMap'
import { buildLocalSurfaceScene, type LocalSurfaceBuilding, type LocalSurfaceMobileObject, type LocalSurfacePath, type LocalSurfaceScene } from './localSurfaceScene'

function finite(value:unknown){
  const n=typeof value==='number'?value:Number(value)
  return Number.isFinite(n)?n:null
}

export function buildPlanetaryLocalScene(input:{
  body:string
  frameId:string
  radiusM:number
  entities?:PlanetarySurfaceEntity[]
  corridors?:PreparedCorridor[]
  mobileObjects?:MobileSurfaceObject[]
}):LocalSurfaceScene{
  const buildings:LocalSurfaceBuilding[]=(input.entities??[]).flatMap(entity=>{
    const x=finite(entity.x_m),y=finite(entity.y_m)
    if(x==null||y==null)return[]
    return[{
      id:entity.id,
      center:{xM:x,yM:y},
      widthM:Math.max(4,finite(entity.footprint_width_m)??12),
      depthM:Math.max(4,finite(entity.footprint_depth_m)??12),
      rotationDeg:finite(entity.rotation_deg)??0,
      provenance:'canonical' as const,
      label:entity.name??entity.entity_id??'Gebäude',
      entityId:entity.entity_id??null,
    }]
  })

  const paths:LocalSurfacePath[]=(input.corridors??[]).map(corridor=>({
    id:corridor.id,
    kind:corridor.kind==='hardened-road'?'road':'service-path',
    points:corridor.points,
    className:corridor.kind??'prepared-track',
  }))

  const mobileObjects:LocalSurfaceMobileObject[]=(input.mobileObjects??[]).map(object=>({
    id:object.id,
    point:{xM:object.xM,yM:object.yM},
    label:object.label,
    role:object.role,
  }))

  return buildLocalSurfaceScene({
    body:input.body,
    frameId:input.frameId,
    radiusM:input.radiusM,
    paths,
    buildings,
    mobileObjects,
  })
}