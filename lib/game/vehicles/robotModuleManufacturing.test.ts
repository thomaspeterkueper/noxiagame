import assert from 'node:assert/strict'
import { PRECISION_INSTRUMENTATION_UNLOCK, ROBOT_FABRICATION_UNLOCK } from '@/lib/knowledge/unlocks'
import { ROBOT_MODULE_RECIPES, SPECTRAL_SENSOR_UNLOCK, missingRecipeUnlocks } from './robotModuleManufacturing'

const auger = ROBOT_MODULE_RECIPES['reaction-canceling-auger']
const spectrometer = ROBOT_MODULE_RECIPES['spectrometer-pack']
assert.ok(auger)
assert.ok(spectrometer)
assert.deepEqual(missingRecipeUnlocks(auger, []), [ROBOT_FABRICATION_UNLOCK])
assert.deepEqual(missingRecipeUnlocks(auger, [ROBOT_FABRICATION_UNLOCK]), [])
assert.deepEqual(missingRecipeUnlocks(spectrometer, [PRECISION_INSTRUMENTATION_UNLOCK]), [SPECTRAL_SENSOR_UNLOCK])
assert.deepEqual(missingRecipeUnlocks(spectrometer, [PRECISION_INSTRUMENTATION_UNLOCK, SPECTRAL_SENSOR_UNLOCK]), [])
assert.equal(Object.keys(ROBOT_MODULE_RECIPES).length, 9)
assert.ok(Object.values(ROBOT_MODULE_RECIPES).every(recipe => recipe.durationSeconds > 0 && recipe.energyCost > 0 && recipe.componentCost > 0))
console.log('Robot module manufacturing gates: tests passed')
