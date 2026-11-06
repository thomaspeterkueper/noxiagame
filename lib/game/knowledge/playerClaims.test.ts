import { describe, expect, it } from 'vitest'
import { heardClaimLines, learnableClaim, newlyEstablishedIds, selectHeardClaims, type StoredClaim } from './playerClaims'
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

const day = 86_400_000
const now = Date.parse('2026-11-05T00:00:00Z')
let nextId = 1
const claim = (source: string, text: string, daysAgo: number, heardDaysAgo = daysAgo, established = false): StoredClaim => ({
  id: nextId++, source_key: source, claim: text, words: learn(text)!.words,
  created_at: new Date(now - daysAgo * day).toISOString(),
  last_heard_at: new Date(now - heardDaysAgo * day).toISOString(),
  established,
})
const heard = (rows: StoredClaim[], current = 'x') => selectHeardClaims(rows, { currentSourceKey: current, now })

describe('selectHeardClaims', () => {
  it('bündelt gleiche Aussagen und zählt unabhängige Quellen', () => {
    const rows = [
      claim('a', 'Der Raumhafen bekommt neue Andockbuchten für Frachter.', 1),
      claim('b', 'Am Raumhafen bauen sie neue Andockbuchten.', 2),
      claim('a', 'Der Raumhafen bekommt bald neue Andockbuchten.', 3),
    ]
    const out = heard(rows)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ sources: 2, corroborated: true })
  })
  it('ein einzelner Spieler zählt nur einmal, egal wie oft', () => {
    const rows = Array.from({ length: 6 }, (_, i) => claim('troll', 'Der Bürgermeister von Sundern wohnt heimlich im Raumhafen.', i))
    expect(heard(rows)[0].corroborated).toBe(false)
  })
  it('erzählt dem Sprecher nicht seine eigene Aussage', () => {
    expect(heard([claim('x', 'Die Bibliothek bekommt neue Philosophiebücher.', 1)])).toEqual([])
  })
  it('vergisst ab der letzten Erwähnung: unbestätigt nach 30, bestätigt nach 180 Tagen', () => {
    expect(heard([claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 40)])).toEqual([])
    const both = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 100), claim('b', 'In der Bibliothek stehen neue Philosophiebücher.', 120)]
    expect(heard(both)).toHaveLength(1)
    const old = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 200), claim('b', 'In der Bibliothek stehen neue Philosophiebücher.', 190)]
    expect(heard(old)).toEqual([])
  })
  it('Wiederholung frischt auf – auch wenn die erste Erwähnung lange her ist', () => {
    const repeated = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 400, 3), claim('b', 'In der Bibliothek stehen neue Philosophiebücher.', 300, 10)]
    expect(heard(repeated)).toHaveLength(1)
    expect(heard([claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 400, 5)])).toHaveLength(1)
  })
  it('festes Wissen wird nie vergessen', () => {
    const rows = [claim('a', 'Die Bibliothek bekommt neue Philosophiebücher.', 900, 800, true)]
    const out = heard(rows)
    expect(out).toHaveLength(1)
    expect(out[0].established).toBe(true)
    expect(heardClaimLines(out)[0]).toContain('schon lange')
  })
})

describe('newlyEstablishedIds', () => {
  it('drei Quellen über mindestens 30 Tage werden festes Wissen', () => {
    const rows = [
      claim('a', 'Im Startcafé gibt es den besten Apfelkuchen von Sundern.', 60, 60),
      claim('b', 'Im Startcafé backen sie den besten Apfelkuchen.', 20, 20),
      claim('c', 'Den besten Apfelkuchen gibt es im Startcafé.', 1, 1),
    ]
    expect(newlyEstablishedIds(rows)).toHaveLength(3)
  })
  it('drei Quellen am selben Tag reichen nicht', () => {
    const rows = ['a', 'b', 'c'].map(k => claim(k, 'Im Startcafé gibt es den besten Apfelkuchen von Sundern.', 1))
    expect(newlyEstablishedIds(rows)).toEqual([])
  })
})

describe('heardClaimLines', () => {
  it('nennt keine Quelle', () => {
    const lines = heardClaimLines([{ claim: 'X passiert.', sources: 1, corroborated: false, established: false, at: '' }])
    expect(lines[0]).toContain('unbestätigt')
  })
})
