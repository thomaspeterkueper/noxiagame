export type NpcRoutineActivity = 'sleep' | 'commute' | 'work' | 'meal' | 'community' | 'home'
export type NpcShiftKind = 'early' | 'day' | 'late'

export interface RoutineStop {
  activity: NpcRoutineActivity
  label: string
  target: 'home' | 'work' | 'community'
  moving: boolean
  progress: number
  shift: NpcShiftKind
  shiftLabel: string
  socialGroup: number
}

function hash01(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export function virtualDayProgress(tick: number) {
  return (tick % 240) / 240
}

export function residentRoutine(residentId: string, dayProgress: number): RoutineStop {
  const selector = hash01(`${residentId}:shift-kind`)
  const shift: NpcShiftKind = selector < 0.24 ? 'early' : selector > 0.78 ? 'late' : 'day'
  const shiftLabel = shift === 'early' ? 'Frühschicht' : shift === 'late' ? 'Spätschicht' : 'Tagschicht'
  const shiftOffset = shift === 'early' ? 0.12 : shift === 'late' ? -0.14 : 0
  const personalOffset = (hash01(`${residentId}:shift`) - 0.5) * 0.035
  const p = (dayProgress + shiftOffset + personalOffset + 1) % 1
  const socialGroup = Math.floor(hash01(`${residentId}:social-group`) * 4)
  const socialBias = hash01(`${residentId}:social-bias`)

  const stop = (activity: NpcRoutineActivity, label: string, target: RoutineStop['target'], moving = false, progress = 0): RoutineStop => ({
    activity,
    label,
    target,
    moving,
    progress,
    shift,
    shiftLabel,
    socialGroup,
  })

  if (p < 0.21) return stop('sleep', 'Ruhezeit', 'home')
  if (p < 0.27) return stop('commute', 'Weg zur Arbeit', 'work', true, (p - 0.21) / 0.06)
  if (p < 0.58) return stop('work', shiftLabel, 'work')
  if (p < 0.64) return stop('commute', 'Weg zum Treffpunkt', 'community', true, (p - 0.58) / 0.06)
  if (p < 0.72) return stop('meal', 'Mahlzeit', 'community')
  if (p < 0.80 && socialBias > 0.22) return stop('community', socialBias > 0.72 ? 'Treffen mit Kolonisten' : 'Freizeit / Gemeinschaft', 'community')
  if (p < 0.86) return stop('commute', 'Heimweg', 'home', true, Math.max(0, Math.min(1, (p - 0.80) / 0.06)))
  return stop('home', socialBias < 0.22 ? 'Private Freizeit' : 'Im Habitat', 'home')
}
