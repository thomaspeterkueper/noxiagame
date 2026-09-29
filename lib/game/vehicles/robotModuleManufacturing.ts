import { PRECISION_INSTRUMENTATION_UNLOCK, ROBOT_FABRICATION_UNLOCK } from '@/lib/knowledge/unlocks'
import { ROBOT_MODULE_DEFINITIONS } from './robotRetrofit'

export const SPECTRAL_SENSOR_UNLOCK = 'UNL:NOX:SENSOR:SPECTRAL'

export type RobotModuleRecipe = {
  equipmentKey: string
  label: string
  requiredUnlocks: string[]
  metalCost: number
  componentCost: number
  energyCost: number
  durationSeconds: number
  recipeVersion: string
}

function recipe(
  equipmentKey: string,
  requiredUnlocks: string[],
  metalCost: number,
  componentCost: number,
  energyCost: number,
  durationSeconds: number,
): RobotModuleRecipe {
  const definition = ROBOT_MODULE_DEFINITIONS[equipmentKey]
  if (!definition) throw new Error(`Unknown robot module: ${equipmentKey}`)
  return { equipmentKey, label: definition.label, requiredUnlocks, metalCost, componentCost, energyCost, durationSeconds, recipeVersion: 'stickney-module-fabrication-v1' }
}

export const ROBOT_MODULE_RECIPES: Record<string, RobotModuleRecipe> = {
  'spectrometer-pack': recipe('spectrometer-pack', [PRECISION_INSTRUMENTATION_UNLOCK, SPECTRAL_SENSOR_UNLOCK], 4, 8, 24, 900),
  'ground-imaging-radar': recipe('ground-imaging-radar', [PRECISION_INSTRUMENTATION_UNLOCK], 6, 7, 22, 900),
  'regolith-bucket': recipe('regolith-bucket', [ROBOT_FABRICATION_UNLOCK], 12, 5, 18, 720),
  'reaction-canceling-auger': recipe('reaction-canceling-auger', [ROBOT_FABRICATION_UNLOCK], 14, 8, 28, 1200),
  'sealed-sample-hopper': recipe('sealed-sample-hopper', [ROBOT_FABRICATION_UNLOCK], 10, 5, 16, 720),
  'mass-balance-cell': recipe('mass-balance-cell', [PRECISION_INSTRUMENTATION_UNLOCK], 3, 6, 18, 900),
  'tool-changer': recipe('tool-changer', [ROBOT_FABRICATION_UNLOCK], 8, 7, 20, 900),
  'inspection-camera': recipe('inspection-camera', [PRECISION_INSTRUMENTATION_UNLOCK], 2, 5, 12, 600),
  'spares-rack': recipe('spares-rack', [ROBOT_FABRICATION_UNLOCK], 8, 4, 12, 480),
}

export const ROBOT_MODULE_RECIPE_KEYS = Object.keys(ROBOT_MODULE_RECIPES)
export function robotModuleRecipe(key: string) { return ROBOT_MODULE_RECIPES[key] ?? null }
export function missingRecipeUnlocks(recipe: RobotModuleRecipe, unlocks: readonly string[]) {
  const owned = new Set(unlocks)
  return recipe.requiredUnlocks.filter(unlock => !owned.has(unlock))
}
