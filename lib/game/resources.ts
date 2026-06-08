// lib/game/resources.ts
// Ressourcen-Grundtypen, entkoppelt von der (noch nicht adoptierten) buildings.ts,
// damit ships.ts/condition.ts ohne sie kompilieren. buildings.ts kann später von
// hier re-exportieren. Heute handelbar (resource_type enum): water/energy/metal.
export type Resource =
  | 'water' | 'energy' | 'metal'
  | 'ice' | 'aluminium' | 'oxygen' | 'hydrogen' | 'food' | 'parts';

export const RESOURCES: Resource[] =
  ['water','energy','metal','ice','aluminium','oxygen','hydrogen','food','parts'];

export const MARKET_RESOURCES: Resource[] = ['water','energy','metal'];

export const RESOURCE_PHASE: Record<Resource,'fluid'|'solid'> = {
  water:'fluid', energy:'fluid', oxygen:'fluid', hydrogen:'fluid',
  metal:'solid', ice:'solid', aluminium:'solid', food:'solid', parts:'solid',
};
