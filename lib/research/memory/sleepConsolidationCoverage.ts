/** Pure regression model of the existing global 512-row descending-tick limit. */
export type TraceHead={id:string;person_id:string;observed_tick:number};
export function simulateGlobalLimit(rows:readonly TraceHead[],limit=512):TraceHead[]{
 if(!Number.isSafeInteger(limit)||limit<1)throw new Error("Invalid limit");
 return [...rows].sort((a,b)=>b.observed_tick-a.observed_tick||a.id.localeCompare(b.id)).slice(0,limit);
}
export function coverageByPerson(all:readonly TraceHead[],selected:readonly TraceHead[],people:readonly string[]){
 return people.map(personId=>({personId,available:all.filter(x=>x.person_id===personId).length,selected:selected.filter(x=>x.person_id===personId).length}));
}
export function syntheticStarvationFixture():TraceHead[]{
 const a=Array.from({length:550},(_,i)=>({id:"a"+i,person_id:"A",observed_tick:2000-i}));
 const b=Array.from({length:50},(_,i)=>({id:"b"+i,person_id:"B",observed_tick:1000-i}));
 return [...a,...b];
}
