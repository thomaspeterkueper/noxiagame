import { describe, expect, it } from 'vitest'
import { prepareRoomMessage } from './roomChat'

describe('prepareRoomMessage', () => {
  it('keeps ordinary talk as it is', () => {
    const m = prepareRoomMessage('  Hallo   zusammen, wer kommt mit zur Bar? ')!
    expect(m.shown).toBe('Hallo zusammen, wer kommt mit zur Bar?')
    expect(m.flags).toEqual([])
  })
  it('removes contact details from what others see, keeps the original for review', () => {
    const m = prepareRoomMessage('schreib mir: anna.k@mail.de oder 0171 2345678, insta @anna_k, www.example.com')!
    expect(m.shown).not.toMatch(/anna\.k@|2345678|@anna_k|example\.com/)
    expect(m.text).toContain('anna.k@mail.de')
    expect(m.flags).toEqual(expect.arrayContaining(['contact', 'messenger']))
  })
  it('flags insults and sexual requests, empty is nothing', () => {
    expect(prepareRoomMessage('du idiot')!.flags).toContain('provocation')
    expect(prepareRoomMessage('   ')).toBeNull()
  })
  it('cuts long messages', () => {
    expect(prepareRoomMessage('a'.repeat(400))!.text.length).toBe(300)
  })
})
