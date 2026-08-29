import { connectedStreetNeighbours, type StreetTile } from './streetTiles'

export interface StreetPoint { row:number; col:number }

/** Deterministic shortest route across the canonical street graph. */
export function shortestStreetPath(start:StreetTile|null,end:StreetTile|null,streets:StreetTile[]):StreetTile[] {
  if(!start||!end) return []
  if(start.row===end.row&&start.col===end.col) return [start]
  const key=(s:StreetPoint)=>`${s.row}:${s.col}`
  const byKey=new Map(streets.map(s=>[key(s),s]))
  const startKey=key(start),endKey=key(end)
  const queue=[startKey]
  const prev=new Map<string,string|null>([[startKey,null]])
  for(let i=0;i<queue.length;i++){
    const current=byKey.get(queue[i])
    if(!current) continue
    for(const next of connectedStreetNeighbours(current,streets)){
      const nk=key(next)
      if(prev.has(nk)) continue
      prev.set(nk,queue[i])
      if(nk===endKey){
        const path:StreetTile[]=[]
        let cursor:string|null=nk
        while(cursor){const tile=byKey.get(cursor);if(tile)path.push(tile);cursor=prev.get(cursor)??null}
        return path.reverse()
      }
      queue.push(nk)
    }
  }
  return [start]
}

/** Position on a path for a normalized 0..1 progress value. */
export function positionOnStreetPath(path:StreetPoint[],progress:number):StreetPoint|null {
  if(!path.length) return null
  if(path.length===1) return {row:path[0].row,col:path[0].col}
  const p=Math.max(0,Math.min(1,progress))*(path.length-1)
  const i=Math.min(path.length-2,Math.floor(p)),t=p-i,a=path[i],b=path[i+1]
  return {row:a.row+(b.row-a.row)*t,col:a.col+(b.col-a.col)*t}
}
