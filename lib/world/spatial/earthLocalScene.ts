// lib/world/spatial/earthLocalScene.ts
// Aktualisiert: 12.10.2026 — reale Gebäudeumrisse an die Szene weitergeben; Strand- und Felsflächen in die Szene übernehmen; Flächen/Linien per Bounding-Box statt Eckpunkt-Test (große Wälder/Wiesen fielen heraus), abgeleitete Bebauung nur ohne reale Footprints, Landnutzungsklasse an Flächen
// Version:      1.3.1

import { geoToLocalMeters, type GeoPoint } from './earthSpatial'
import { buildLocalSurfaceScene, type LocalSurfaceBuilding, type LocalSurfacePath, type LocalSurfacePoint, type LocalSurfacePolygon, type LocalSurfaceScene } from '@/lib/game/spatial/localSurfaceScene'

export type EarthSceneFeature = {
  id: string
  featureType: string
  geometry: { kind: 'point'|'line'|'polygon'; coordinates: GeoPoint|GeoPoint[] }
  properties?: Record<string, unknown>
}

export type ScenePoint = LocalSurfacePoint
export type ScenePath = LocalSurfacePath
export type ScenePolygon = LocalSurfacePolygon
export type SceneBuilding = LocalSurfaceBuilding
export type EarthLocalScene = LocalSurfaceScene & { origin: GeoPoint }

function hash(value:string){
  let h=2166136261
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}
/** Shared profile id of the local detail layer (footprints, paths, watercourses). */
// v3 (25.10.2026): zusätzlich benannte Läden und Lokale als Punkte (feature_type 'poi')
export const EARTH_LOCAL_ENRICHMENT_PROFILE='local-scene-v3'

function inside(point:LocalSurfacePoint,radiusM:number){return Math.abs(point.xM)<=radiusM&&Math.abs(point.yM)<=radiusM}
// A forest or meadow that encloses the scene has no vertex inside it, and a
// long road segment can cross it the same way. Test the extent, not vertices.
function touchesScene(points:LocalSurfacePoint[],radiusM:number){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  for(const point of points){
    if(point.xM<minX)minX=point.xM
    if(point.xM>maxX)maxX=point.xM
    if(point.yM<minY)minY=point.yM
    if(point.yM>maxY)maxY=point.yM
  }
  return minX<=radiusM&&maxX>=-radiusM&&minY<=radiusM&&maxY>=-radiusM
}
function toScenePoint(point: GeoPoint, origin: GeoPoint): ScenePoint {
  const local = geoToLocalMeters(point, origin)
  return { xM: local.eastM, yM: local.northM }
}
function pointsOf(feature:EarthSceneFeature,origin:GeoPoint): ScenePoint[]{
  if(feature.geometry.kind==='point')return [toScenePoint(feature.geometry.coordinates as GeoPoint,origin)]
  return (feature.geometry.coordinates as GeoPoint[]).map(point=>toScenePoint(point,origin))
}
function polygonBounds(points:LocalSurfacePoint[]){
  const xs=points.map(p=>p.xM),ys=points.map(p=>p.yM)
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
}

export function buildEarthLocalScene(input:{
  origin:GeoPoint
  features:EarthSceneFeature[]
  radiusM?:number
}):EarthLocalScene{
  const radiusM=input.radiusM??260
  const paths:LocalSurfacePath[]=[]
  const polygons:LocalSurfacePolygon[]=[]
  const buildings:LocalSurfaceBuilding[]=[]
  const derivedBuildings:LocalSurfaceBuilding[]=[]

  for(const feature of input.features){
    const points=pointsOf(feature,input.origin)
    if(points.length===0||!touchesScene(points,radiusM*1.25))continue

    if((feature.featureType==='road'||feature.featureType==='rail'||feature.featureType==='waterway')&&points.length>=2){
      paths.push({
        id:feature.id,
        kind:feature.featureType,
        points,
        className:String(feature.properties?.highway??feature.properties?.railway??feature.properties?.waterway??feature.featureType),
      })
      continue
    }

    if(['water','forest','vegetation','farmland','urban','beach','rock'].includes(feature.featureType)&&feature.geometry.kind==='polygon'&&points.length>=3){
      polygons.push({id:feature.id,kind:feature.featureType as LocalSurfacePolygon['kind'],points,provenance:'observed',className:String(feature.properties?.landuse??feature.properties?.natural??feature.properties?.landcover??feature.properties?.leisure??feature.featureType)})
      if(feature.featureType==='urban'){
        // Until real building footprints are available, derive sparse visual
        // massing from observed urban polygons. These objects are explicitly
        // non-canonical and must never be persisted as real buildings.
        const bounds=polygonBounds(points)
        const h=hash(feature.id)
        const width=Math.max(0,bounds.maxX-bounds.minX)
        const depth=Math.max(0,bounds.maxY-bounds.minY)
        const count=Math.min(10,Math.max(1,Math.floor((width*depth)/9000)))
        for(let i=0;i<count;i++){
          const seed=(h+Math.imul(i+1,2654435761))>>>0
          const x=bounds.minX+((seed%997)/997)*width
          const y=bounds.minY+(((seed>>>10)%991)/991)*depth
          if(!inside({xM:x,yM:y},radiusM))continue
          derivedBuildings.push({
            id:`derived:${feature.id}:${i}`,
            center:{xM:x,yM:y},
            widthM:10+(seed%18),
            depthM:8+((seed>>>7)%14),
            rotationDeg:(seed%4)*90,
            provenance:'derived',
            label:'abgeleitete Bebauung',
          })
        }
      }
      continue
    }

    if(feature.featureType==='building'&&feature.geometry.kind==='polygon'&&points.length>=3){
      const bounds=polygonBounds(points)
      buildings.push({
        id:feature.id,
        center:{xM:(bounds.minX+bounds.maxX)/2,yM:(bounds.minY+bounds.maxY)/2},
        widthM:Math.max(4,bounds.maxX-bounds.minX),
        depthM:Math.max(4,bounds.maxY-bounds.minY),
        rotationDeg:0,
        provenance:'observed',
        label:String(feature.properties?.name??'Gebäude'),
        tags:feature.properties,
        footprint:points.length>3&&points[0].xM===points[points.length-1].xM&&points[0].yM===points[points.length-1].yM?points.slice(0,-1):points,
      })
    }
  }

  return {
    ...buildLocalSurfaceScene({
      body:'earth',
      frameId:'earth-wgs84-local-enu',
      radiusM,
      paths,
      polygons,
      // Placeholder massing only stands in where no real footprint is known.
      buildings:buildings.length>0?buildings:derivedBuildings,
    }),
    origin:input.origin,
  }
}
