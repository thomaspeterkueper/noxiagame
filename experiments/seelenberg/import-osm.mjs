// OSM Overpass JSON -> versioned pilot layer. Offline transformation; no network or DB writes.
// Usage: node experiments/seelenberg/import-osm.mjs snapshot.overpass.json > seelenberg.geojson
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const AREA = Object.freeze({south:50.25418,west:8.40432,north:50.26766,east:8.42540});
// Approximate ~1.5 km testing envelope; not administrative boundaries.
export function overpassQuery(b=AREA){
  const box=[b.south,b.west,b.north,b.east].join(',');
  return '[out:json][timeout:60];(way["highway"]('+box+');way["building"]('+box+');way["landuse"]('+box+');way["natural"]('+box+'););out body;>;out skel qt;';
}
const isCoord=v=>Number.isFinite(v?.lat)&&Number.isFinite(v?.lon)&&Math.abs(v.lat)<=90&&Math.abs(v.lon)<=180;
export function transform(data){
  if(!Array.isArray(data?.elements))throw new Error('Invalid Overpass JSON: missing elements');
  const nodes=new Map(data.elements.filter(x=>x.type==='node'&&isCoord(x)).map(n=>[n.id,[n.lon,n.lat]]));
  const features=[],missing=[];
  for(const way of data.elements.filter(x=>x.type==='way'&&(x.tags?.highway||x.tags?.building||x.tags?.landuse||x.tags?.natural))){
    const coords=(way.nodes||[]).map(id=>nodes.get(id));
    if(coords.length<2||coords.some(x=>!x)){missing.push(way.id);continue;}
    const close=coords.length>=4&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1];
    const polygon=close&&!!(way.tags.building||way.tags.landuse||way.tags.natural);
    features.push({type:'Feature',id:'osm:way:'+way.id,properties:{osm_type:'way',osm_id:way.id,tags:way.tags,source:'OpenStreetMap',observed_not_simulated:true},geometry:polygon?{type:'Polygon',coordinates:[coords]}:{type:'LineString',coordinates:coords}});
  }
  return {type:'FeatureCollection',metadata:{source:'OpenStreetMap contributors',license:'ODbL 1.0',source_url:'https://www.openstreetmap.org/copyright',region:'seelenberg-pilot',bbox:[AREA.west,AREA.south,AREA.east,AREA.north],snapshot_timestamp:data.osm3s?.timestamp_osm_base||null,warning:'OSM features are observations, not simulated game buildings or accessible public roads',skipped_missing_nodes:missing},features};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=process.argv[2];if(!input)throw new Error('Pass downloaded Overpass JSON snapshot path');
 process.stdout.write(JSON.stringify(transform(JSON.parse(readFileSync(input,'utf8'))),null,2)+'\n');
}
