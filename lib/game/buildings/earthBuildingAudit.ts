import { BUILDING_VISUALS } from './visuals'

export type EarthSettlementRole = {
  id: string
  label: string
  priority: 'core' | 'growth' | 'specialist'
  buildingIds: readonly string[]
}

export const EARTH_SETTLEMENT_ROLES: readonly EarthSettlementRole[] = [
  { id: 'housing', label: 'Wohnen / Habitat', priority: 'core', buildingIds: ['habitat', 'residential_block'] },
  { id: 'medical', label: 'Klinik / medizinische Versorgung', priority: 'core', buildingIds: ['clinic', 'medical_center'] },
  { id: 'water', label: 'Wasseraufbereitung', priority: 'core', buildingIds: ['water_treatment'] },
  { id: 'waste', label: 'Abfall- und Stoffkreislauf', priority: 'core', buildingIds: ['waste_recycling'] },
  { id: 'power', label: 'Energieerzeugung', priority: 'core', buildingIds: ['solar'] },
  { id: 'distribution', label: 'Energieverteilung / Speicher', priority: 'core', buildingIds: ['grid_hub', 'battery_storage'] },
  { id: 'maintenance', label: 'Werkstatt / Instandhaltung', priority: 'core', buildingIds: ['workshop'] },
  { id: 'logistics', label: 'Logistik / Lager', priority: 'core', buildingIds: ['warehouse'] },
  { id: 'food', label: 'Nahrung / Gewächshaus', priority: 'growth', buildingIds: ['greenhouse', 'food_hub'] },
  { id: 'education', label: 'Schule / Ausbildung', priority: 'growth', buildingIds: ['school'] },
  { id: 'research', label: 'Forschung / Labor', priority: 'growth', buildingIds: ['laboratory'] },
  { id: 'administration', label: 'Verwaltung / Koordination', priority: 'growth', buildingIds: ['admin'] },
  { id: 'transit', label: 'Schnellbahn / Tunnelportal', priority: 'specialist', buildingIds: ['rapid_transit_station', 'tunnel_portal'] },
  { id: 'spaceport', label: 'Raumhafenbetrieb', priority: 'specialist', buildingIds: ['spaceport_core', 'spaceport_service', 'spaceport_storage', 'spaceport_pad_standard', 'spaceport_pad_mini'] },
  { id: 'sensing', label: 'Sensorik / Kommunikation', priority: 'specialist', buildingIds: ['scanner'] },
]

export type EarthBuildingAudit = {
  covered: EarthSettlementRole[]
  missing: EarthSettlementRole[]
  reusedAssets: Array<{ asset: string; buildingIds: string[] }>
}

/** Pure inventory: reads the visual catalogue but never unlocks or places a building. */
export function auditEarthBuildingVisuals(): EarthBuildingAudit {
  const earthAssets = new Map<string, string[]>()
  for (const [buildingId, profiles] of Object.entries(BUILDING_VISUALS)) {
    const asset = profiles.earth?.mapAsset
    if (!asset) continue
    earthAssets.set(asset, [...(earthAssets.get(asset) ?? []), buildingId])
  }
  const covered = EARTH_SETTLEMENT_ROLES.filter(role =>
    role.buildingIds.some(buildingId => Boolean(BUILDING_VISUALS[buildingId]?.earth?.mapAsset)),
  )
  const missing = EARTH_SETTLEMENT_ROLES.filter(role => !covered.includes(role))
  const reusedAssets = [...earthAssets.entries()]
    .filter(([, buildingIds]) => buildingIds.length > 1)
    .map(([asset, buildingIds]) => ({ asset, buildingIds }))
  return { covered, missing, reusedAssets }
}
