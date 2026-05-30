// lib/store/gameStore.ts
// Erstellt: 30.05.2026

import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'moon' | 'mars' | 'phobos'

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

interface GameState {
  credits:   number
  cargo:     Cargo
  cargoMax:  number
  location:  LocationSlug
  shipId:    string | null
  loaded:    boolean

  cargoUsed: () => number
  cargoFree: () => number

  loadFromServer: () => Promise<void>
  buy:    (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  sell:   (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  travel: (dest: LocationSlug) => Promise<void>
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
    const { credits, cargoFree, location } = get()
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
    } catch (err) {
      set(s => ({
        credits: s.credits + price,
        cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - 1) },
      }))
      return { ok: false, msg: 'Verbindungsfehler.' }
    }
  },

  sell: async (resource, price) => {
    const { cargo, location } = get()
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
    } catch (err) {
      set(s => ({
        credits: s.credits - price,
        cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
      }))
      return { ok: false, msg: 'Verbindungsfehler.' }
    }
  },

  travel: async (dest) => {
    set({ location: dest })
    try {
      await tradeRequest({ action: 'travel', resource: dest, amount: 0, price: 0, location: dest })
    } catch (err) {
      console.error('travel error:', err)
    }
  },
}))