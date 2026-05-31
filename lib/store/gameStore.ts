// lib/store/gameStore.ts
// Erstellt: 30.05.2026
// Aktualisiert: 31.05.2026 – Schiffstypen, Transit, Statistiken

import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'moon' | 'mars' | 'phobos'

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

// Handelshistorie für Statistiken
interface Trade {
  id:            string
  from_location: string
  to_location:   string
  resource:      string
  amount:        number
  profit:        number
  traded_at:     string
}

// Reisezeiten in Sekunden (Basiswert × speedMult)
const TRAVEL_TIME: Record<string, Record<string, number>> = {
  moon:   { mars: 30, phobos: 25 },
  mars:   { moon: 30, phobos: 10 },
  phobos: { moon: 25, mars: 10   },
}

interface GameState {
  // Spielerzustand
  credits:    number
  cargo:      Cargo
  cargoMax:   number
  location:   LocationSlug
  shipId:     string | null
  shipTypeId: string
  speedMult:  number
  loaded:     boolean

  // Transit
  inTransit:    boolean
  transitFrom:  LocationSlug | null
  transitTo:    LocationSlug | null
  transitTotal: number
  transitLeft:  number

  // Statistiken
  trades:     Trade[]

  // Berechnungen
  cargoUsed: () => number
  cargoFree: () => number

  // Aktionen
  loadFromServer: () => Promise<void>
  loadTrades:     () => Promise<void>
  buy:            (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  sell:           (resource: ResourceType, price: number) => Promise<{ ok: boolean; msg: string }>
  travel:         (dest: LocationSlug) => Promise<void>
  tickTransit:    () => void
}

// Bearer Token für API-Requests holen
async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// Hilfsfunktion für alle API-Requests mit Bearer Token
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
  // Initialwerte
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

  // Berechnungen
  cargoUsed: () => {
    const { cargo } = get()
    return cargo.water + cargo.energy + cargo.metal
  },

  cargoFree: () => get().cargoMax - get().cargoUsed(),

  // Spielstand aus DB laden
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

  // Handelshistorie laden (für Statistiken)
  loadTrades: async () => {
    try {
      const data = await tradeRequest({ action: 'getTrades' })
      if (data.trades) set({ trades: data.trades })
    } catch (err) {
      console.error('loadTrades error:', err)
    }
  },

  // Ressource kaufen mit optimistic update
  buy: async (resource, price) => {
    const { credits, cargoFree, location, inTransit } = get()
    if (inTransit)        return { ok: false, msg: 'Im Transit – warte auf Landung.' }
    if (credits < price)  return { ok: false, msg: 'Unzureichende Credits.' }
    if (cargoFree() < 1)  return { ok: false, msg: 'Frachtraum voll.' }

    // Optimistic update (sofortige UI-Reaktion)
    set(s => ({
      credits: s.credits - price,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] + 1 },
    }))

    try {
      const data = await tradeRequest({ action: 'buy', resource, amount: 1, price, location })
      if (!data.ok) {
        // Rollback bei Fehler
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

  // Ressource verkaufen mit optimistic update
  sell: async (resource, price) => {
    const { cargo, location, inTransit } = get()
    if (inTransit)           return { ok: false, msg: 'Im Transit – warte auf Landung.' }
    if (cargo[resource] < 1) return { ok: false, msg: 'Keine Ware an Bord.' }

    // Optimistic update
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

  // Reise starten (mit Transit-Animation)
  travel: async (dest) => {
    const { location, inTransit, speedMult } = get()
    if (inTransit) return
    if (location === dest) return

    // Reisezeit berechnen (Basiszeit × Schiffsgeschwindigkeit)
    const baseDuration = TRAVEL_TIME[location]?.[dest] ?? 20
    const duration = Math.round(baseDuration * speedMult)

    // Transit-State setzen
    set({
      inTransit:    true,
      transitFrom:  location,
      transitTo:    dest,
      transitTotal: duration,
      transitLeft:  duration,
    })

    // Server informieren
    try {
      await tradeRequest({ action: 'travel', resource: dest, amount: 0, price: 0, location: dest })
    } catch (err) {
      console.error('travel error:', err)
    }
  },

  // Jede Sekunde aufgerufen – zählt Reisezeit herunter
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