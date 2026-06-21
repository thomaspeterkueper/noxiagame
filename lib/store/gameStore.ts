// lib/store/gameStore.ts
// Erstellt:     30.05.2026
// Aktualisiert: 21.06.2026 19:45
// Version:      0.4.0
//
// v0.4.0: invalidations-Zähler + invalidate(key). Komponenten nutzen
// useGameStore(s => s.invalidations.builds) als useEffect-Dependency und
// rufen invalidate('builds') nach Aktionen — ersetzt durchgereichte
// onChanged-Callbacks und entkoppelt Trade/Colony/Fleet voneinander.
// v0.3.0: buy/sell mit Mengen-Parameter (Cargo-Loop-Fix).

import { create } from 'zustand'
import { baseTravelSeconds, flightEnergyCost } from '@/lib/game/ships'

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
  _cargoWeight?: number,            // reserviert: Ladungsgewicht (mehr Last → weniger weit)
  _modifiers?: Record<string, number>,  // reserviert: Schiffs-Upgrades/Module
): number {
  // Aktuell keine Modifikation. Einstiegspunkt für später.
  return baseRange
}

interface Cargo {
  water:  number
  energy: number
  metal:  number
}

interface Trade {
  id:            string
  order_id?:     string | null   // gesetzt → erfüllter Auftrag (Versorgung, Punkt 7)
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
  shipRange:  number   // statische Reichweite (Basis-Distanz); range_distance aus ship_types
  loaded:     boolean

  inTransit:    boolean
  transitFrom:  LocationSlug | null
  transitTo:    LocationSlug | null
  transitTotal: number
  transitLeft:  number

  trades:     Trade[]

  // Einstandspreis je Ressource (gewichteter Ø-Kaufpreis der Ware an Bord).
  // Beim Kauf fortgeschrieben, bei Bestand 0 zurückgesetzt. Für die Verkaufs-
  // Entscheidung in der Auktion („was hab ich bezahlt → lohnt der Mindestpreis").
  costBasis: Record<ResourceType, number>

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

  inTransit:    false,
  transitFrom:  null,
  transitTo:    null,
  transitTotal: 0,
  transitLeft:  0,

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
      const data = await tradeRequest({})  // kein location-Filter — is_active bestimmt das Schiff
      if (data.error) return
      // Transit-State IMMER resetten beim loadFromServer.
      // Server-State ist die einzige Quelle der Wahrheit — kein hängender Transit.
      set({
        credits:      data.credits,
        cargo:        data.cargo,
        cargoMax:     data.cargoMax,
        location:     data.location,
        shipId:       data.shipId,
        shipTypeId:   data.shipTypeId ?? 'freighter_mk1',
        speedMult:    data.speedMult ?? 1.0,
        shipRange:    data.rangeDistance ?? 28,
        loaded:       true,
        inTransit:    false,
        transitFrom:  null,
        transitTo:    null,
        transitTotal: 0,
        transitLeft:  0,
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
      // Einstandspreis fortschreiben: gewichteter Ø aus altem Bestand×altem Einstand
      // und neuer Menge×tatsächlichem Kaufpreis (Server-unitPrice, sonst price).
      const unit = data.unitPrice ?? price
      set(s => {
        const prevQty  = Math.max(0, s.cargo[resource] - booked)  // Bestand VOR diesem Kauf
        const prevCost = s.costBasis[resource] ?? 0
        const newQty   = s.cargo[resource]                        // Bestand NACH dem Kauf (Server)
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
      // Einstand zurücksetzen, sobald die Ressource vollständig verkauft ist.
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

  travel: async (dest, atTick = 0) => {
    const { location, inTransit, speedMult, cargo } = get()
    if (inTransit) return
    if (location === dest) return

    // Energie-Check VOR dem Flug (server macht dasselbe — Client-Check verhindert
    // den optimistischen Transit-State wenn Energie fehlt)
    const energyNeeded = flightEnergyCost(location, dest)
    if (cargo.energy < energyNeeded) {
      console.warn(`Nicht genug Energie: braucht ${energyNeeded}t, an Bord ${cargo.energy}t`)
      return
    }

    const baseDuration = baseTravelSeconds(location, dest, atTick) ?? 20
    const duration = Math.round(baseDuration * speedMult)

    // Optimistisch: Energie abziehen + Transit starten
    set(s => ({
      inTransit:    true,
      transitFrom:  location,
      transitTo:    dest,
      transitTotal: duration,
      transitLeft:  duration,
      cargo:        { ...s.cargo, energy: s.cargo.energy - energyNeeded },
    }))

    try {
      const data = await tradeRequest({ action: 'travel', resource: dest, amount: 0, price: 0, location: location })
      if (data.error || !data.ok) {
        // Server hat abgelehnt → Rollback
        set(s => ({
          inTransit:   false,
          transitFrom: null,
          transitTo:   null,
          transitTotal: 0,
          transitLeft:  0,
          cargo:       { ...s.cargo, energy: s.cargo.energy + energyNeeded },
        }))
        // Fehlermeldung im UI sichtbar machen
        const msg = data.error ?? `Flug abgelehnt (ok=${data.ok})`
        alert(`Flug-Fehler: ${msg}\nEnergie benötigt: ${data.energyNeeded ?? '?'}t\nAn Bord (Server): ${data.energyOnBoard ?? '?'}t\nSchiff-Standort (Server): ${data.shipLocation ?? '?'}`)
        console.error('travel server error:', data)
        return
      }
      // Bei Erfolg: kein weiterer State-Update nötig — Transit läuft weiter.
      // loadFromServer() wird nach Transit-Ende (location-change) aufgerufen.
      // Server hat Energie korrekt abgezogen; optimistischer State ist korrekt.
    } catch (err) {
      // Netzwerkfehler → Rollback
      set(s => ({
        inTransit:   false,
        transitFrom: null,
        transitTo:   null,
        transitTotal: 0,
        transitLeft:  0,
        cargo:       { ...s.cargo, energy: s.cargo.energy + energyNeeded },
      }))
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
