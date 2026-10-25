import { describe, expect, it } from 'vitest'
import { placeNameFromLabel } from './placeName'

describe('placeNameFromLabel', () => {
  it('takes the first part of a place label', () => {
    expect(placeNameFromLabel('Sundern, Hochsauerlandkreis, Nordrhein-Westfalen, 59846, Deutschland')).toBe('Sundern')
    expect(placeNameFromLabel('Frankfurt am Main, Hessen, Deutschland')).toBe('Frankfurt am Main')
  })
  it('skips detail cells and collections', () => {
    expect(placeNameFromLabel('Lokaldetail 51.33436, 7.98851')).toBeNull()
    expect(placeNameFromLabel('Earth · Deutschland · Sauerland')).toBeNull()
    expect(placeNameFromLabel('Namibia · Erongo')).toBeNull()
  })
})
