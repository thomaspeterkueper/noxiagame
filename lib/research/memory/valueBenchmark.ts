/** Synthetic, deterministic benchmark. No database, LLM, or production NPC mutations. */
export type Regime="FULL"|"COMPRESSED"|"SELECTIVE";
export type MemoryEvent={id:string;topic:string;value:number;critical?:boolean;anchor?:boolean};
export type Query={topic:string;expected:number};
export type BenchmarkResult={regime:Regime;bytes:number;mae:number;criticalRecall:number;anchorRecall:number;predictions:number[]};
const events:MemoryEvent[]=[
{id:"a",topic:"route",value:1},{id:"b",topic:"route",value:2},{id:"c",topic:"route",value:3},
{id:"d",topic:"weather",value:2},{id:"e",topic:"weather",value:4},
{id:"f",topic:"trust",value:1,anchor:true},{id:"g",topic:"emergency",value:1,critical:true},
{id:"h",topic:"route",value:3},{id:"i",topic:"weather",value:6}
];
const queries:Query[]=[{topic:"route",expected:3},{topic:"weather",expected:6},{topic:"trust",expected:1},{topic:"emergency",expected:1}];
function encode(e:MemoryEvent[]):string{return JSON.stringify(e);}
export function runMemoryValueBenchmark(regime:Regime):BenchmarkResult{
 let kept:MemoryEvent[];
 if(regime==="FULL")kept=events;
 else if(regime==="COMPRESSED"){
  // One most-recent summary per topic; retains provenance ID.
  const m=new Map<string,MemoryEvent>();for(const e of events)m.set(e.topic,e);
  kept=[...m.values()];
 }else{
  // Fixed selection rule, never derived from evaluation queries.
  kept=events.filter(e=>e.critical||e.anchor||e.value>=4);
 }
 const predictions=queries.map(q=>{const relevant=kept.filter(e=>e.topic===q.topic);return relevant.length?relevant[relevant.length-1].value:0;});
 const mae=predictions.reduce((s,p,i)=>s+Math.abs(p-queries[i].expected),0)/queries.length;
 return {regime,bytes:new TextEncoder().encode(encode(kept)).length,mae,
  criticalRecall:Number(kept.some(e=>e.id==="g")),anchorRecall:Number(kept.some(e=>e.id==="f")),predictions};
}
export function compareMemoryRegimes():BenchmarkResult[]{return (["FULL","COMPRESSED","SELECTIVE"] as const).map(runMemoryValueBenchmark);}
