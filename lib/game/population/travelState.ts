import { positionOnStreetPath, shortestStreetPath } from '../npcStreetMovement'
import { nearestStreetTile, type StreetTile } from '../streetTiles'

export interface TravelAnchor {tileEntityId:string;locationId:string;row:number;col:number}
export interface PersonTravelState {
 personId:string;locationId:string;fromTileEntityId:string;toTileEntityId:string;route:{row:number;col:number}[];progress:number;status:'active'|'arrived'|'blocked'|'cancelled';startedTick:number;updatedTick:number
}
export function createTravelState(input:{personId:string;from:TravelAnchor;to:TravelAnchor;streets:StreetTile[];tick:number}):PersonTravelState|null{
 if(input.from.locationId!==input.to.locationId||input.from.tileEntityId===input.to.tileEntityId)return null
 const start=nearestStreetTile(input.from.row,input.from.col,input.streets),end=nearestStreetTile(input.to.row,input.to.col,input.streets)
 const route=shortestStreetPath(start,end,input.streets).map(({row,col})=>({row,col}))
 if(route.length<2)return null
 return {personId:input.personId,locationId:input.from.locationId,fromTileEntityId:input.from.tileEntityId,toTileEntityId:input.to.tileEntityId,route,progress:0,status:'active',startedTick:input.tick,updatedTick:input.tick}
}
export function advanceTravel(state:PersonTravelState,tick:number,step=0.08):PersonTravelState{
 if(state.status!=='active')return state
 const progress=Math.min(1,state.progress+Math.max(0,step))
 return {...state,progress,status:progress>=1?'arrived':'active',updatedTick:tick}
}
export function travelStreetPoint(state:PersonTravelState){return positionOnStreetPath(state.route,state.progress)}
