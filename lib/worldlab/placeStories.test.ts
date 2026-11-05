import { describe, expect, it } from 'vitest'
import { PLACE_STORIES, placeStory } from './placeStories'

describe('placeStory', () => {
  it('findet die Rochuskapelle nach OSM-Kennung', () => {
    expect(placeStory('osm:way:246890728')?.title).toBe('Rochuskapelle')
  })
  it('liefert nichts für unbekannte oder leere Kennungen', () => {
    expect(placeStory('osm:way:1')).toBeNull()
    expect(placeStory(null)).toBeNull()
    expect(placeStory(undefined)).toBeNull()
  })
  it('jede Geschichte hat eine gültige Kennung, Text und eine Quelle mit https-Adresse', () => {
    for (const story of PLACE_STORIES) {
      expect(story.source).toMatch(/^osm:(node|way|relation):[0-9]{1,15}$/)
      expect(story.paragraphs.length).toBeGreaterThan(0)
      expect(story.credit.url).toMatch(/^https:\/\//)
    }
  })
  it('Kennungen sind eindeutig', () => {
    expect(new Set(PLACE_STORIES.map(story => story.source)).size).toBe(PLACE_STORIES.length)
  })
})
