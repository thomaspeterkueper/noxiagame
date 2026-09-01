import { getFixedTerrain } from './locationMaps'
import { getSeedRoadCells } from '@/lib/game/seeds/tharsisHubSeed'

export const COLS=12
export const ROWS=8
export type CellOwner='own'|'other'|'state'|null
export interface Cell{type:string;owner:CellOwner;anomaly?:boolean}
export interface GridEntity{entity_id:string;profile_id:string|null;is_state_owned?:boolean;entity_type:string;tile_row:number;tile_col:number;owner_class?:string}
export interface GridPending{buildable_id:string;tile_row:number;tile_col:number;status:string}

export function seededRandom(seed:number,i:number){const x=Math.sin(seed+i)*10000;return x-Math.floor(x)}
export function isBuildable(tileType:string){return tileType==='tile_surface'||tileType==='tile_grass'||tileType==='tile_urban'||tileType==='tile_farmland'||tileType==='tile_city'||tileType==='tile_spaceport'||tileType==='tile_mare'||tileType==='tile_highland'||tileType==='tile_research'||tileType==='tile_ice'||tileType==='tile_helium3'||tileType==='tile_titanium'||tileType==='tile_dust'||tileType==='tile_plateau'||tileType==='tile_metal'||tileType==='tile_crater'||tileType==='tile_shaft'||tileType.startsWith('road_')}
export const NPC_ENTITY:Record<string,string>={npc_mine:'mine',npc_solar:'solar',npc_habitat:'habitat'}
function terrainIs(grid:Cell[][],r:number,c:number,prefix:string){return r>=0&&r<grid.length&&c>=0&&c<grid[r].length&&grid[r][c].type.startsWith(prefix)}
function autotilePrefix(grid:Cell[][],prefix:string,outPrefix:string){const rows=grid.length,cols=grid[0]?.length??0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(grid[r][c].type!==prefix)continue;let mask=0;if(terrainIs(grid,r-1,c,prefix)||terrainIs(grid,r-1,c,outPrefix))mask|=1;if(terrainIs(grid,r,c+1,prefix)||terrainIs(grid,r,c+1,outPrefix))mask|=2;if(terrainIs(grid,r+1,c,prefix)||terrainIs(grid,r+1,c,outPrefix))mask|=4;if(terrainIs(grid,r,c-1,prefix)||terrainIs(grid,r,c-1,outPrefix))mask|=8;grid[r][c]={...grid[r][c],type:`${outPrefix}${mask}`}}}
function fallbackTerrain(slug:string,seed:number,r:number,c:number,cols:number){const rand=seededRandom(seed,r*cols+c);if(slug==='earth'){if(rand<.16)return'tile_forest_dense';if(rand<.31)return'tile_forest_edge';if(rand<.40)return'tile_city';if(rand<.45)return'tile_farmland';return'tile_grass'}if(slug==='moon')return rand<.06?'tile_crater':rand<.18?'tile_highland':'tile_surface';if(slug==='mars')return rand<.08?'tile_crater':rand<.13?'tile_canyon':rand<.30?'tile_dust':'tile_surface';return rand<.10?'tile_shaft':rand<.15?'tile_metal':'tile_surface'}
function addSeedRoadNetwork(grid:Cell[][],slug:string,rows:number,cols:number){if(slug!=='mars')return;for(const[r,c]of getSeedRoadCells(slug)){if(r<0||r>=rows||c<0||c>=cols)continue;if(isBuildable(grid[r][c].type)||grid[r][c].type.startsWith('road'))grid[r][c]={type:'road',owner:null}}}
function addRoadNetwork(grid:Cell[][],population:number,userId:string|undefined,rows:number,cols:number){const centerR=Math.floor(rows/2);if(population<=200)return;for(let c=0;c<cols;c++)if(isBuildable(grid[centerR][c].type))grid[centerR][c]={type:'road',owner:userId?'state':null};const span=Math.min(Math.floor(population/400)+1,3);for(let q=1;q<=span;q++){const qc=Math.round(cols*q/(span+1)),reach=Math.min(2+Math.floor(population/600),rows);for(let r=centerR-reach;r<=centerR+reach;r++){if(r<0||r>=rows)continue;if(isBuildable(grid[r][qc].type))grid[r][qc]={type:'road',owner:userId?'state':null}}}}
function autotileRoads(grid:Cell[][],rows:number,cols:number){const isRoad=(r:number,c:number)=>r>=0&&r<rows&&c>=0&&c<cols&&grid[r][c].type.startsWith('road');for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(grid[r][c].type!=='road')continue;let mask=0;if(isRoad(r-1,c))mask|=1;if(isRoad(r,c+1))mask|=2;if(isRoad(r+1,c))mask|=4;if(isRoad(r,c-1))mask|=8;grid[r][c]={type:`road_${mask}`,owner:null}}}

export function generateGrid(slug:string,population:number,entities:GridEntity[],pending:GridPending[],userId?:string,cols:number=COLS,rows:number=ROWS):Cell[][]{
 const grid:Cell[][]=[],seed=slug.split('').reduce((a,c)=>a+c.charCodeAt(0),0)
 for(let r=0;r<rows;r++){const row:Cell[]=[];for(let c=0;c<cols;c++){const fixed=getFixedTerrain(slug,r,c);row.push({type:fixed??fallbackTerrain(slug,seed,r,c,cols),owner:null})}grid.push(row)}
 autotilePrefix(grid,'river','river_')
 if(slug==='mars')addSeedRoadNetwork(grid,slug,rows,cols);else addRoadNetwork(grid,population,userId,rows,cols)
 for(const e of entities){if(e.tile_row<0||e.tile_row>=rows||e.tile_col<0||e.tile_col>=cols)continue;if(e.entity_type==='building'&&e.entity_id==='road'){grid[e.tile_row][e.tile_col]={type:'road',owner:null};continue}const owner:CellOwner=!userId?null:e.owner_class==='STATE'||e.owner_class==='CORPORATION'||e.profile_id===null?'state':e.profile_id===userId?'own':'other';grid[e.tile_row][e.tile_col]={type:`building_${e.entity_id}`,owner}}
 autotileRoads(grid,rows,cols)
 for(const p of pending)if(p.tile_row>=0&&p.tile_row<rows&&p.tile_col>=0&&p.tile_col<cols)grid[p.tile_row][p.tile_col]={type:p.status==='building'?'building_construction':`building_${p.buildable_id}`,owner:null}
 return grid
}
function sides(type:string,prefix:string){const m=type.startsWith(prefix)?parseInt(type.slice(prefix.length),10)||0:0;return{n:!!(m&1),o:!!(m&2),s:!!(m&4),w:!!(m&8)}}
export function roadSides(type:string){return sides(type,'road_')}
export function riverSides(type:string){return sides(type,'river_')}
export function gridTypes(grid:Cell[][]){return grid.map(row=>row.map(cell=>cell.type))}
// Compatibility only. Discoveries now come from /api/game/scanner and scanner_discoveries.
export function anomalyAt(_grid:Cell[][]):{r:number;c:number}|null{return null}
