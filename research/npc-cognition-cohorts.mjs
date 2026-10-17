/**
 * Offline-only cognition experiment. No DB, API calls, global actor writes or LLMs.
 * Uses the same provenance principles as npcRelationalMemory + npcTestimony.
 * Synthetic concepts are opaque identifiers, not claims about real-world cognition.
 */
export function makeActor(id, observations=[]) {
  if(!id) throw Error('actor id required');
  return {id, memories: observations.map((x,i)=>({
    id:`${id}:m:${i}`, tokens:[...x.tokens], source:{kind:'perception',ref:x.ref},
    lineage:[x.ref], confidence:1,
  })), dreams:[]};
}
export function dreamRecombine(actor,{maxPairs=12}={}) {
  const memories=actor.memories.filter(x=>x.tokens.length>0);
  const dreams=[]; const existing=new Set(memories.map(x=>x.tokens.slice().sort().join('|')));
  for(let a=0;a<memories.length;a++) for(let b=a+1;b<memories.length;b++){
    if(dreams.length>=maxPairs) break;
    const left=memories[a],right=memories[b];
    const tokens=[...new Set([...left.tokens,...right.tokens])].sort();
    if(tokens.length<2 || existing.has(tokens.join('|'))) continue;
    dreams.push({id:`${actor.id}:dream:${a}:${b}`,tokens,
      source:{kind:'inference',ref:null},lineage:[...new Set([...left.lineage,...right.lineage])],
      confidence:Math.min(left.confidence,right.confidence)*.5});
    existing.add(tokens.join('|'));
  }
  return {...actor,dreams};
}
export function transmitMemory(sender,receiver,memoryId,{conversationId,tick}={}) {
  if(!conversationId || !Number.isSafeInteger(tick)||tick<0) throw Error('validated encounter and tick required');
  if(sender.id===receiver.id) throw Error('distinct actors required');
  const memory=[...sender.memories,...sender.dreams].find(x=>x.id===memoryId);
  if(!memory) throw Error('unknown sender memory');
  const id=`${receiver.id}:received:${conversationId}:${memoryId}`;
  if(receiver.memories.some(x=>x.id===id)) return receiver; // idempotent replay
  const received={id,tokens:[...memory.tokens],source:{kind:'testimony',ref:conversationId},
    lineage:[...new Set([...memory.lineage,`conversation:${conversationId}`])],
    confidence:memory.confidence*.8,accepted:null};
  return {...receiver,memories:[...receiver.memories,received]};
}
export function injectSyntheticSignal(actor, tokens,{experimentId}={}) {
  if(!experimentId) throw Error('experiment provenance required');
  const id=`${actor.id}:signal:${experimentId}`;
  if(actor.memories.some(x=>x.id===id)) return actor;
  return {...actor,memories:[...actor.memories,{id,tokens:[...tokens],
    source:{kind:'simulated_external',ref:experimentId},lineage:[`synthetic:${experimentId}`],
    confidence:.5}]};
}
export function inspectKnownTokens(actor) {
  return [...new Set([...actor.memories,...actor.dreams].flatMap(m=>m.tokens))].sort();
}
