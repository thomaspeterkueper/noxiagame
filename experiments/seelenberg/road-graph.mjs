// Deterministic graph derived from an imported OSM GeoJSON FeatureCollection.
// Not a production navigation engine: no turn restrictions, speed limits or legal route guarantee.
const blockedAccess = new Set(['no','private']);
const forbiddenHighway = new Set(['footway','path','pedestrian','cycleway','bridleway','steps','construction','proposed','motorway','motorway_link']);
function road(feature) {
 const t=feature?.properties?.tags||{};
 return feature?.geometry?.type==='LineString' && typeof t.highway==='string' &&
 !forbiddenHighway.has(t.highway) && !blockedAccess.has(t.access) &&
 !blockedAccess.has(t.motor_vehicle) && t.vehicle!=='no';
}
const key=p=>p.map(v=>Number(v).toFixed(7)).join(',');
function meters(a,b){const lat=(a[1]+b[1])*Math.PI/360;const dx=(a[0]-b[0])*111320*Math.cos(lat);const dy=(a[1]-b[1])*111195;return Math.hypot(dx,dy);}
export function roadGraph(fc){
 if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new Error('GeoJSON FeatureCollection required');
 const nodes=new Map(), edges=new Map();
 for(const f of fc.features.filter(road)){
   const coords=f.geometry.coordinates;
   if(!Array.isArray(coords))continue;
   for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i];
    if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2||![...a,...b].every(Number.isFinite))continue;
    const x=key(a),y=key(b),len=meters(a,b);if(x===y||len===0)continue;
    nodes.set(x,a);nodes.set(y,b);
    for(const [from,to] of [[x,y],[y,x]]){if(!edges.has(from))edges.set(from,[]);edges.get(from).push({to,meters:len,way:f.id});}
   }
 }
 return {nodes,edges};
}
export function shortestRoute(graph,start,end,{blockedWays=[]}={}){
 const source=key(start),target=key(end),excluded=new Set(blockedWays);
 if(!graph.nodes.has(source)||!graph.nodes.has(target))return {status:'unmapped-endpoint'};
 const dist=new Map([[source,0]]),from=new Map(),queue=[source],visited=new Set();
 while(queue.length){
  queue.sort((a,b)=>(dist.get(a)-dist.get(b))||a.localeCompare(b));
  const x=queue.shift();if(visited.has(x))continue;visited.add(x);
  if(x===target)break;
  for(const edge of graph.edges.get(x)||[]){
   if(excluded.has(edge.way))continue;
   const score=dist.get(x)+edge.meters;
   if(score<(dist.get(edge.to)??Infinity)){dist.set(edge.to,score);from.set(edge.to,x);queue.push(edge.to);}
  }
 }
 if(!dist.has(target))return {status:'unreachable'};
 const points=[];let cursor=target;
 while(cursor!==undefined){points.unshift(graph.nodes.get(cursor));cursor=from.get(cursor);}
 return {status:'ok',distanceMeters:dist.get(target),coordinates:points};
}
