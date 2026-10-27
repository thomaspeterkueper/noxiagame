// Isolated Seelenberg integration fixture. NOT a replacement for the Core logistics runtime.
// Only a valid route can release the current vehicle's cargo into the depot.
import {initialState,advance,conserved} from './simulation.mjs';
import {roadGraph,shortestRoute} from './road-graph.mjs';
export function newVillage(geojson,origin,destination){
 const graph=roadGraph(geojson);
 return {graph,origin,destination,economy:initialState(),trace:[]};
}
export function villageTick(village,{blockedWays=[],demand=5,production=6,load=8}={}){
 const route=shortestRoute(village.graph,village.origin,village.destination,{blockedWays});
 // Existing fixture uses "blocked" to retain in-transit cargo.  Missing/unmapped roads fail closed.
 const economy=advance(village.economy,{blocked:route.status!=='ok',demand,production,load});
 if(!conserved(economy))throw new Error('inventory invariant violated');
 return {...village,economy,trace:[...village.trace,{tick:economy.tick,routeStatus:route.status,routeMeters:route.status==='ok'?route.distanceMeters:null,vehicle:economy.vehicle,depot:economy.depot,requests:economy.requests}]};
}
