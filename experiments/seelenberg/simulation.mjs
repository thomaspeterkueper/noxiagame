// Prototype fixture only; no production runtime coupling.
// Invented site facilities and inventory values, not factual Seelenberg observations.
export function initialState() { return { tick:0, producer:24, vehicle:0, depot:12, delivered:0, consumed:0, produced:0, requests:0, events:[] }; }
export function advance(state, {blocked=false, demand=5, production=6, load=8}={}) {
  const s=structuredClone(state); s.tick++;
  s.producer+=production; s.produced+=production;
  if(!blocked) {if(s.vehicle) {s.depot+=s.vehicle; s.delivered+=s.vehicle; s.events.push('delivered:'+s.vehicle); s.vehicle=0;} if(s.producer>=load){s.producer-=load; s.vehicle=load; s.events.push('loaded:'+load);}}
  else s.events.push('route_blocked');
  const eaten=Math.min(s.depot,demand);s.depot-=eaten;s.consumed+=eaten;
  if(s.depot<8){s.requests++;s.events.push('resupply_requested');}
  return s;
}
export function conserved(s){return s.producer+s.vehicle+s.depot+s.consumed === 36+s.produced;}
