// lib/game/resources.ts
// Ressourcen-Grundtypen.
// Aktualisiert: 27.06.2026 — components/Bauteile als erste Industrieware.

export type Resource =
  | 'water' | 'energy' | 'metal' | 'components'
  | 'ice' | 'aluminium' | 'oxygen' | 'hydrogen' | 'food' | 'parts';

export const RESOURCES: Resource[] =
  ['water','energy','metal','components','ice','aluminium','oxygen','hydrogen','food','parts'];

export const MARKET_RESOURCES: Resource[] = ['water','energy','metal','components'];

export const RESOURCE_PHASE: Record<Resource,'fluid'|'solid'> = {
  water:'fluid', energy:'fluid', oxygen:'fluid', hydrogen:'fluid',
  metal:'solid', components:'solid', ice:'solid', aluminium:'solid', food:'solid', parts:'solid',
};
