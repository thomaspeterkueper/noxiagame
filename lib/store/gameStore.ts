import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'moon' | 'mars' | 'phobos'

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

interface GameState {
  credits:     number
  cargo:       Cargo
  cargoMax:    number
  location:    LocationSlug

  // Berechnungen
  cargoUsed:   () => number
  cargoFree:   () => number

  // Aktionen
  buy:         (resource: ResourceType, price: number) => { ok: boolean; msg: string }
  sell:        (resource: ResourceType, price: number) => { ok: boolean; msg: string }
  travel:      (dest: LocationSlug) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  credits:  5000,
  cargo:    { water: 0, energy: 0, metal: 0 },
  cargoMax: 100,
  location: 'moon',

  cargoUsed: () => {
    const { cargo } = get()
    return cargo.water + cargo.energy + cargo.metal
  },

  cargoFree: () => {
    const { cargoMax } = get()
    return cargoMax - get().cargoUsed()
  },

  buy: (resource, price) => {
    const { credits, cargoFree } = get()
    if (credits < price)    return { ok: false, msg: 'Unzureichende Credits.' }
    if (cargoFree() < 1)    return { ok: false, msg: 'Frachtraum voll.' }
    set(s => ({
      credits: s.credits - price,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
    }))
    return { ok: true, msg: `1t gekauft für ${price} Cr.` }
  },

  sell: (resource, price) => {
    const { cargo } = get()
    if (cargo[resource] < 1) return { ok: false, msg: 'Keine Ware an Bord.' }
    set(s => ({
      credits: s.credits + price,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] - 1 },
    }))
    return { ok: true, msg: `1t verkauft für ${price} Cr.` }
  },

  travel: (dest) => {
    set({ location: dest })
  },
}))