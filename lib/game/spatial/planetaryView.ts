import { PLANETARY_REFERENCES, localEnuToPlanetary, planetaryToLocalEnu } from './planetary'
import type { PlanetaryCoordinate, WorldBody } from './types'

export type SurfaceBody = Exclude<WorldBody, 'other'>

export interface PlanetaryViewAnchor {
  body: SurfaceBody
  id: string
  name: string
  origin: PlanetaryCoordinate
  chunkSizeM: number
  cellSizeM: number
}

export interface PlanetaryChunkCoord { x: number; y: number }
export interface PlanetaryChunkCell { chunk: PlanetaryChunkCoord; localX: number; localY: number }

export const DEFAULT_PLANETARY_CHUNK_SIZE_M=1_000
export const DEFAULT_PLANETARY_CELL_SIZE_M=10

function normalizeLongitude(lonDeg:number){
  const wrapped=((lonDeg+180)%360+360)%360-180
  return wrapped===-180?180:wrapped
}

export function validatePlanetaryCoordinate(point:PlanetaryCoordinate):PlanetaryCoordinate{
  if(!Number.isFinite(point.latDeg)||point.latDeg < -90||point.latDeg > 90)throw new Error(`Invalid latitude: ${point.latDeg}`)
  if(!Number.isFinite(point.lonDeg))throw new Error(`Invalid longitude: ${point.lonDeg}`)
  return {...point,lonDeg:normalizeLongitude(point.lonDeg)}
}

export function createPlanetaryViewAnchor(body:SurfaceBody,origin:PlanetaryCoordinate,options:{name?:string;chunkSizeM?:number;cellSizeM?:number}={}):PlanetaryViewAnchor{
  const validated=validatePlanetaryCoordinate(origin)
  const lat=Number(validated.latDeg.toFixed(6)),lon=Number(validated.lonDeg.toFixed(6))
  return {body,id:`${body}-view-${lat}-${lon}`,name:options.name??`${body} · local view`,origin:{...validated,latDeg:lat,lonDeg:lon},chunkSizeM:options.chunkSizeM??DEFAULT_PLANETARY_CHUNK_SIZE_M,cellSizeM:options.cellSizeM??DEFAULT_PLANETARY_CELL_SIZE_M}
}

export function planetaryViewToLocalMeters(point:PlanetaryCoordinate,view:PlanetaryViewAnchor){
  const local=planetaryToLocalEnu(validatePlanetaryCoordinate(point),view.origin,PLANETARY_REFERENCES[view.body])
  return {eastM:local.eastM,northM:local.northM,upM:local.upM}
}

export function localMetersToPlanetaryView(point:{eastM:number;northM:number;upM?:number},view:PlanetaryViewAnchor){
  return localEnuToPlanetary({eastM:point.eastM,northM:point.northM,upM:point.upM??0},view.origin,PLANETARY_REFERENCES[view.body])
}

export function planetaryMetricToChunk(point:{eastM:number;northM:number},chunkSizeM=DEFAULT_PLANETARY_CHUNK_SIZE_M):PlanetaryChunkCoord{
  return{x:Math.floor(point.eastM/chunkSizeM),y:Math.floor(point.northM/chunkSizeM)}
}

export function planetaryMetricToChunkCell(point:{eastM:number;northM:number},chunkSizeM=DEFAULT_PLANETARY_CHUNK_SIZE_M,cellSizeM=DEFAULT_PLANETARY_CELL_SIZE_M):PlanetaryChunkCell{
  if(chunkSizeM<=0||cellSizeM<=0||chunkSizeM%cellSizeM!==0)throw new Error('chunkSizeM must be a positive multiple of cellSizeM')
  const chunk=planetaryMetricToChunk(point,chunkSizeM)
  return{chunk,localX:Math.floor((point.eastM-chunk.x*chunkSizeM)/cellSizeM),localY:Math.floor((point.northM-chunk.y*chunkSizeM)/cellSizeM)}
}

export function planetaryChunkKey(view:PlanetaryViewAnchor,chunk:PlanetaryChunkCoord){
  return `${view.body}:${view.id}:${chunk.x}:${chunk.y}`
}
