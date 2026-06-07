// lib/store/gameStore.ts
// Erstellt:     30.05.2026
// Aktualisiert: 07.06.2026 – buy/sell mit Mengen-Parameter (Cargo-Loop-Fix)
// Version:      0.3.0
//
// v0.3.0: buy(resource, price, amount) und sell(resource, price, amount)
// buchen die ganze Menge in EINEM API-Call (Route bucht atomar, ggf. Teilbuchung).
// Der optimistische Update gilt für die Wunschmenge; die Server-Antwort
// (credits/cargo) überschreibt ihn danach mit den echten Werten, sodass sich
// eine Teilbuchung automatisch korrigiert. amount ist optional (Default 1),
// bestehende Aufrufe ohne Menge funktionieren unverändert.

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
  buy:            (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
  sell:           (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
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

  // Ressourcen kaufen – ganze Menge in einem Call, Server bucht ggf. Teilmenge
  buy: async (resource, price, amount = 1) => {
    const { credits, cargoFree, location, inTransit } = get()
    if (inTransit)             return { ok: false, msg: 'Im Transit – warte auf Landung.', booked: 0 }
    if (credits < price)       return { ok: false, msg: 'Unzureichende Credits.', booked: 0 }
    if (cargoFree() < 1)       return { ok: false, msg: 'Frachtraum voll.', booked: 0 }

    // Optimistic update für die Wunschmenge (Server-Antwort korrigiert ggf.)
    const optimistic = Math.min(amount, cargoFree(), Math.floor(credits / Math.max(1, price)))
    set(s => ({
      credits: s.credits - price * optimistic,
      cargo:   { ...s.cargo, [resource]: s.cargo[resource] + optimistic },
    }))

    try {
      const data = await tradeRequest({ action: 'buy', resource, amount, price, location })
      if (!data.ok) {
        // Rollback bei Fehler
        set(s => ({
          credits: s.credits + price * optimistic,
          cargo:   { ...s.cargo, [resource]: Math.max(0, s.cargo[resource] - optimistic) },
        }))
        return { ok: false, msg: data.error ?? 'Fehler.', booked: 0 }
      }
      // Server-Werte übernehmen (enthalten die tatsächlich gebuchte Menge)
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

  // Ressourcen verkaufen – ganze Menge in einem Call
  sell: async (resource, price, amount = 1) => {
    const { cargo, location, inTransit } = get()
    if (inTransit)             return { ok: false, msg: 'Im Transit – warte auf Landung.', booked: 0 }
    if (cargo[resource] < 1)   return { ok: false, msg: 'Keine Ware an Bord.', booked: 0 }

    // Optimistic update für das, was wir wirklich haben
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

  // Reise starten (mit Transit-Animation)
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

  // Jede Sekunde aufgerufen – zählt Reisezeit herunter
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
