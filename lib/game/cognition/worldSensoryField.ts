import { BUILDINGS } from '../buildings'
import type { LocalSurfaceBuilding, LocalSurfaceMobileObject, LocalSurfaceScene } from '../spatial/localSurfaceScene'
import type { SensoryStimulus } from './sensoryLayer'

export interface SensoryEnvironmentState {
  tick: number
  ambientLight?: number
  ambientTemperatureC?: number
  windIntensity?: number
  precipitationIntensity?: number
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function buildingStimuli(building: LocalSurfaceBuilding, tick: number): SensoryStimulus[] {
  const def = building.entityId ? BUILDINGS[building.entityId] : undefined
  const category = def?.category
  const stimuli: SensoryStimulus[] = [{
    id: `building:${building.id}:visual:${tick}`,
    sourceRef: 'building:' + building.id,
    modality: 'visual',
    vector: {
      intensity: 0.6,
      novelty: building.provenance === 'synthetic' ? 0.45 : 0.3,
      complexity: category === 'production' ? 0.65 : category === 'housing' ? 0.45 : 0.5,
      features: {
        widthM: building.widthM,
        depthM: building.depthM,
        category: category ?? 'unknown',
      },
    },
    emittedAtTick: tick,
    position: building.center,
    rangeM: 80,
    provenanceRefs: [building.provenance],
  }]

  if (category === 'production' || category === 'infrastructure') {
    const heavy = building.entityId === 'mine'
      || building.entityId === 'factory'
      || building.entityId === 'ice_drill'
      || building.entityId === 'workshop_heavy'
      || building.entityId === 'reactor_module'
    stimuli.push({
      id: `building:${building.id}:machinery:${tick}`,
      sourceRef: 'building:' + building.id,
      modality: 'auditory',
      vector: {
        intensity: heavy ? 0.72 : 0.42,
        novelty: 0.16,
        periodicity: heavy ? 0.7 : 0.5,
        complexity: heavy ? 0.62 : 0.38,
        features: {
          sourceClass: 'machinery',
          buildingType: building.entityId ?? 'unknown',
        },
      },
      emittedAtTick: tick,
      position: building.center,
      rangeM: heavy ? 55 : 30,
      provenanceRefs: [building.provenance],
    })
  }

  if (building.entityId === 'plant_module') {
    stimuli.push({
      id: `building:${building.id}:plant-odor:${tick}`,
      sourceRef: 'building:' + building.id,
      modality: 'olfactory',
      vector: {
        intensity: 0.35,
        novelty: 0.25,
        complexity: 0.55,
        features: { sourceClass: 'vegetation' },
      },
      emittedAtTick: tick,
      position: building.center,
      rangeM: 6,
      provenanceRefs: [building.provenance],
    })
  }

  return stimuli
}

function mobileStimuli(object: LocalSurfaceMobileObject, tick: number): SensoryStimulus[] {
  const role = (object.role ?? '').toLowerCase()
  const vehicleLike = /rover|vehicle|truck|train|drone|shuttle|hauler/.test(role)
  const personLike = !vehicleLike

  const visual: SensoryStimulus = {
    id: `mobile:${object.id}:visual:${tick}`,
    sourceRef: object.id,
    modality: 'visual',
    vector: {
      intensity: vehicleLike ? 0.65 : 0.5,
      novelty: 0.38,
      complexity: vehicleLike ? 0.55 : 0.7,
      features: {
        sourceClass: vehicleLike ? 'vehicle' : 'person',
        role: object.role ?? '',
      },
    },
    emittedAtTick: tick,
    position: object.point,
    rangeM: vehicleLike ? 100 : 55,
  }

  const auditory: SensoryStimulus = {
    id: `mobile:${object.id}:auditory:${tick}`,
    sourceRef: object.id,
    modality: 'auditory',
    vector: {
      intensity: vehicleLike ? 0.62 : 0.24,
      novelty: 0.28,
      periodicity: vehicleLike ? 0.58 : 0.32,
      complexity: personLike ? 0.72 : 0.48,
      features: {
        sourceClass: vehicleLike ? 'vehicle_motion' : 'human_presence',
        role: object.role ?? '',
      },
    },
    emittedAtTick: tick,
    position: object.point,
    rangeM: vehicleLike ? 50 : 14,
  }

  return [visual, auditory]
}

function environmentalStimuli(scene: LocalSurfaceScene, env: SensoryEnvironmentState): SensoryStimulus[] {
  const stimuli: SensoryStimulus[] = []
  const center = { xM: 0, yM: 0 }

  if (env.ambientLight != null) {
    stimuli.push({
      id: `environment:${scene.frameId}:light:${env.tick}`,
      sourceRef: 'environment:' + scene.frameId,
      modality: 'visual',
      vector: {
        intensity: unit(env.ambientLight),
        novelty: 0.08,
        features: { sourceClass: 'ambient_light' },
      },
      emittedAtTick: env.tick,
      position: center,
      rangeM: scene.radiusM * 3,
      provenanceRefs: [scene.frameId],
    })
  }

  if (env.ambientTemperatureC != null) {
    const normalizedThermalIntensity = unit(Math.abs(env.ambientTemperatureC - 21) / 35)
    stimuli.push({
      id: `environment:${scene.frameId}:thermal:${env.tick}`,
      sourceRef: 'environment:' + scene.frameId,
      modality: 'thermal',
      vector: {
        intensity: Math.max(0.08, normalizedThermalIntensity),
        novelty: normalizedThermalIntensity,
        features: {
          sourceClass: 'ambient_temperature',
          temperatureC: env.ambientTemperatureC,
        },
      },
      emittedAtTick: env.tick,
      position: center,
      rangeM: scene.radiusM * 3,
      provenanceRefs: [scene.frameId],
    })
  }

  if (unit(env.windIntensity) > 0.02) {
    stimuli.push({
      id: `environment:${scene.frameId}:wind:${env.tick}`,
      sourceRef: 'environment:' + scene.frameId,
      modality: 'auditory',
      vector: {
        intensity: unit(env.windIntensity),
        novelty: 0.12,
        periodicity: 0.18,
        complexity: 0.42,
        features: { sourceClass: 'wind' },
      },
      emittedAtTick: env.tick,
      position: center,
      rangeM: scene.radiusM * 3,
      provenanceRefs: [scene.frameId],
    })
  }

  if (unit(env.precipitationIntensity) > 0.02) {
    stimuli.push({
      id: `environment:${scene.frameId}:precipitation:${env.tick}`,
      sourceRef: 'environment:' + scene.frameId,
      modality: 'auditory',
      vector: {
        intensity: unit(env.precipitationIntensity),
        novelty: 0.18,
        periodicity: 0.42,
        complexity: 0.6,
        features: { sourceClass: 'precipitation' },
      },
      emittedAtTick: env.tick,
      position: center,
      rangeM: scene.radiusM * 3,
      provenanceRefs: [scene.frameId],
    })
  }

  return stimuli
}

/**
 * Pure projection from already-known world state into physical stimuli.
 * No NPC traits, interpretation, memory or LLM calls are allowed here.
 */
export function buildWorldSensoryField(input: {
  scene: LocalSurfaceScene
  environment: SensoryEnvironmentState
}): SensoryStimulus[] {
  const stimuli = [
    ...input.scene.buildings.flatMap(building => buildingStimuli(building, input.environment.tick)),
    ...input.scene.mobileObjects.flatMap(object => mobileStimuli(object, input.environment.tick)),
    ...environmentalStimuli(input.scene, input.environment),
  ]

  return stimuli.sort((a, b) =>
    a.sourceRef.localeCompare(b.sourceRef)
      || a.modality.localeCompare(b.modality)
      || a.id.localeCompare(b.id),
  )
}
