// lib/store/gameStore.ts
// Erstellt: 30.05.2026
// Aktualisiert: 30.05.2026 – Transit-Mechanik

import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'moon' | 'mars' | 'phobos'

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

// Reisezeiten in Sekunden
const TRAVEL_TIME: Record<string, Record<string, number>> = {
  moon:   { mars: 30, phobos: 25 },
  mars:   { moon: 30, phobos: 10 },
  phobos: { moon: 25, mars: 10   },
}

interface GameState {
  credits:   number
  cargo:     Cargo
  cargoMax:  number
  location:  LocationSlug
  shipId:    string | null
  loaded:    boolean

  // Transit
  inTransit:    boolean
  transitFrom:  LocationSlug | null
  transitTo:    LocationSlug | null
  transitTotal: number   // Gesamtdauer in Sekunden
  transitLeft:  number   // Verbleibende Sekunden

  cargoUsed: () => number
  cargoFree: () => number

  loadFromServer: () => Promise<void>
  buy:    (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  sell:   (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  travel: (dest: LocationSlug) => Promise<void>
  tickTransit: () => void   // wird jede Sekunde aufgerufen
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
  credits:  5000,
  cargo:    { water: 0, energy: 0, metal: 0 },
  cargoMax: 100,
  location: 'moon',
  shipId:   null,
  loaded:   false,

  inTransit:    false,
  transitFrom:  null,
  transitTo:    null,
  transitTotal: 0,
  transitLeft:  0,

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
        credits:  data.credits,
        cargo:    data.cargo,
        cargoMax: data.cargoMax,
        location: data.location,
        shipId:   data.shipId,
        loaded:   true,
      })
    } catch (err) {
      console.error('loadFromServer error:', err)
    }
  },

  buy: async (resource, price) => {
    const { credits, cargoFree, location, inTransit } = get()
    if (inTransit)        return { ok: false, msg: 'Im Transit – warte auf Landung.' }
    if (credits < price)  return { ok: false, msg: 'Unzureichende Credits.' }
    if (cargoFree() < 1)  return { ok: false, msg: 'Frachtraum voll.' }

    set(s => ({
      credits: s.credits - price,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
    }))

    try {
      const data = await tradeRequest({ action: 'buy', resource, amount: 1, price, location })
      if (!data.ok) {
        set(s => ({
          credits: s.credits + price,
          cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - 1) },
        }))
        return { ok: false, msg: data.error ?? 'Fehler.' }
      }
      set({ credits: data.credits, cargo: data.cargo })
      return { ok: true, msg: `Gekauft für ${price} Cr.` }
    } catch {
      set(s => ({
        credits: s.credits + price,
        cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - 1) },
      }))
      return { ok: false, msg: 'Verbindungsfehler.' }
    }
  },

  sell: async (resource, price) => {
    const { cargo, location, inTransit } = get()
    if (inTransit)           return { ok: false, msg: 'Im Transit – warte auf Landung.' }
    if (cargo[resource] < 1) return { ok: false, msg: 'Keine Ware an Bord.' }

    set(s => ({
      credits: s.credits + price,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] - 1 },
    }))

    try {
      const data = await tradeRequest({ action: 'sell', resource, amount: 1, price, location })
      if (!data.ok) {
        set(s => ({
          credits: s.credits - price,
          cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
        }))
        return { ok: false, msg: data.error ?? 'Fehler.' }
      }
      set({ credits: data.credits, cargo: data.cargo })
      return { ok: true, msg: `Verkauft für ${price} Cr.` }
    } catch {
      set(s => ({
        credits: s.credits - price,
        cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
      }))
      return { ok: false, msg: 'Verbindungsfehler.' }
    }
  },

  travel: async (dest) => {
    const { location, inTransit } = get()
    if (inTransit) return
    if (location === dest) return

    const duration = TRAVEL_TIME[location]?.[dest] ?? 20

    // Transit starten
    set({
      inTransit:    true,
      transitFrom:  location,
      transitTo:    dest,
      transitTotal: duration,
      transitLeft:  duration,
    })

    // Server informieren (passiert sofort, Ankunft ist clientseitig)
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
      // Angekommen
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