import type { Journey, JourneyStepStatus } from './types'
import type { JourneyCatalogStep, JourneyStepTrigger } from './journeyCatalog'

export type JourneyProgress = Record<string, boolean>

export type JourneyProgressSummary = {
  completed: number
  total: number
  percent: number
}

export type JourneyEvaluationContext = {
  ships: any[]
  entities: any[]
  trades: any[]
  knowledge: number
  currentLocation?: string
}

export function getStepStatus(
  journey: Journey,
  stepId: string,
  progress: JourneyProgress
): JourneyStepStatus {
  const step = journey.steps.find((item) => item.id === stepId)

  if (!step) return 'locked'
  if (progress[step.id]) return 'completed'

  const requirements = step.requires ?? []
  const allRequirementsMet = requirements.every((id) => progress[id])

  return allRequirementsMet ? 'available' : 'locked'
}

export function getJourneyProgress(
  journey: Journey,
  progress: JourneyProgress
): JourneyProgressSummary {
  const completed = journey.steps.filter((step) => progress[step.id]).length
  const total = journey.steps.length

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export function getAvailableSteps(
  journey: Journey,
  progress: JourneyProgress
) {
  return journey.steps.filter(
    (step) => getStepStatus(journey, step.id, progress) === 'available'
  )
}

export function isJourneyCompleted(
  journey: Journey,
  progress: JourneyProgress
) {
  return journey.steps.every((step) => progress[step.id])
}

function hasEntity(entity: any, entityIds: string[]) {
  return entityIds.includes(entity.entity_id)
}

function entityLocation(entity: any) {
  return entity.locations?.slug ?? entity.location ?? entity.location_slug
}

export function evaluateJourneyTrigger(
  trigger: JourneyStepTrigger | undefined,
  ctx: JourneyEvaluationContext
) {
  if (!trigger) return false

  if (trigger.type === 'ship_count') {
    return ctx.ships.length >= trigger.min
  }

  if (trigger.type === 'current_location') {
    return ctx.currentLocation === trigger.value
  }

  if (trigger.type === 'entity_at_location') {
    return ctx.entities.some(
      (entity) => entityLocation(entity) === trigger.location && hasEntity(entity, trigger.entityIds)
    )
  }

  if (trigger.type === 'entity_owned_any') {
    return ctx.entities.some((entity) => hasEntity(entity, trigger.entityIds))
  }

  if (trigger.type === 'entity_owned_count') {
    return ctx.entities.filter((entity) => hasEntity(entity, trigger.entityIds)).length >= trigger.min
  }

  if (trigger.type === 'trade_count') {
    return (ctx.trades?.length ?? 0) >= trigger.min
  }

  if (trigger.type === 'knowledge_points') {
    return ctx.knowledge >= trigger.min
  }

  return false
}

export function completedStepIdsFromTriggers(
  steps: JourneyCatalogStep[],
  ctx: JourneyEvaluationContext
) {
  return steps
    .filter((step) => evaluateJourneyTrigger(step.trigger, ctx))
    .map((step) => step.id)
}

export function progressFromTriggers(
  steps: JourneyCatalogStep[],
  ctx: JourneyEvaluationContext
): JourneyProgressSummary & { completed_step_ids: string[] } {
  const requiredSteps = steps.filter((step) => !step.optional)
  const total = Math.max(1, requiredSteps.length)
  const completed = completedStepIdsFromTriggers(steps, ctx)
  const requiredCompleted = requiredSteps.filter((step) => completed.includes(step.id)).length

  return {
    completed: requiredCompleted,
    total,
    percent: Math.round((requiredCompleted / total) * 100),
    completed_step_ids: completed,
  }
}
