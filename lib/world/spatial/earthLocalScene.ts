import { geoToLocalMeters, type GeoPoint } from './earthSpatial'

export type EarthSceneFeature = {
  id: string
  featureType: string
  geometry: { kind: 'point'|'line'|'polygon'; coordinates: GeoPoint|GeoPoint[] }
  properties?: Record<string, unknown>
}

export type ScenePoint = { xM:number; yM:number }
export type ScenePath = { id:string; kind:'road'|'rail'|'waterway'; points:ScenePoint[]; className?:string }
export type ScenePolygon = { id:string; kind:'water'|'forest'|'vegetation'|'farmland'|'urban'; points:ScenePoint[] }
export type SceneBuilding = {
  id:string
  center:ScenePoint
  widthM:number
  depthM:number
  rotationDeg:number
  provenance:'observed'|'derived'
  label?:string
}
export type EarthLocalScene = {
  origin: GeoPoint
  radiusM: number
  paths: ScenePath[]
  polygons: ScenePolygon[]
  buildings: SceneBuilding[]
  roadGraph: ScenePath[]
  railGraph: ScenePath[]
}

function hash(value:string){
  let h=2166136261
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}
function inside(point:ScenePoint,radiusM:number){return Math.abs(point.xM)<=radiusM&&Math.abs(point.yM)<=radiusM}
function pointsOf(feature:EarthSceneFeature,origin:GeoPoint){
  if(feature.geometry.kind==='point')return [geoToLocalMeters(feature.geometry.coordinates as GeoPoint,origin)]
  return (feature.geometry.coordinates as GeoPoint[]).map(point=>geoToLocalMeters(point,origin))
}
function polygonBounds(points:ScenePoint[]){
  const xs=points.map(p=>p.xM),ys=points.map(p=>p.yM)
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
}

export function buildEarthLocalScene(input:{
  origin:GeoPoint
  features:EarthSceneFeature[]
  radiusM?:number
}):EarthLocalScene{
  const radiusM=input.radiusM??260
  const paths:ScenePath[]=[]
  const polygons:ScenePolygon[]=[]
  const buildings:SceneBuilding[]=[]

  for(const feature of input.features){
    const points=pointsOf(feature,input.origin)
    if(points.length===0||!points.some(point=>inside(point,radiusM*1.25)))continue

    if((feature.featureType==='road'||feature.featureType==='rail'||feature.featureType==='waterway')&&points.length>=2){
      paths.push({
        id:feature.id,
        kind:feature.featureType,
        points,
        className:String(feature.properties?.highway??feature.properties?.railway??feature.featureType),
      })
      continue
    }

    if(['water','forest','vegetation','farmland','urban'].includes(feature.featureType)&&feature.geometry.kind==='polygon'&&points.length>=3){
      polygons.push({id:feature.id,kind:feature.featureType as ScenePolygon['kind'],points})
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
          buildings.push({
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
      })
    }
  }

  return {
    origin:input.origin,
    radiusM,
    paths,
    polygons,
    buildings,
    roadGraph:paths.filter(path=>path.kind==='road'),
    railGraph:paths.filter(path=>path.kind==='rail'),
  }
}
