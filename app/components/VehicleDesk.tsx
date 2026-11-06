'use client'

// app/components/VehicleDesk.tsx
// Aktualisiert: 06.11.2026 — Fahrzeuge auf der Erde: Kauf im Autohaus, Reparatur in der Werkstatt, Laden; „Hinfahren“ zu fernen Zielen
// Version:      1.0.0
//
// Drei Teile, ein Zustand:
//  useVehicle()  – eigenes Fahrzeug und Guthaben, von allen Tafeln geteilt (ein Speicher je Seite).
//  VehicleDesk   – Tresen im Betrieb: Leistungen aus lib/game/business/establishments.ts
//                  (car-buy, car-repair, car-charge) werden hier wirklich gebucht (/api/game/vehicle).
//  DriveButton   – „Hinfahren“: Fahrt buchen, dann springt die Figur ans Ziel (engine.jump).

import { useCallback, useState, useSyncExternalStore } from 'react'
import { getToken } from '@/lib/supabase/auth'
import type { GeoPoint } from '@/lib/game/earthTrips'
import { canDrive, driveDistanceM, driveLabel, DRIVE_FROM_M, type Vehicle, type VehicleModel } from '@/lib/game/earthVehicles'

type State = { vehicle: Vehicle | null; credits: number; models: VehicleModel[]; loaded: boolean }

// Ein Speicher je Seite, damit Tresen, Tafel und Kopfzeile dasselbe Fahrzeug sehen.
let store: State = { vehicle: null, credits: 0, models: [], loaded: false }
const listeners = new Set<(state: State) => void>()
function publish(next: Partial<State>) {
  store = { ...store, ...next }
  listeners.forEach(listener => listener(store))
}

