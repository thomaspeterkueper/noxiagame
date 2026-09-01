export type VehicleWorld = 'earth' | 'mars' | 'moon' | 'phobos' | 'generic'

export type VehicleCategory =
  | 'civil'
  | 'service'
  | 'logistics'
  | 'spacecraft'

export interface VehicleVisualAsset {
  id: string
  world: VehicleWorld
  category: VehicleCategory
  src: string
  anchor: [number, number]
  canonical: boolean
  version: number
}

const vehicle = (
  id: string,
  category: VehicleCategory,
  world: VehicleWorld = 'earth',
): VehicleVisualAsset => ({
  id,
  world,
  category,
  src: `/assets/vehicles/${id}/${world}/isometric.webp`,
  anchor: [0.5, 0.84],
  canonical: true,
  version: 1,
})

export const VEHICLE_VISUAL_ASSETS: VehicleVisualAsset[] = [
  vehicle('car_small', 'civil'),
  vehicle('shuttle_bus', 'civil'),
  vehicle('service_van', 'service'),
  vehicle('forklift', 'logistics'),
  vehicle('baggage_cart', 'logistics'),
  vehicle('cargo_tug_train', 'logistics'),
  vehicle('ship_shuttle', 'spacecraft'),
  vehicle('ship_cargo', 'spacecraft'),
  vehicle('ship_passenger', 'spacecraft'),
  vehicle('ship_heavy', 'spacecraft'),
]

export function getVehicleVisualAsset(
  id: string,
  world: string,
): VehicleVisualAsset | null {
  const normalizedWorld = world.toLowerCase() as VehicleWorld

  return VEHICLE_VISUAL_ASSETS.find(
    asset => asset.id === id && asset.world === normalizedWorld,
  ) ?? VEHICLE_VISUAL_ASSETS.find(
    asset => asset.id === id && asset.world === 'generic',
  ) ?? null
}
