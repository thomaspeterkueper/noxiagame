import { describe, expect, it } from 'vitest'
import { isDreamMaterial, newsRegionsForLocation, parseFeed, teaser } from './worldNewsFeed'

const rss = `<?xml version="1.0"?><rss><channel><title>x</title>
<item><title><![CDATA[Neue Radwege im Sauerland]]></title><link>https://example.org/a</link><description>Der Kreis baut aus. Mehr dazu später.</description><pubDate>Fri, 06 Nov 2026 07:00:00 +0100</pubDate><guid>a1</guid></item>
<item><title>Zwei Tote bei Unfall auf der A46</title><link>https://example.org/b</link><description>…</description></item>
</channel></rss>`

describe('worldNewsFeed', () => {
  it('parses RSS items with source and time', () => {
    const items = parseFeed('tagesschau', rss)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Neue Radwege im Sauerland')
    expect(items[0].publishedAt).toBe('2026-11-06T06:00:00.000Z')
  })
  it('keeps death and accidents out of dreams, the German word „war“ is harmless', () => {
    expect(isDreamMaterial('Zwei Tote bei Unfall auf der A46')).toBe(false)
    expect(isDreamMaterial('Neue Radwege im Sauerland')).toBe(true)
    expect(isDreamMaterial('Der Sommer war trocken')).toBe(true)
  })
  it('teaser is one sentence', () => {
    expect(teaser('Der Kreis baut aus. Mehr dazu später.')).toBe('Der Kreis baut aus.')
  })
  it('earth hears German and regional news, space hears space news', () => {
    expect(newsRegionsForLocation('earth')).toEqual(['de-nrw', 'de'])
    expect(newsRegionsForLocation('mars')).toEqual(['space'])
  })
})
