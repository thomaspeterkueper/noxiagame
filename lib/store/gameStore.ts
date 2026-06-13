// lib/store/gameStore.ts
// Erstellt:     30.05.2026
// Aktualisiert: 08.06.2026 – Store-Invalidation (Entkopplung der Module)
// Version:      0.4.0
//
// v0.4.0: invalidations-Zähler + invalidate(key). Komponenten nutzen
// useGameStore(s => s.invalidations.builds) als useEffect-Dependency und
// rufen invalidate('builds') nach Aktionen — ersetzt durchgereichte
// onChanged-Callbacks und entkoppelt Trade/Colony/Fleet voneinander.
// v0.3.0: buy/sell mit Mengen-Parameter (Cargo-Loop-Fix).

import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'moon' | 'mars' | 'phobos'

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

interface Trade {
  id:            string
  from_location: string
  to_location:   string
  resource:      string
  amount:        number
  profit:        number
  traded_at:     string
}

const TRAVEL_TIME: Record<string, Record<string, number>> = {
  moon:   { mars: 30, phobos: 25 },
  mars:   { moon: 30, phobos: 10 },
  phobos: { moon: 25, mars: 10   },
}

interface GameState {
  credits:    number
  cargo:      Cargo
  cargoMax:   number
  location:   LocationSlug
  shipId:     string | null
  shipTypeId: string
  speedMult:  number
  loaded:     boolean

  inTransit:    boolean
  transitFrom:  LocationSlug | null
  transitTo:    LocationSlug | null
  transitTotal: number
  transitLeft:  number

  trades:     Trade[]

  // Invalidation: Zähler pro Datenbereich. Komponenten lesen den Zähler als
  // useEffect-Dependency; invalidate('builds') zählt hoch → Re-Fetch ausgelöst.
  // Ersetzt durchgereichte onChanged-Callbacks und entkoppelt die Module.
  invalidations: Record<string, number>
  invalidate: (key: string) => void

  cargoUsed: () => number
  cargoFree: () => number

