import { gameDateFromCoreTick } from './simulationCalendar'
const eq = (tick: unknown, date: string | null, day: number | null) => {
  const result = gameDateFromCoreTick(tick)
  if ((result?.date ?? null) !== date || (result?.day ?? null) !== day) throw new Error(`tick ${String(tick)}: ${JSON.stringify(result)}`)
}
eq(1, '1. Januar 2077', 0)
eq(24, '1. Januar 2077', 0)
eq(25, '2. Januar 2077', 1)
eq(1 + 24 * 365, '1. Januar 2078', 365)
eq(0, null, null)
eq(-1, null, null)
eq(1.5, null, null)
eq('25', null, null)
eq(Number.MAX_SAFE_INTEGER + 1, null, null)
console.log('NOXIA simulation calendar tests passed')
