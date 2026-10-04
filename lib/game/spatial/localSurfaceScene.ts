export type LocalSurfacePoint = { xM:number; yM:number }

export type LocalSurfacePathKind =
  | 'road'
  | 'rail'
  | 'waterway'
  | 'service-path'
  | 'pressurized-corridor'
  | 'surface-tube'
  | 'tether-corridor'
  | 'anchor-line'
  | 'cargo-transfer-link'
  | 'eva-route'

export type LocalSurfacePath = {
  id:string
  kind:LocalSurfacePathKind
  points:LocalSurfacePoint[]
  className?:string
}

export type LocalSurfacePolygonKind =
  | 'water'
  | 'forest'
  | 'vegetation'
  | 'farmland'
  | 'urban'
  | 'terrain-zone'

export type LocalSurfacePolygon = {
  id:string
  kind:LocalSurfacePolygonKind
  points:LocalSurfacePoint[]
  provenance?:'observed'|'derived'|'synthetic'
}

export type LocalSurfaceBuilding = {
  id:string
  center:LocalSurfacePoint
  widthM:number
  depthM:number
  rotationDeg:number
  provenance:'observed'|'derived'|'synthetic'|'canonical'
  label?:string
  entityId?:string|null
}

export type LocalSurfaceMobileObject = {
  id:string
  point:LocalSurfacePoint
  label:string
  role?:string
}

export type LocalSurfaceScene = {
  body:string
  frameId:string
  radiusM:number
  paths:LocalSurfacePath[]
  polygons:LocalSurfacePolygon[]
  buildings:LocalSurfaceBuilding[]
  mobileObjects:LocalSurfaceMobileObject[]
  roadGraph:LocalSurfacePath[]
  railGraph:LocalSurfacePath[]
}

export function buildLocalSurfaceScene(input:{
  body:string
  frameId:string
  radiusM:number
  paths?:LocalSurfacePath[]
  polygons?:LocalSurfacePolygon[]
  buildings?:LocalSurfaceBuilding[]
  mobileObjects?:LocalSurfaceMobileObject[]
}):LocalSurfaceScene{
  const paths=input.paths??[]
  return {
    body:input.body,
    frameId:input.frameId,
    radiusM:input.radiusM,
    paths,
    polygons:input.polygons??[],
    buildings:input.buildings??[],
    mobileObjects:input.mobileObjects??[],
    roadGraph:paths.filter(path=>path.kind==='road'||path.kind==='service-path'),
    railGraph:paths.filter(path=>path.kind==='rail'),
  }
}