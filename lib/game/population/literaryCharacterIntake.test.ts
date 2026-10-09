import { describe, expect, it } from 'vitest'
import { getLiteraryCharacterIntake, LITERARY_CHARACTER_INTAKE } from './literaryCharacterIntake'

describe('literary character intake', () => {
  it('keeps four uniquely named characters in source review', () => {
    expect(LITERARY_CHARACTER_INTAKE).toHaveLength(4)
    expect(new Set(LITERARY_CHARACTER_INTAKE.map(x => x.characterKey)).size).toBe(3)
    expect(LITERARY_CHARACTER_INTAKE.every(x => x.state === 'source_review')).toBe(true)
  })
  it('does not invent a running person id or canon binding', () => {
    expect(getLiteraryCharacterIntake('aristeas-lux')?.intendedRole).toContain('DaVaRu')
    expect(getLiteraryCharacterIntake('daniel-van-runen-davaru')?.displayName).toContain('Daniel van Runen')
    expect(getLiteraryCharacterIntake('xerxes-gefaelle')?.sourceWork).toContain('Xerxes')
    expect(getLiteraryCharacterIntake('mr-marx-endia')?.intendedRole).toContain('CEO')
    expect(getLiteraryCharacterIntake('missing')).toBeUndefined()
  })
})
