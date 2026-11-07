// Download a bounded OSM snapshot and produce GeoJSON + provenance metadata.
// Run only in CI/manual execution, never from production app.
import {writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {overpassQuery, transform} from './import-osm.mjs';
const endpoint=process.env.OVERPASS_ENDPOINT||'https://overpass.kumi.systems/api/interpreter';
const destination=process.env.SNAPSHOT_DIR||'experiments/seelenberg/output';
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),90000);
try {
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'noxiagame-seelenberg-pilot/0.1 (GitHub CI validation)'},body:new URLSearchParams({data:overpassQuery()}),signal:controller.signal});
 if(!response.ok)throw new Error('OSM fetch HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>25_000_000)throw new Error('OSM snapshot exceeds 25MB');
 const parsed=JSON.parse(raw);
 const transformed=transform(parsed);
 if(transformed.features.length===0)throw new Error('No usable features in OSM response');
 const snapshotHash=createHash('sha256').update(raw).digest('hex');
 const report={endpoint,requested_at:new Date().toISOString(),snapshot_hash_sha256:snapshotHash,osm_timestamp:parsed.osm3s?.timestamp_osm_base||null,feature_count:transformed.features.length,road_count:transformed.features.filter(f=>!!f.properties.tags.highway).length,building_count:transformed.features.filter(f=>!!f.properties.tags.building).length,missing_node_ways:transformed.metadata.skipped_missing_nodes.length,attribution:'© OpenStreetMap contributors',license:'ODbL 1.0',bbox:transformed.metadata.bbox};
 if(report.road_count===0||report.building_count===0)throw new Error('Missing roads or buildings');
 if(report.missing_node_ways>0)throw new Error('Incomplete OSM way geometries: '+report.missing_node_ways);
 await mkdir(destination,{recursive:true});
 await writeFile(destination+'/seelenberg.overpass.json',raw);
 await writeFile(destination+'/seelenberg.geojson',JSON.stringify(transformed));
 await writeFile(destination+'/provenance.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {clearTimeout(timeout);}
