export type StickneyFleetRole = 'prospector' | 'excavator' | 'hauler' | 'maintenance'

export type StickneyFleetRobotSnapshot = {
  id: string
  label?: string | null
  status?: string | null
  modifications?: Record<string, unknown> | null
  emergent_state?: Record<string, unknown> | null
}

export type StickneyPilotJobSnapshot = {
  id: string
  status?: string | null
  started_at?: string | null
  completes_at?: string | null
  result?: Record<string, unknown> | null
}

export type StickneyFleetMapMarker = {
  id: string
  label: string
  role: StickneyFleetRole
  status: string
  phase: string
  xM: number
  yM: number
  accent: string
}

const YARD = { xM: 48, yM: -26 }
const DEPOT = { xM: 22, yM: 2 }
const ROLE_ACCENT: Record<StickneyFleetRole, string> = {
  prospector: '#61d6c4',
  excavator: '#e6a04b',
  hauler: '#8ac56a',
  maintenance: '#b18adf',
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
const between = (from: { xM: number; yM: number }, to: { xM: number; yM: number }, t: number) => ({ xM: lerp(from.xM, to.xM, t), yM: lerp(from.yM, to.yM, t) })
const finite = (value: unknown, fallback: number) => { const n = Number(value); return Number.isFinite(n) ? n : fallback }

function roleOf(robot: StickneyFleetRobotSnapshot): StickneyFleetRole {
  const role = robot.modifications?.fleetRole
  return role === 'prospector' || role === 'excavator' || role === 'hauler' || role === 'maintenance' ? role : 'excavator'
}

function runningProgress(job: StickneyPilotJobSnapshot, nowMs: number) {
  const start = job.started_at ? Date.parse(job.started_at) : NaN
  const end = job.completes_at ? Date.parse(job.completes_at) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return clamp01((nowMs - start) / (end - start))
}

function choreography(role: StickneyFleetRole, progress: number, target: { xM: number; yM: number }) {
  const prospectPoint = { xM: target.xM + 12, yM: target.yM + 8 }
  const excavationPoint = target
  const haulPoint = { xM: target.xM - 7, yM: target.yM - 4 }
  const supportPoint = { xM: target.xM + 16, yM: target.yM - 11 }

  if (role === 'prospector') {
    if (progress < .18) return { ...between(YARD, prospectPoint, progress / .18), phase: 'vorausfahrende Prospektion' }
    if (progress < .82) return { ...prospectPoint, phase: 'Zielcharakterisierung' }
    return { ...between(prospectPoint, YARD, (progress - .82) / .18), phase: 'Rückkehr zum Rover Yard' }
  }
  if (role === 'excavator') {
    if (progress < .12) return { ...YARD, phase: 'Einsatzvorbereitung' }
    if (progress < .32) return { ...between(YARD, excavationPoint, (progress - .12) / .20), phase: 'Anfahrt zum Abbaupunkt' }
    if (progress < .88) return { ...excavationPoint, phase: 'verankerter Pilotabbau' }
    return { ...between(excavationPoint, YARD, (progress - .88) / .12), phase: 'Rückkehr zum Rover Yard' }
  }
  if (role === 'hauler') {
    if (progress < .20) return { ...YARD, phase: 'wartet auf Material' }
    if (progress < .42) return { ...between(YARD, haulPoint, (progress - .20) / .22), phase: 'Anfahrt zum Abbaupunkt' }
    if (progress < .64) return { ...haulPoint, phase: 'Testmasse übernehmen' }
    if (progress < .92) return { ...between(haulPoint, DEPOT, (progress - .64) / .28), phase: 'Testmasse zum Depot' }
    return { ...DEPOT, phase: 'Testmasse am Depot' }
  }
  if (progress < .30) return { ...YARD, phase: 'Bereitschaft im Rover Yard' }
  if (progress < .48) return { ...between(YARD, supportPoint, (progress - .30) / .18), phase: 'Feldunterstützung anfahren' }
  if (progress < .82) return { ...supportPoint, phase: 'Feldwartung und Überwachung' }
  return { ...between(supportPoint, YARD, (progress - .82) / .18), phase: 'Rückkehr zum Rover Yard' }
}

export function deriveStickneyFleetMapMarkers(robots: StickneyFleetRobotSnapshot[], jobs: StickneyPilotJobSnapshot[], nowMs = Date.now()): StickneyFleetMapMarker[] {
  const running = jobs.find(job => job.status === 'running')
  const target = running ? { xM: finite(running.result?.targetX_m, YARD.xM), yM: finite(running.result?.targetY_m, YARD.yM) } : null
  const progress = running ? runningProgress(running, nowMs) : 0

  return robots.map(robot => {
    const role = roleOf(robot)
    const stored = { xM: finite(robot.emergent_state?.xM, YARD.xM), yM: finite(robot.emergent_state?.yM, YARD.yM) }
    const motion = target ? choreography(role, progress, target) : { ...stored, phase: robot.status === 'maintenance' ? 'Wartung erforderlich' : 'Rover Yard' }
    return {
      id: robot.id,
      label: robot.label ?? role,
      role,
      status: String(robot.status ?? 'unknown'),
      phase: motion.phase,
      xM: motion.xM,
      yM: motion.yM,
      accent: ROLE_ACCENT[role],
    }
  })
}