async function api(method: 'GET' | 'POST', body?: Record<string, unknown>) {
  const token = await getToken()
  const response = await fetch('/api/game/vehicle', { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  const json = await response.json().catch(() => null)
  if (!response.ok) throw new Error(json?.error ?? 'Das hat gerade nicht geklappt.')
  return json
}

export async function reloadVehicle() {
  try {
    const json = await api('GET')
    publish({ vehicle: json.vehicle ?? null, credits: Number(json.credits ?? 0), models: json.models ?? [], loaded: true })
  } catch { publish({ loaded: true }) }
}

export function useVehicle() {
  return useSyncExternalStore(subscribe, () => store, () => store)
}
function subscribe(listener: (state: State) => void) {
  listeners.add(listener)
  if (!store.loaded && !loading) { loading = true; void reloadVehicle().finally(() => { loading = false }) }
  return () => { listeners.delete(listener) }
}
let loading = false

const SERVICE_ACTION: Record<string, 'buy' | 'repair' | 'charge'> = { 'car-buy': 'buy', 'car-repair': 'repair', 'car-charge': 'charge' }

/** Welche Leistungen des Betriebs der Tresen übernimmt. */
export function vehicleServiceIds(services: Array<{ id: string; available: boolean }>): string[] {
  return services.filter(service => service.available && SERVICE_ACTION[service.id]).map(service => service.id)
}

export function VehicleDesk({ services, staffName }: { services: string[]; staffName: string }) {
  const { vehicle, credits, models, loaded } = useVehicle()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const run = useCallback(async (action: 'buy' | 'repair' | 'charge', modelCode?: string) => {
    setBusy(action + (modelCode ?? '')); setNote('')
    try {
      const json = await api('POST', { action, modelCode, requestId: crypto.randomUUID() })
      publish({ vehicle: json.vehicle ?? store.vehicle, credits: Number(json.credits ?? store.credits) })
      const price = Number(json.priceCredits ?? 0)
      setNote(action === 'buy' ? `${staffName}: „Viel Freude mit dem ${json.vehicle?.modelLabel ?? 'Wagen'}. Er steht draußen.“ (${price.toLocaleString('de-DE')} Cr)`
        : action === 'repair' ? (price > 0 ? `${staffName}: „Alles wieder in Ordnung.“ (${price} Cr)` : `${staffName}: „Da ist nichts zu machen – der Wagen ist tipptopp.“`)
        : price > 0 ? `${staffName}: „Voll geladen.“ (${price} Cr)` : `${staffName}: „Der Akku ist schon voll.“`)
    } catch (error) { setNote(String((error as Error).message)) } finally { setBusy(null) }
  }, [staffName])

  if (!loaded) return <p className="vd-note">…</p>
  const repairPrice = vehicle ? (100 - vehicle.conditionPct) * 6 : 0
  const chargePrice = vehicle ? 100 - vehicle.chargePct : 0
  return <div className="vdesk">
    {vehicle
      ? <p className="vd-note">Dein {vehicle.modelLabel}: Zustand {vehicle.conditionPct} %, Akku {vehicle.chargePct} %, {Math.round(vehicle.odometerM / 1000).toLocaleString('de-DE')} km.</p>
      : <p className="vd-note">Du hast noch kein Fahrzeug. Guthaben {credits.toLocaleString('de-DE')} Cr.</p>}
    {services.includes('car-buy') && !vehicle && <ul>
      {models.map(model => <li key={model.code}><span>{model.label}</span><button disabled={Boolean(busy) || credits < model.priceCredits} title={credits < model.priceCredits ? 'Nicht genug Credits' : undefined} onClick={() => void run('buy', model.code)}>{busy === 'buy' + model.code ? '…' : `${model.priceCredits.toLocaleString('de-DE')} Cr`}</button></li>)}
    </ul>}
    {services.includes('car-buy') && vehicle && <p className="vd-note">{staffName}: „Ein zweites verkaufen wir dir nicht – fahr erst mal das eine.“</p>}
    {vehicle && <div className="vd-row">
      {services.includes('car-repair') && <button disabled={Boolean(busy) || credits < repairPrice} onClick={() => void run('repair')}>{busy === 'repair' ? '…' : repairPrice > 0 ? `Reparieren · ${repairPrice} Cr` : 'Reparieren · nichts nötig'}</button>}
      {services.includes('car-charge') && <button disabled={Boolean(busy) || credits < chargePrice} onClick={() => void run('charge')}>{busy === 'charge' ? '…' : chargePrice > 0 ? `Laden · ${chargePrice} Cr` : 'Laden · Akku voll'}</button>}
    </div>}
    {note && <p className="vd-note vd-say">{note}</p>}
    <style jsx>{`
      .vdesk{display:grid;gap:5px;padding:4px 0}
      .vd-note{margin:0;font-size:11px;color:#b7c7cd;line-height:1.45}
      .vd-say{color:#f3e2b0}
      ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
      li,.vd-row{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px}
      .vd-row{justify-content:flex-start;flex-wrap:wrap}
      button{border:1px solid #9b8545;border-radius:6px;background:#2a2413;color:#f3e2b0;padding:4px 8px;cursor:pointer;font-size:11px;white-space:nowrap}
      button:disabled{opacity:.5;cursor:default}
    `}</style>
  </div>
}

/**
 * „Hinfahren“ – nur bei vorhandenem Fahrzeug und ab DRIVE_FROM_M. Die Fahrt
 * bucht der Server (Akku, Verschleiß, Standort), dann ruft onArrived die
 * Weltkarte, die die Figur ans Ziel setzt.
 */
export function DriveButton({ from, to, onArrived }: { from: () => GeoPoint | null; to: GeoPoint; onArrived: (at: GeoPoint, note: string) => void }) {
  const { vehicle } = useVehicle()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const start = from()
  if (!vehicle || !start) return null
  const distanceM = driveDistanceM(start, to)
  if (distanceM < DRIVE_FROM_M) return null
  const check = canDrive(vehicle, distanceM)
  const drive = async () => {
    setBusy(true); setError('')
    try {
      const json = await api('POST', { action: 'drive', from: start, to })
      publish({ vehicle: json.vehicle ?? store.vehicle })
      onArrived(to, `Angekommen – ${driveLabel(Number(json.distanceM ?? distanceM))}. Akku jetzt ${json.vehicle?.chargePct ?? '?'} %.`)
    } catch (err) { setError(String((err as Error).message)) } finally { setBusy(false) }
  }
  return <div className="drive">
    <span>{vehicle.modelLabel.replace(/ \(.*\)$/, '')}: {driveLabel(distanceM)}{!check.ok ? ` – ${check.why}` : ''}</span>
    <button disabled={busy || !check.ok} onClick={() => void drive()}>{busy ? 'Fahre …' : 'Hinfahren'}</button>
    {error && <small>{error}</small>}
    <style jsx>{`
      .drive{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:#b7c7cd}
      button{border:1px solid #9b8545;border-radius:6px;background:#2a2413;color:#f3e2b0;padding:4px 8px;cursor:pointer;font-size:11px}
      button:disabled{opacity:.5;cursor:default}
      small{flex-basis:100%;color:#e6a3a3}
    `}</style>
  </div>
}
