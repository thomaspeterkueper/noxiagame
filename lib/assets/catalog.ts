export type AssetWorld = 'mars' | 'moon' | 'earth' | 'phobos' | 'prometheus' | 'generic'
export type BuildingView =
  | 'exterior-isometric'
  | 'exterior-detail'
  | 'construction-foundation'
  | 'construction-frame'
  | 'construction-systems'
  | 'construction-commissioning'
  | 'interior-entry'
  | 'interior-main'

export type AnimationKind = 'idle' | 'walk' | 'work' | 'machine'

export interface BuildingVisualAsset {
  entityId: string
  world: AssetWorld
  view: BuildingView
  src: string
  anchor: [number, number]
  footprint: [number, number]
  canonical: boolean
  version: number
}

export interface SpriteAnimationAsset {
  id: string
  kind: AnimationKind
  src: string
  frameWidth: number
  frameHeight: number
  frames: number
  fps: number
  direction?: 'horizontal' | 'vertical'
}

const building = (
  entityId: string,
  world: AssetWorld,
  view: BuildingView,
  footprint: [number, number] = [1, 1],
): BuildingVisualAsset => ({
  entityId,
  world,
  view,
  src: `/assets/buildings/${entityId}/${world}/${view}.webp`,
  anchor: [0.5, 0.82],
  footprint,
  canonical: true,
  version: 1,
})

export const BUILDING_VISUAL_ASSETS: BuildingVisualAsset[] = [
  // Earth / shared public start facilities.
  // The facility modules are independent 1x1 assets so the visible footprint
  // can grow tile-by-tile without replacing a monolithic building image.
  building('spaceport_core', 'earth', 'exterior-isometric'),
  building('spaceport_pad_mini', 'earth', 'exterior-isometric'),
  building('spaceport_pad_standard', 'earth', 'exterior-isometric'),
  building('spaceport_pad_cargo', 'earth', 'exterior-isometric'),
  building('spaceport_pad_passenger', 'earth', 'exterior-isometric'),
  building('spaceport_pad_heavy', 'earth', 'exterior-isometric'),
  building('spaceport_service', 'earth', 'exterior-isometric'),
  building('spaceport_storage', 'earth', 'exterior-isometric'),
  building('admin', 'earth', 'exterior-isometric'),
  building('school', 'earth', 'exterior-isometric'),
  building('warehouse', 'earth', 'exterior-isometric'),
  building('warehouse_storage', 'earth', 'exterior-isometric'),

  // Legacy alias retained while older Earth seeds / saved entities migrate.
  building('landing_pad', 'earth', 'exterior-isometric'),

  building('habitat', 'mars', 'exterior-isometric', [2, 2]),
  building('habitat', 'mars', 'exterior-detail', [2, 2]),
  building('habitat', 'mars', 'interior-entry', [2, 2]),
  building('habitat', 'mars', 'interior-main', [2, 2]),

  building('solar', 'mars', 'exterior-isometric', [2, 2]),
  building('solar', 'mars', 'exterior-detail', [2, 2]),

  building('water_recycler', 'mars', 'exterior-isometric', [2, 2]),
  building('water_recycler', 'mars', 'exterior-detail', [2, 2]),
  building('water_recycler', 'mars', 'interior-main', [2, 2]),
]

export const SPRITE_ANIMATIONS: SpriteAnimationAsset[] = [
  {
    id: 'water_recycler-machine',
    kind: 'machine',
    src: '/assets/buildings/water_recycler/mars/machine-strip.webp',
    frameWidth: 256,
    frameHeight: 256,
    frames: 8,
    fps: 8,
    direction: 'horizontal',
  },
]

export function getBuildingVisualAsset(
  entityId: string,
  world: string,
  view: BuildingView = 'exterior-isometric',
): BuildingVisualAsset | null {
  const normalizedWorld = world.toLowerCase() as AssetWorld
  return BUILDING_VISUAL_ASSETS.find(
    asset => asset.entityId === entityId && asset.world === normalizedWorld && asset.view === view,
  ) ?? BUILDING_VISUAL_ASSETS.find(
    asset => asset.entityId === entityId && asset.world === 'generic' && asset.view === view,
  ) ?? null
}

export function getSpriteAnimation(id: string): SpriteAnimationAsset | null {
  return SPRITE_ANIMATIONS.find(asset => asset.id === id) ?? null
}
