import { THARSIS_HUB_ROADS, type RoadKind } from './tharsisHubSeed'
import type { PreparedCorridor } from '@/app/components/PlanetarySurfaceMap'

const TILE_M = 20
const COL_CENTER = 15.5
const ROW_CENTER = 11.5

function metric(row:number,col:number){
  return {
    xM:(col-COL_CENTER)*TILE_M,
    yM:(ROW_CENTER-row)*TILE_M,
  }
}

function corridorKind(a:RoadKind,b:RoadKind):PreparedCorridor['kind']{
  const hardened = a==='ring'||a==='freight'||b==='ring'||b==='freight'
  return hardened?'hardened-road':'prepared-track'
}

/**
 * Converts the canonical 32x24 Tharsis seed road cells into metric surface edges.
 * Each physical adjacency is emitted once, so the old tile network becomes a
 * connected graph instead of a collection of visual road tiles.
 */
export const THARSIS_HUB_SURFACE_CORRIDORS: PreparedCorridor[] = (() => {
  const byCell=new Map<string,{row:number;col:number;kind:RoadKind}>()
  for(const road of THARSIS_HUB_ROADS)byCell.set(road.row+':'+road.col,road)

  const out:PreparedCorridor[]=[]
  const seen=new Set<string>()
  let index=0

  for(const road of byCell.values()){
    for(const [dr,dc] of [[0,1],[1,0]] as const){
      const other=byCell.get((road.row+dr)+':'+(road.col+dc))
      if(!other)continue
      const key=[road.row+':'+road.col,other.row+':'+other.col].sort().join('|')
      if(seen.has(key))continue
      seen.add(key)
      out.push({
        id:'tharsis-road-'+index++,
        kind:corridorKind(road.kind,other.kind),
        points:[metric(road.row,road.col),metric(other.row,other.col)],
      })
    }
  }

  return out
})()

export function tharsisRoadStats(){
  return {
    cells:THARSIS_HUB_ROADS.length,
    corridors:THARSIS_HUB_SURFACE_CORRIDORS.length,
    hardened:THARSIS_HUB_SURFACE_CORRIDORS.filter(c=>c.kind==='hardened-road').length,
    prepared:THARSIS_HUB_SURFACE_CORRIDORS.filter(c=>c.kind==='prepared-track').length,
  }
}
