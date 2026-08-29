// lib/game/streetTiles.ts
// Gemeinsame Abstraktionsgrenze für 2D-Grid und begehbare Kolonieansicht.

import { generateGrid } from '@/lib/grid/generateGrid'

export interface StreetTile {
  row: number
  col: number
  subtype: 'main' | 'side' | 'crossing'
  mask: number
  entityId?: string
  builtAt?: string
  ownerClass?: string
}

function roadMask(type: string): number | null {
  if (type === 'road') return 0
  const match = type.match(/^road_(\d+)$/)
  return match ? Number(match[1]) : null
}

function classify(mask: number): StreetTile['subtype'] {
  // N/E/S/W bits: 1/2/4/8. Three or four connections are crossings;
  // straight four-neighbour segments form the public main network.
  const connections = [1, 2, 4, 8].filter(bit => (mask & bit) !== 0).length
  if (connections >= 3) return 'crossing'
  if (mask === 5 || mask === 10) return 'main'
  return 'side'
}

function inferredMask(row:number,col:number,positions:Set<string>):number {
  let mask=0
  if(positions.has(`${row-1}:${col}`)) mask|=1
  if(positions.has(`${row}:${col+1}`)) mask|=2
  if(positions.has(`${row+1}:${col}`)) mask|=4
  if(positions.has(`${row}:${col-1}`)) mask|=8
  return mask
}

/**
 * Returns exactly the road cells produced by the same canonical grid that is
 * rendered in the 2D view. The colony view must never synthesize a second road
 * network: building, removing or changing a grid road therefore affects both
 * representations.
 *
 * Legacy/plain `road` cells carry mask 0. For presentation and walkability we
 * infer only their connection mask from immediately adjacent canonical road
 * cells. No additional road cells are created, so the grid remains source of
 * truth while dead-end crosses and disconnected-looking half segments vanish.
 */
export function getStreetTiles(
  locationSlug: string,
  population: number,
  entities: any[],
  pending: any[],
  userId: string,
  cols: number = 32,
  rows: number = 24,
): StreetTile[] {
  const grid = generateGrid(locationSlug, population, entities, pending, userId, cols, rows)
  const raw: Array<{row:number;col:number;mask:number}> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c]
      if (!cell) continue
      const mask = roadMask(cell.type)
      if (mask === null) continue
      raw.push({ row:r, col:c, mask })
    }
  }

  const positions=new Set(raw.map(s=>`${s.row}:${s.col}`))
  return raw.map(s=>{
    const mask=s.mask===0?inferredMask(s.row,s.col,positions):s.mask
    return { ...s, mask, subtype:classify(mask) }
  })
}

export function nearestStreetTile(row:number,col:number,streets:StreetTile[]):StreetTile|null {
  if (!streets.length) return null
  return streets.reduce((best,s) => Math.abs(s.row-row)+Math.abs(s.col-col) < Math.abs(best.row-row)+Math.abs(best.col-col) ? s : best)
}

export function isStreet(row:number,col:number,streets:StreetTile[]):boolean {
  return streets.some(s=>s.row===row&&s.col===col)
}

export function connectedStreetNeighbours(tile:StreetTile,streets:StreetTile[]):StreetTile[] {
  const byPos = new Map(streets.map(s=>[`${s.row}:${s.col}`,s]))
  const candidates:[[number,number,number,number],[number,number,number,number],[number,number,number,number],[number,number,number,number]] = [
    [-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2],
  ]
  return candidates.flatMap(([dr,dc,outBit,inBit])=>{
    const next=byPos.get(`${tile.row+dr}:${tile.col+dc}`)
    if(!next) return []
    if(tile.mask!==0 && (tile.mask&outBit)===0) return []
    if(next.mask!==0 && (next.mask&inBit)===0) return []
    return [next]
  })
}