  loadFromServer: () => Promise<void>
  loadTrades:     () => Promise<void>
  buy:            (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
  sell:           (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
  travel:         (dest: LocationSlug) => Promise<void>
  tickTransit:    () => void
}

async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function tradeRequest(params: Record<string, string | number>) {
  const token = await getToken()
  if (!token) throw new Error('Nicht eingeloggt')
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString()
  const res = await fetch(`/api/game/trade${query ? '?' + query : ''}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return res.json()
}

export const useGameStore = create<GameState>((set, get) => ({
  credits:    5000,
  cargo:      { water: 0, energy: 0, metal: 0 },
  cargoMax:   100,
  location:   'moon',
  shipId:     null,
  shipTypeId: 'freighter_mk1',
  speedMult:  1.0,
  loaded:     false,

  inTransit:    false,
  transitFrom:  null,
  transitTo:    null,
  transitTotal: 0,
  transitLeft:  0,

  trades: [],

  invalidations: {},
  invalidate: (key) => set(s => ({
    invalidations: { ...s.invalidations, [key]: (s.invalidations[key] ?? 0) + 1 },
  })),

  cargoUsed: () => {
    const { cargo } = get()
    return cargo.water + cargo.energy + cargo.metal
  },

  cargoFree: () => get().cargoMax - get().cargoUsed(),

  loadFromServer: async () => {
    try {
      const data = await tradeRequest({})
      if (data.error) return
      set({
        credits:    data.credits,
        cargo:      data.cargo,
        cargoMax:   data.cargoMax,
        location:   data.location,
        shipId:     data.shipId,
        shipTypeId: data.shipTypeId ?? 'freighter_mk1',
        loaded:     true,
      })
    } catch (err) {
      console.error('loadFromServer error:', err)
    }
  },

  loadTrades: async () => {
    try {
      const data = await tradeRequest({ action: 'getTrades' })
      if (data.trades) set({ trades: data.trades })
    } catch (err) {
      console.error('loadTrades error:', err)
    }
  },

  buy: async (resource, price, amount = 1) => {
    const { credits, cargoFree, location, inTransit } = get()
    if (inTransit)             return { ok: false, msg: 'Im Transit – warte auf Landung.', booked: 0 }
    if (credits < price)       return { ok: false, msg: 'Unzureichende Credits.', booked: 0 }
    if (cargoFree() < 1)       return { ok: false, msg: 'Frachtraum voll.', booked: 0 }

    const optimistic = Math.min(amount, cargoFree(), Math.floor(credits / Math.max(1, price)))
    set(s => ({
      credits: s.credits - price * optimistic,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] + optimistic },
    }))

    try {
      const data = await tradeRequest({ action: 'buy', resource, amount, price, location })
      if (!data.ok) {
        set(s => ({
          credits: s.credits + price * optimistic,
          cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - optimistic) },
        }))
        return { ok: false, msg: data.error ?? 'Fehler.', booked: 0 }
      }
      set({ credits: data.credits, cargo: data.cargo })
      const booked = data.bookedAmount ?? optimistic
      const msg = booked < amount
        ? `${booked} von ${amount}t gekauft (mehr war nicht möglich).`
        : `${booked}t gekauft für ${price * booked} Cr.`
      return { ok: true, msg, booked }
    } catch {
      set(s => ({
        credits: s.credits + price * optimistic,
        cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - optimistic) },
      }))
      return { ok: false, msg: 'Verbindungsfehler.', booked: 0 }
    }
  },

  sell: async (resource, price, amount = 1) => {
    const { cargo, location, inTransit } = get()
    if (inTransit)             return { ok: false, msg: 'Im Transit – warte auf Landung.', booked: 0 }
    if (cargo[resource] < 1)   return { ok: false, msg: 'Keine Ware an Bord.', booked: 0 }

    const optimistic = Math.min(amount, cargo[resource])
    set(s => ({
      credits: s.credits + price * optimistic,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] - optimistic },
    }))

    try {
      const data = await tradeRequest({ action: 'sell', resource, amount, price, location })
      if (!data.ok) {
        set(s => ({
          credits: s.credits - price * optimistic,
          cargo:   { ...s.cargo, [resource]: s.cargo[resource] + optimistic },
        }))
        return { ok: false, msg: data.error ?? 'Fehler.', booked: 0 }
      }
      set({ credits: data.credits, cargo: data.cargo })
      const booked = data.bookedAmount ?? optimistic
      const msg = booked < amount
        ? `${booked} von ${amount}t verkauft (mehr war nicht an Bord).`
        : `${booked}t verkauft für ${price * booked} Cr.`
      return { ok: true, msg, booked }
    } catch {
      set(s => ({
        credits: s.credits - price * optimistic,
        cargo:   { ...s.cargo, [resource]: s.cargo[resource] + optimistic },
      }))
      return { ok: false, msg: 'Verbindungsfehler.', booked: 0 }
    }
  },

  travel: async (dest) => {
    const { location, inTransit, speedMult } = get()
    if (inTransit) return
    if (location === dest) return

    const baseDuration = TRAVEL_TIME[location]?.[dest] ?? 20
    const duration = Math.round(baseDuration * speedMult)

    set({
      inTransit:    true,
      transitFrom:  location,
      transitTo:    dest,
      transitTotal: duration,
      transitLeft:  duration,
    })

    try {
      await tradeRequest({ action: 'travel', resource: dest, amount: 0, price: 0, location: dest })
    } catch (err) {
      console.error('travel error:', err)
    }
  },

  tickTransit: () => {
    const { inTransit, transitLeft, transitTo } = get()
    if (!inTransit) return

    if (transitLeft <= 1) {
      set({
        inTransit:    false,
        location:     transitTo as LocationSlug,
        transitFrom:  null,
        transitTo:    null,
        transitTotal: 0,
        transitLeft:  0,
      })
    } else {
      set(s => ({ transitLeft: s.transitLeft - 1 }))
    }
  },
}))
