import type { PersistedEpistemicTrace } from "../../game/cognition/personEpistemicPersistence";

/** Pure research helper: no database calls, no LLM, no NPC mutation. */
export type RetrievalQuery={personId:string;subjectRef:string;attribute:string;atTick:number;limit:number};
export type RetrievalMetrics={scanned:number;matched:number;returned:number;serializedBytes:number};
export function retrieveEpistemicTraces(rows:readonly PersistedEpistemicTrace[],q:RetrievalQuery):{rows:PersistedEpistemicTrace[];metrics:RetrievalMetrics}{
 if(!Number.isSafeInteger(q.atTick)||q.atTick<0||!Number.isSafeInteger(q.limit)||q.limit<1)throw new Error("Invalid retrieval bounds");
 const matching=rows.filter(r=>r.person_id===q.personId&&r.subject_ref===q.subjectRef&&r.attribute===q.attribute&&r.observed_tick<=q.atTick);
 // Explicit temporal order; stable tie-breaker; recent evidence is not automatically true.
 const selected=[...matching].sort((a,b)=>b.observed_tick-a.observed_tick||a.id.localeCompare(b.id)).slice(0,q.limit);
 return {rows:selected,metrics:{scanned:rows.length,matched:matching.length,returned:selected.length,serializedBytes:new TextEncoder().encode(JSON.stringify(selected)).length}};
}
