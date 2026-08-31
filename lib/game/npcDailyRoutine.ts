export type NpcRoutineActivity = 'sleep' | 'commute' | 'work' | 'meal' | 'community' | 'home'

export interface RoutineStop {
  activity: NpcRoutineActivity
  label: string
  target: 'home' | 'work' | 'community'
  moving: boolean
  progress: number
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
  const shift = (hash01(`${residentId}:shift`) - 0.5) * 0.05
  const p = (dayProgress + shift + 1) % 1

  if (p < 0.23) return { activity: 'sleep', label: 'Ruhezeit', target: 'home', moving: false, progress: 0 }
  if (p < 0.29) return { activity: 'commute', label: 'Weg zur Arbeit', target: 'work', moving: true, progress: (p - 0.23) / 0.06 }
  if (p < 0.61) return { activity: 'work', label: 'Schicht', target: 'work', moving: false, progress: 0 }
  if (p < 0.67) return { activity: 'commute', label: 'Weg zum Treffpunkt', target: 'community', moving: true, progress: (p - 0.61) / 0.06 }
  if (p < 0.75) return { activity: 'meal', label: 'Mahlzeit', target: 'community', moving: false, progress: 0 }
  if (p < 0.84) return { activity: 'community', label: 'Freizeit / Gemeinschaft', target: 'community', moving: false, progress: 0 }
  if (p < 0.90) return { activity: 'commute', label: 'Heimweg', target: 'home', moving: true, progress: (p - 0.84) / 0.06 }
  return { activity: 'home', label: 'Im Habitat', target: 'home', moving: false, progress: 0 }
}
