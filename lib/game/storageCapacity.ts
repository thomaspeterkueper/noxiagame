// lib/game/storageCapacity.ts
// Erstellt:     09.10.2026 — Lagergrenzen: Kapazität aus Lagergebäuden, Produktion ruht bei vollem Lager
// Version:      1.0.0
//
// Bisher konnten Bestände unbegrenzt wachsen (Mars: 48.000 t Energie bei 3 t
// Verbrauch je Tick). Jetzt hat jeder Ort je Gut eine Lagerkapazität, die sich
// aus einem kleinen Grundlager und den aktiven Lagergebäuden ergibt – je nach
// Gebäudetyp und Ausbaustufe (building_definitions.tier).
//
// Regeln:
//  - Ist das Lager voll, wird nur so viel produziert, wie hineinpasst.
//  - Es verschwindet nichts: Bestände über der Kapazität bleiben liegen und
//    bauen sich über den Verbrauch ab.
//  - Reine Ableitung aus vorhandenen Gebäuden; kein eigener Zustand.
//
// Die Tonnagen sind vorläufige Modellparameter.

export type StorageResource = 'water' | 'energy' | 'metal' | 'components'
export type StorageCapacity = Record<StorageResource, number>

export const STORAGE_RESOURCES: StorageResource[] = ['water', 'energy', 'metal', 'components']

/** Grundlager jedes Orts ohne eigenes Lagergebäude (Tanks, Puffer und Halden der Anlagen selbst). */
export const BASE_STORAGE_T = 300

/** Kapazität je Lagergebäude in Ausbaustufe 1, in Tonnen je Gut. */
export const STORAGE_BUILDINGS: Record<string, Partial<StorageCapacity>> = {
  warehouse:         { water: 1000, metal: 1500, components: 500 },
  warehouse_storage: { water: 1000, metal: 3000, components: 1000 },
  spaceport_storage: { water: 1000, metal: 1000, components: 1000, energy: 500 },
  tank:              { water: 2000 },
  battery_storage:   { energy: 1500 },
}

export const STORAGE_BUILDING_KEYS = Object.keys(STORAGE_BUILDINGS)

/** Jede Ausbaustufe verdoppelt die Kapazität der Stufe davor. */
export function tierFactor(tier: number): number {
  const t = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1
  return 2 ** (t - 1)
}

export function emptyCapacity(value = 0): StorageCapacity {
  return { water: value, energy: value, metal: value, components: value }
}

/** Lagerkapazität eines Orts aus seinen aktiven Lagergebäuden. */
export function locationStorageCapacity(
  buildings: { entity_id: string; status?: string | null }[],
  tierOf: (entityId: string) => number = () => 1,
): StorageCapacity {
  const capacity = emptyCapacity(BASE_STORAGE_T)
  for (const b of buildings) {
    const def = STORAGE_BUILDINGS[b.entity_id]
    if (!def) continue
    if (b.status != null && b.status !== 'active') continue
    const factor = tierFactor(tierOf(b.entity_id))
    for (const res of STORAGE_RESOURCES) capacity[res] += (def[res] ?? 0) * factor
  }
  return capacity
}

/**
 * Wie viel der möglichen Produktion in diesem Tick ins Lager passt.
 * Der Verbrauch desselben Ticks schafft Platz; über der Kapazität wird nichts angenommen.
 */
export function acceptedInflow(input: { stock: number; inflow: number; consumption: number; capacity: number }): number {
  const inflow = Math.max(0, input.inflow)
  const room = Math.max(0, input.capacity - (input.stock - Math.max(0, input.consumption)))
  return Math.min(inflow, room)
}

/** Lädt die Kapazität aller Orte mit einer Abfrage (plus einer für die Ausbaustufen, falls nicht mitgegeben). */
export async function loadStorageCapacities(
  supabase: any,
  tierOf?: (entityId: string) => number,
): Promise<Map<string, StorageCapacity>> {
  let resolveTier = tierOf
  if (!resolveTier) {
    const { data: defs } = await supabase.from('building_definitions').select('key, tier').in('key', STORAGE_BUILDING_KEYS)
    const tiers = new Map<string, number>((defs ?? []).map((d: any) => [d.key, Number(d.tier ?? 1)]))
    resolveTier = (entityId: string) => tiers.get(entityId) ?? 1
  }
  const { data: rows, error } = await supabase
    .from('tile_entities')
    .select('location_id, entity_id, status')
    .eq('entity_type', 'building')
    .in('entity_id', STORAGE_BUILDING_KEYS)
  if (error) throw new Error(`storage capacity lookup failed: ${error.message}`)

  const byLocation = new Map<string, { entity_id: string; status?: string | null }[]>()
  for (const row of (rows ?? []) as any[]) {
    const list = byLocation.get(row.location_id) ?? []
    list.push(row)
    byLocation.set(row.location_id, list)
  }
  const result = new Map<string, StorageCapacity>()
  for (const [locationId, list] of byLocation) result.set(locationId, locationStorageCapacity(list, resolveTier))
  return result
}

/** Kapazität eines Orts aus der geladenen Karte; ohne Lagergebäude gilt das Grundlager. */
export function capacityFor(capacities: Map<string, StorageCapacity> | undefined, locationId: string): StorageCapacity {
  return capacities?.get(locationId) ?? emptyCapacity(BASE_STORAGE_T)
}
