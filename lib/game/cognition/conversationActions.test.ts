import { describe, expect, it } from 'vitest'
import { parseActionMarkers, playerConsentsToFollow, stripActionMarkers } from './conversationActions'

describe('playerConsentsToFollow', () => {
  it('erkennt einfache Zustimmung', () => {
    expect(playerConsentsToFollow('Ja, gerne!')).toBe(true)
    expect(playerConsentsToFollow('Gehen wir')).toBe(true)
  })
  it('lehnt Verneinung und fehlende Zustimmung ab', () => {
    expect(playerConsentsToFollow('Nein, ich komme nicht mit')).toBe(false)
    expect(playerConsentsToFollow('ich folge dir nie')).toBe(false)
    expect(playerConsentsToFollow('Wie spät ist es?')).toBe(false)
  })
  it('ignoriert Unicode-Tarnung bei Verneinung', () => {
    expect(playerConsentsToFollow('ｎｅｉｎ, ich komme nicht')).toBe(false)
  })
})

describe('Aktionsmarker', () => {
  it('liest Marker aus der Modellantwort', () => {
    expect(parseActionMarkers('Komm! [[ACTION:LEAD_WALK]]')).toEqual({ leadWalk: true, visitPlaceKey: null })
    expect(parseActionMarkers('Dort. [[ACTION:VISIT_PLACE:p3]]').visitPlaceKey).toBe('p3')
    expect(parseActionMarkers('Hallo')).toEqual({ leadWalk: false, visitPlaceKey: null })
  })
  it('entfernt alle Markerformen aus dem sichtbaren Text', () => {
    const raw = 'A [[ACTION:ACCEPT_CREDITS]] B [[ action:EVIL ]] C ［［ACTION:LEAD_WALK］］ D'
    expect(stripActionMarkers(raw)).not.toMatch(/ACTION/i)
  })
})
