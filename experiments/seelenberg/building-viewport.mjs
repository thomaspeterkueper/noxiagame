// Experimental viewport selection for real-world Earth building footprints.
// Pure function: no knowledge of residents, ownership or runtime gameplay.
// Bounding-box intersection is deliberately conservative; rendering may clip to viewport.
function extent(feature) {
 const rings=feature?.geometry?.coordinates;
 if(feature?.geometry?.type!=='Polygon'||!Array.isArray(rings))return null;
 let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
 for(const ring of rings)for(const p of ring||[]){
  if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
  west=Math.min(west,p[0]);east=Math.max(east,p[0]);
  south=Math.min(south,p[1]);north=Math.max(north,p[1]);
 }
 return Number.isFinite(west)?[west,south,east,north]:null;
}
export function intersectsViewport(feature,viewport){
 if(!Array.isArray(viewport)||viewport.length!==4||!viewport.every(Number.isFinite))throw new Error('invalid viewport');
 const [w,s,e,n]=viewport;
 if(w>e||s>n)throw new Error('invalid viewport bounds');
 const b=extent(feature);
 return !!b&&b[0]<=e&&b[2]>=w&&b[1]<=n&&b[3]>=s;
}
export function selectEarthBuildings(features,viewport,{limit=1200,selectedIds=[],simulatedBuildings={}}={}){
 if(!Array.isArray(features)||!Number.isInteger(limit)||limit<1)throw new Error('invalid feature selection');
 const selected=new Set(selectedIds);
 const cx=(viewport[0]+viewport[2])/2,cy=(viewport[1]+viewport[3])/2;
 const candidates=[];
 for(const f of features){
  if(!f?.properties?.tags?.building||!intersectsViewport(f,viewport))continue;
  const b=extent(f);
  const simulated=Object.hasOwn(simulatedBuildings,f.id);
  const pinned=selected.has(f.id);
  candidates.push({feature:f,rank:pinned?0:simulated?1:2,dist:(cx-(b[0]+b[2])/2)**2+(cy-(b[1]+b[3])/2)**2});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.dist-b.dist||String(a.feature.id).localeCompare(String(b.feature.id)));
 return {features:candidates.slice(0,limit).map(v=>v.feature),totalVisible:candidates.length,culledByBudget:Math.max(0,candidates.length-limit)};
}
