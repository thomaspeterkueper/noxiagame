export type GeoPoint = { lat:number; lon:number }

export type MetricFootprint = {
  widthM:number
  depthM:number
  heightM?:number
  orientationDeg?:number
}

export type SpatialPlacement = {
  anchor:GeoPoint
  footprint:MetricFootprint
}

export function metersPerDegree(lat:number){
  const phi=lat*Math.PI/180
  return {
    lat:111132.92 - 559.82*Math.cos(2*phi) + 1.175*Math.cos(4*phi),
    lon:111412.84*Math.cos(phi) - 93.5*Math.cos(3*phi),
  }
}

export function offsetGeoPoint(origin:GeoPoint,eastM:number,northM:number):GeoPoint{
  const scale=metersPerDegree(origin.lat)
  return {lat:origin.lat+northM/scale.lat,lon:origin.lon+eastM/scale.lon}
}

export function distanceMeters(a:GeoPoint,b:GeoPoint){
  const mid=(a.lat+b.lat)/2
  const scale=metersPerDegree(mid)
  const east=(b.lon-a.lon)*scale.lon
  const north=(b.lat-a.lat)*scale.lat
  return Math.hypot(east,north)
}

export function footprintCorners(placement:SpatialPlacement):GeoPoint[]{
  const {widthM,depthM,orientationDeg=0}=placement.footprint
  const r=orientationDeg*Math.PI/180
  const halfW=widthM/2,halfD=depthM/2
  return [[-halfW,-halfD],[halfW,-halfD],[halfW,halfD],[-halfW,halfD]].map(([x,y])=>{
    const east=x*Math.cos(r)-y*Math.sin(r)
    const north=x*Math.sin(r)+y*Math.cos(r)
    return offsetGeoPoint(placement.anchor,east,north)
  })
}
