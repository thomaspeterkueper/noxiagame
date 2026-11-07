// Pure Earth building presentation planner for experimental regions.
// Observed OSM geometries never imply fictional functions or occupants.
export const LOD_LIMITS=Object.freeze({overview:0.75,footprints:1.8,portfolio:3.2});
export function earthBuildingLevel(zoom,selected=false){
 if(selected)return 'interactive';
 if(!Number.isFinite(zoom))return 'overview';
 if(zoom<LOD_LIMITS.overview)return 'overview';
 if(zoom<LOD_LIMITS.footprints)return 'footprints';
 if(zoom<LOD_LIMITS.portfolio)return 'portfolio';
 return 'detailed';
}
export function buildingPresentation(feature,{zoom=1,selected=false,simulationBuilding=null}={}){
 if(feature?.geometry?.type!=='Polygon'||!feature?.properties?.tags?.building)return null;
 const level=earthBuildingLevel(zoom,selected);
 const identity=feature.id;
 const isSimulation=Boolean(simulationBuilding?.buildingId);
 return {
  id:identity,
  source:'osm-observation',
  sourceFeatureId:identity,
  level,
  geometry:feature.geometry,
  appearance:isSimulation ? 'simulation-portfolio' : (level==='overview'?'omit':level==='footprints'?'footprint':'neutral-building'),
  // Visual can be selected from BUILDING_VISUALS only for game-simulation buildings,
  // and only after checking an actual earth mapAsset exists.
  portfolioBuildingId:isSimulation?simulationBuilding.buildingId:null,
  interactionId:isSimulation?simulationBuilding.id:null,
  inferenceOfActualUse:false
 };
}
export function selectVisibleBuildings(features,viewport,{zoom=1,limit=1200,selectedIds=[],simulatedBuildings={}}={}){
 if(!Array.isArray(features)||!viewport||!Number.isInteger(limit)||limit<1)throw new Error('Invalid building presentation request');
 const [west,south,east,north]=viewport;
 const out=[];
 for(const f of features){
  if(out.length>=limit)break;
  if(f.geometry?.type!=='Polygon')continue;
  const vertices=f.geometry.coordinates?.[0];
  if(!Array.isArray(vertices)||!vertices.some(p=>Array.isArray(p)&&p.length>=2&&p[0]>=west&&p[0]<=east&&p[1]>=south&&p[1]<=north))continue;
  const view=buildingPresentation(f,{zoom,selected:selectedIds.includes(f.id),simulationBuilding:simulatedBuildings[f.id]});
  if(view&&view.appearance!=='omit')out.push(view);
 }
 return out;
}
