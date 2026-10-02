export type CreativeTraceKind='note'|'motif'|'scene_seed'|'essay_seed'|'chronicle_seed'
export interface CreativeTraceCandidate{
  personId:string;sourceMemoryId:string;sourceEventId:string|null;traceKind:CreativeTraceKind;
  subjectType:string|null;subjectRef:string|null;salience:number;interpretation:string;createdTick:number
}
export interface CreativeMemoryInput{
 id:string;personId:string;sourceEventId:string;kind:string;tick:number;salience:number;valence:number;summary:string
}

/**
 * Deterministic candidate selection. This is subjective processing, never world truth.
 * Generic enough for any author/chronicler; callers decide whether a person has that role.
 */
export function creativeTraceFromMemory(memory:CreativeMemoryInput):CreativeTraceCandidate|null{
 if(memory.salience<0.6)return null
 const traceKind:CreativeTraceKind=memory.kind==='crisis'?'chronicle_seed':memory.kind==='interaction'?'scene_seed':'note'
 return {
  personId:memory.personId,sourceMemoryId:memory.id,sourceEventId:memory.sourceEventId??null,
  traceKind,subjectType:'memory',subjectRef:memory.id,salience:memory.salience,
  interpretation:memory.summary,createdTick:memory.tick,
 }
}
