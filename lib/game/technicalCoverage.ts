// lib/game/technicalCoverage.ts
// NOXIA-owned technical object coverage catalog.

import { BUILDINGS } from './buildings'
import { EXPLORATION_ASSET_TYPES } from './explorationAssets'
import { SHIP_FRAMES, SHIP_MODULES } from './ships'
import { STATION_MODULE_DEFS } from './stationModules'
import { TECHNICAL_COVERAGE_HANDOFFS, type TechnicalCoverageHandoff } from './technicalCoverageRequests'

export type TechnicalCoverageKind = 'building' | 'ship_frame' | 'ship_module' | 'exploration_asset' | 'station_module'
export type TechnicalCoverageStatus = 'mapped' | 'unmapped'
export type TechnicalCoverageProvenance = { sourceSystem:'OTA'; sourceDocumentId:string; canonicalId:string; objectId:string; mappingRole:'buildable'|'reference'; evidenceImpactPolicy:'signal-only' }
export type TechnicalCoverageEntry = { key:string; localId:string; name:string; kind:TechnicalCoverageKind; status:TechnicalCoverageStatus; planned:boolean; sourceFile:string; provenance:TechnicalCoverageProvenance|null; handoff:TechnicalCoverageHandoff|null }

function entryKey(kind:TechnicalCoverageKind,localId:string){return `${kind}:${localId}`}
function handoffFor(kind:TechnicalCoverageKind,localId:string){return TECHNICAL_COVERAGE_HANDOFFS[entryKey(kind,localId)]??null}

export function getTechnicalCoverageEntries():TechnicalCoverageEntry[]{
  const buildings=Object.values(BUILDINGS).map(b=>({key:entryKey('building',b.id),localId:b.id,name:b.name,kind:'building' as const,status:(b.externalTechnicalObject?'mapped':'unmapped') as TechnicalCoverageStatus,planned:Boolean(b.planned),sourceFile:'lib/game/buildings/index.ts',provenance:b.externalTechnicalObject??null,handoff:handoffFor('building',b.id)}))
  const shipFrames=Object.values(SHIP_FRAMES).map(f=>({key:entryKey('ship_frame',f.id),localId:f.id,name:f.name,kind:'ship_frame' as const,status:'unmapped' as const,planned:false,sourceFile:'lib/game/ships.ts',provenance:null,handoff:handoffFor('ship_frame',f.id)}))
  const shipModules=Object.values(SHIP_MODULES).map(m=>({key:entryKey('ship_module',m.id),localId:m.id,name:m.name,kind:'ship_module' as const,status:'unmapped' as const,planned:false,sourceFile:'lib/game/ships.ts',provenance:null,handoff:handoffFor('ship_module',m.id)}))
  const explorationAssets=Object.values(EXPLORATION_ASSET_TYPES).map(a=>({key:entryKey('exploration_asset',a.id),localId:a.id,name:a.name,kind:'exploration_asset' as const,status:'mapped' as const,planned:false,sourceFile:'lib/game/explorationAssets.ts',provenance:a.provenance,handoff:handoffFor('exploration_asset',a.id)}))
  const stationModules=Object.values(STATION_MODULE_DEFS).map(m=>({key:entryKey('station_module',m.id),localId:m.id,name:m.label,kind:'station_module' as const,status:'unmapped' as const,planned:Boolean(m.planned),sourceFile:'lib/game/stationModules.ts',provenance:null,handoff:handoffFor('station_module',m.id)}))
  return [...buildings,...shipFrames,...shipModules,...explorationAssets,...stationModules].sort((a,b)=>a.key.localeCompare(b.key))
}

type Bucket={total:number;mapped:number;unmapped:number;handedOff:number;actionableGaps:number}
export type TechnicalCoverageSummary={total:number;mapped:number;unmapped:number;handedOff:number;actionableGaps:number;activeTotal:number;activeMapped:number;activeUnmapped:number;activeActionableGaps:number;byKind:Record<TechnicalCoverageKind,Bucket>}
const empty=():Bucket=>({total:0,mapped:0,unmapped:0,handedOff:0,actionableGaps:0})
export function getTechnicalCoverageSummary(entries=getTechnicalCoverageEntries()):TechnicalCoverageSummary{
 const byKind:Record<TechnicalCoverageKind,Bucket>={building:empty(),ship_frame:empty(),ship_module:empty(),exploration_asset:empty(),station_module:empty()};let mapped=0,handedOff=0,actionableGaps=0,activeTotal=0,activeMapped=0,activeActionableGaps=0
 for(const e of entries){const b=byKind[e.kind];b.total++;if(e.status==='mapped'){mapped++;b.mapped++}else{b.unmapped++;if(e.handoff){handedOff++;b.handedOff++}else{actionableGaps++;b.actionableGaps++}}if(!e.planned){activeTotal++;if(e.status==='mapped')activeMapped++;if(e.status==='unmapped'&&!e.handoff)activeActionableGaps++}}
 return{total:entries.length,mapped,unmapped:entries.length-mapped,handedOff,actionableGaps,activeTotal,activeMapped,activeUnmapped:activeTotal-activeMapped,activeActionableGaps,byKind}
}
export function getTechnicalCoverageReport(){const entries=getTechnicalCoverageEntries();return{schemaVersion:'1.2',generatedFrom:['lib/game/buildings/index.ts','lib/game/ships.ts','lib/game/explorationAssets.ts','lib/game/stationModules.ts','lib/game/technicalCoverageRequests.ts'],semantics:{mapped:'NOXIA has an explicit read-only external technical provenance binding.',unmapped:'NOXIA has no explicit provenance binding yet; this does not prove that the external dossier is missing.',handoff:'NOXIA recorded an outbound request for the gap. Target-repository live status remains target-owned.',actionableGap:'An unmapped NOXIA object for which no outbound handoff is recorded yet.'},summary:getTechnicalCoverageSummary(entries),entries}}
