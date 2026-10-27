import { describe, expect, it } from 'vitest'
import { flightDurationText, passengerOffers } from './passengerOffers'
import { passengerTicketPrice, transferQuote } from './transfer'

describe('scheduled flights without own ship', () => {
  const destinations = [{ slug: 'earth', name: 'Erde' }, { slug: 'moon', name: 'Mond' }, { slug: 'mars', name: 'Mars' }, { slug: 'phobos', name: 'Phobos' }, { slug: 'nowhere', name: 'Nirgendwo' }]

  it('lists every reachable destination with the price the server will charge', () => {
    const offers = passengerOffers({ from: 'earth', destinations, tick: 1000 })
    expect(offers.map(offer => offer.slug)).toEqual(['moon', 'phobos', 'mars'])
    const moon = offers[0]
    expect(moon.ticketPrice).toBe(passengerTicketPrice(transferQuote('earth', 'moon', 1000, { speedMult: 1 })!))
    expect(moon.name).toBe('Mond')
  })

  it('offers the way back from the Moon, and nothing from an unknown place', () => {
    expect(passengerOffers({ from: 'moon', destinations, tick: 1000 }).map(offer => offer.slug)).toContain('earth')
    expect(passengerOffers({ from: 'nowhere', destinations, tick: 1000 })).toEqual([])
  })

  it('writes durations', () => {
    expect(flightDurationText(27)).toBe('27 s')
    expect(flightDurationText(600)).toBe('10 min')
    expect(flightDurationText(7800)).toBe('2 h 10 min')
  })
})
