import type { Journey, JourneyStepStatus } from './types'

export type JourneyProgress = Record<string, boolean>

export type JourneyProgressSummary = {
  completed: number
  total: number
  percent: number
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
