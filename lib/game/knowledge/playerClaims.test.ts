import { describe, expect, it } from 'vitest'
import { heardClaimLines, learnableClaim, selectHeardClaims, type StoredClaim } from './playerClaims'
import { assessRealWorldRisk } from '../safety/realWorldRisk'

const learn = (text: string, topic: Parameters<typeof learnableClaim>[1] = 'world_news') => learnableClaim(text, topic, assessRealWorldRisk(text))

describe('learnableClaim', () => {
  it('nimmt Aussagen über die Welt', () => {
    expect(learn('Im Café an der Hauptstraße gibt es neuerdings Apfelkuchen.')?.claim).toContain('Apfelkuchen')
  })
  it('nimmt keine Fragen', () => {
    expect(learn('Gibt es im Café an der Hauptstraße Apfelkuchen?')).toBeNull()
  })
  it('nimmt nichts Persönliches', () => {
    expect(learn('Meine Schwester arbeitet jetzt im Krankenhaus von Sundern.')).toBeNull()
    expect(learn('Du solltest morgen unbedingt zum Raumhafen gehen.')).toBeNull()
  })
  it('nimmt nichts mit Kontaktdaten oder Realwelt-Risiko', () => {
    expect(learn('Beim Händler am Markt gibt es Koks gegen Bitcoin.')).toBeNull()
    expect(learn('Die Werkstatt am Hafen hat jetzt die Nummer 0171 1234567.')).toBeNull()
  })
  it('nimmt nur passende Anliegen', () => {
    expect(learn('Der Bäcker in Seelenberg backt sonntags Brötchen.', 'provocation')).toBeNull()
  })
})

const claim = (source: string, text: string, daysAgo: number): StoredClaim => ({
  source_profile_id: source, claim: text, words: learn(text)!.words,
  created_at: new Date(Date.parse('2026-11-05T00:00:00Z') - daysAgo * 86_400_000).toISOString(),
})
const now = Date.parse('2026-11-05T00:00:00Z')

describe('selectHeardClaims', () => {
  it('bündelt gleiche Aussagen und zählt unabhängige Quellen', () => {
    const rows = [
      claim('a', 'Der Raumhafen bekommt neue Andockbuchten für Frachter.', 1),
      claim('b', 'Am Raumhafen bauen sie neue Andockbuchten.', 2),
      claim('a', 'Der Raumhafen bekommt bald neue Andockbuchten.', 3),
    ]
    const heard = selectHeardClaims(rows, { currentPlayer: 'x', now })
    expect(heard).toHaveLength(1)
    expect(heard[0]).toMatchObject({ sources: 2, corroborated: true })
  })
  it('ein einzelner Spieler zählt nur einmal, egal wie oft', () => {
    const rows = Array.from({ length: 6 }, (_, i) => claim('troll', 'Der Bürgermeister von Sundern wohnt heimlich im Raumhafen.', i))
    expect(selectHeardClaims(rows, { currentPlayer: 'x', now })[0].corroborated).toBe(false)
  })
  it('erzählt dem Sprecher nicht seine eigene Aussage', () => {
    const rows = [claim('x', 'Die Bibliothek bekommt neue Philosophiebücher.', 1)]
    expect(selectHeardClaims(rows, { currentPlayer: 'x', now })).toEqual([])
  })
  it('vergisst gestuft: unbestätigt nach 30, bestätigt nach 180 Tagen', () => {
    const single = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 40)]
    expect(selectHeardClaims(single, { currentPlayer: 'x', now })).toEqual([])
    const both = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 100), claim('b', 'In der Bibliothek stehen neue Philosophiebücher.', 120)]
    expect(selectHeardClaims(both, { currentPlayer: 'x', now })).toHaveLength(1)
  })
  it('Zeilen nennen keine Quelle', () => {
    const lines = heardClaimLines([{ claim: 'X passiert.', sources: 1, corroborated: false, at: '' }])
    expect(lines[0]).toContain('unbestätigt')
  })
})
