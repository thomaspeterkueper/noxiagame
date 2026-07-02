export type JourneyStepStatus = 'locked' | 'available' | 'completed'

export type JourneyStepKind =
  | 'observe'
  | 'build'
  | 'analyze'
  | 'research'
  | 'produce'
  | 'reach'

export type JourneyDomain = 'survival' | 'science' | 'logistics' | 'settlement'

export type JourneyReward = {
  kind: 'technology' | 'building' | 'resource' | 'insight'
  id: string
  label: string
}

export type JourneyStep = {
  id: string
  title: string
  description: string
  kind: JourneyStepKind
  requires?: string[]
  unlocks?: string[]
}

export type Journey = {
  id: string
  kgRef?: string
  title: string
  summary: string
  domain: JourneyDomain
  steps: JourneyStep[]
  rewards: JourneyReward[]
}
