// lib/store/gameStore.ts
// Erstellt:     30.05.2026
// Aktualisiert: 10.09.2026 — server-autoritiver, reload-fester Transit
// Version:      0.5.0
//
// v0.5.0: Transit wird vom Server gestartet/abgeschlossen und beim Reload aus
// ships.status + Zeitstempeln rekonstruiert. Der Browser zählt nur für die UI.
// v0.4.0: invalidations-Zähler + invalidate(key). Komponenten nutzen
// useGameStore(s => s.invalidations.builds) als useEffect-Dependency und
// rufen invalidate('builds') nach Aktionen — ersetzt durchgereichte
// onChanged-Callbacks und entkoppelt Trade/Colony/Fleet voneinander.
// v0.3.0: buy/sell mit Mengen-Parameter (Cargo-Loop-Fix).

import { create } from 'zustand'

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = 'earth' | 'moon' | 'mars' | 'phobos' | 'prometheus'

// Effektive Reichweite eines Schiffs (in Basis-Distanz).
// HEUTE: gibt schlicht baseRange zurück (statische Reichweite aus ship_types).
// SPÄTER (Treibstoff-/Logistik-System, Post-Alpha): cargoWeight und modifiers
// fließen in die Formel ein — schwerere Ladung senkt die Reichweite, Module
// heben/senken sie. Die Signatur trägt die Parameter schon, damit der spätere
// Umbau additiv ist und KEINE Aufrufstelle geändert werden muss.
export function effectiveRange(
  baseRange: number,
  _cargoWeight?: number,
  _modifiers?: Record<string, number>,
): number {
  return baseRange
}

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

interface Trade {
  id:            string
  order_id?:     string | null
  from_location: string
  to_location:   string
  resource:      string
  amount:        number
  profit:        number
  traded_at:     string
}

interface GameState {
  credits:    number
  cargo:      Cargo
  cargoMax:   number
  location:   LocationSlug
  shipId:     string | null
  shipTypeId: string
  speedMult:  number
  shipRange:  number
  loaded:     boolean

  inTransit:         boolean
  transitFrom:       LocationSlug | null
  transitTo:         LocationSlug | null
  transitTotal:      number
  transitLeft:       number
  transitCompleting: boolean

  trades: Trade[]

  costBasis: Record<ResourceType, number>

  invalidations: Record<string, number>
  invalidate: (key: string) => void

  cargoUsed: () => number
  cargoFree: () => number

  loadFromServer: () => Promise<void>
  loadTrades:     () => Promise<void>
  buy:            (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
  sell:           (resource: ResourceType, price: number, amount?: number) => Promise<{ ok: boolean; msg: string; booked: number }>
  travel:         (dest: LocationSlug, atTick?: number) => Promise<void>
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

async function transitRequest(body?: Record<string, unknown>) {
  const token = await getToken()
  if (!token) throw new Error('Nicht eingeloggt')
  const res = await fetch('/api/game/transit', {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return res.json()
}

export const useGameStore = create<GameState>((set, get) => ({
  credits:    5000,
  cargo:      { water: 0, energy: 0, metal: 0 },
  cargoMax:   100,
  location:   'earth',
  shipId:     null,
  shipTypeId: 'freighter_mk1',
  speedMult:  1.0,
  shipRange:  28,
  loaded:     false,

  inTransit:         false,
  transitFrom:       null,
  transitTo:         null,
  transitTotal:      0,
  transitLeft:       0,
  transitCompleting: false,

  trades: [],

  costBasis: { water: 0, energy: 0, metal: 0 },

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
      // Transit zuerst lesen: der GET-Pfad materialisiert eine inzwischen
      // fällige Ankunft idempotent, bevor der allgemeine Ship/Cargo-State folgt.
      const transitData = await transitRequest()
      const data = await tradeRequest({})
      if (data.error) return

      const transit = transitData?.transit
      const inTransit = transit?.status === 'transit'

      set({
        credits:      data.credits,
        cargo:        data.cargo,
        cargoMax:     data.cargoMax,
        location:     (inTransit ? transit.location : data.location) as LocationSlug,
        shipId:       data.shipId,
        shipTypeId:   data.shipTypeId ?? 'freighter_mk1',
        speedMult:    data.speedMult ?? 1.0,
        shipRange:    data.rangeDistance ?? 28,
        loaded:       true,
        inTransit,
        transitFrom:  inTransit ? transit.from as LocationSlug : null,
        transitTo:    inTransit ? transit.to as LocationSlug : null,
        transitTotal: inTransit ? Math.max(1, Number(transit.totalSeconds ?? 1)) : 0,
        transitLeft:  inTransit ? Math.max(0, Number(transit.remainingSeconds ?? 0)) : 0,
        transitCompleting: false,
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
      const unit = data.unitPrice ?? price
      set(s => {
        const prevQty  = Math.max(0, s.cargo[resource] - booked)
        const prevCost = s.costBasis[resource] ?? 0
        const newQty   = s.cargo[resource]
        const avg = newQty > 0
          ? (prevQty * prevCost + booked * unit) / newQty
          : unit
        return { costBasis: { ...s.costBasis, [resource]: Math.round(avg) } }
      })
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
      set(s => s.cargo[resource] <= 0
        ? { costBasis: { ...s.costBasis, [resource]: 0 } }
        : {})
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

  travel: async (dest, _atTick = 0) => {
    const { location, inTransit } = get()
    if (inTransit || location === dest) return

    try {
      const data = await transitRequest({ action: 'start', destination: dest })
      if (data.error || !data.ok || !data.transit) {
        alert(`Flug-Fehler: ${data.error ?? 'Flug abgelehnt'}`)
        console.error('transit start error:', data)
        return
      }

      const transit = data.transit
      set(s => ({
        credits:      Number.isFinite(Number(data.credits)) ? Number(data.credits) : s.credits,
        cargo:        { ...s.cargo, energy: Math.max(0, s.cargo.energy - Number(data.energyUsed ?? 0)) },
        inTransit:    true,
        transitFrom:  transit.from as LocationSlug,
        transitTo:    transit.to as LocationSlug,
        transitTotal: Math.max(1, Number(transit.totalSeconds ?? 1)),
        transitLeft:  Math.max(0, Number(transit.remainingSeconds ?? transit.totalSeconds ?? 1)),
        transitCompleting: false,
      }))
    } catch (err) {
      console.error('travel error:', err)
    }
  },

  tickTransit: () => {
    const { inTransit, transitLeft, transitCompleting } = get()
    if (!inTransit || transitCompleting) return

    if (transitLeft > 1) {
      set(s => ({ transitLeft: s.transitLeft - 1 }))
      return
    }

    set({ transitLeft: 0, transitCompleting: true })
    void (async () => {
      try {
        const data = await transitRequest({ action: 'complete' })
        if (!data.ok) throw new Error(data.error ?? 'Transit-Abschluss fehlgeschlagen')

        if (!data.completed && Number(data.remainingSeconds ?? 0) > 0) {
          set({
            transitLeft: Number(data.remainingSeconds),
            transitCompleting: false,
          })
          return
        }

        await get().loadFromServer()
      } catch (err) {
        console.error('complete transit error:', err)
        // Server-State bleibt autoritativ. Ein erneuter Tick/Reload versucht
        // denselben idempotenten Completion-Command erneut.
        set({ transitLeft: 1, transitCompleting: false })
      }
    })()
  },
}))