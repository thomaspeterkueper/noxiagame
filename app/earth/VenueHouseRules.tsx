'use client'

// app/earth/VenueHouseRules.tsx
// Hausregeln für den Eigentümer eines Lokals (Thomas, 28.10.2026: „Der Betreiber eines
// Lokals oder auch Ladens sollte die Möglichkeit haben, selbst Preise und
// Dienstleistungen anzupassen; standardmäßig gilt die Toilette als frei für jeden.“).
// Je Posten: eigener Preis oder der Preis der Lokalart, anbieten ja/nein. Toilette:
// für jeden, nur für Gäste, mit Gebühr oder gar nicht. Gespeichert wird über
// /api/game/hospitality/order (set_price, set_service); geprüft, dass das Haus dem
// Spieler gehört, wird in der Datenbank.

import { useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ToiletRule } from '@/lib/game/hospitality/venueServices'

export type HouseMenuItem = { itemCode: string; label: string; basePriceCredits: number; housePriceCredits: number | null; active: boolean }

type Props = { tileEntityId: string; items: readonly HouseMenuItem[]; toilet: ToiletRule; onSaved: (text: string) => void }

export default function VenueHouseRules({ tileEntityId, items, toilet, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(items.map(i => [i.itemCode, i.housePriceCredits == null ? '' : String(i.housePriceCredits)])))
  const [active, setActive] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map(i => [i.itemCode, i.active])))
  const [wc, setWc] = useState<ToiletRule>(toilet)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post(body: Record<string, unknown>) {
    const { token } = await getSessionInfo()
    const response = await fetch('/api/game/hospitality/order', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ tileEntityId, ...body }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(data.error ?? 'Nicht gespeichert.'))
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      let changed = 0
      for (const item of items) {
        const raw = (prices[item.itemCode] ?? '').trim()
        const price = raw === '' ? null : Math.round(Number(raw))
        if (price !== null && (!Number.isFinite(price) || price < 1 || price > 999)) throw new Error(`${item.label}: Preis zwischen 1 und 999 Cr – oder leer für den üblichen Preis.`)
        if (price === item.housePriceCredits && active[item.itemCode] === item.active) continue
        await post({ action: 'set_price', itemCode: item.itemCode, priceCredits: price, active: active[item.itemCode] })
        changed++
      }
      if (wc.available !== toilet.available || wc.guestsOnly !== toilet.guestsOnly || wc.priceCredits !== toilet.priceCredits) {
        if (wc.priceCredits < 0 || wc.priceCredits > 99) throw new Error('Toilette: Gebühr zwischen 0 und 99 Cr.')
        await post({ action: 'set_service', service: 'toilet', available: wc.available, guestsOnly: wc.guestsOnly, priceCredits: wc.priceCredits })
        changed++
      }
      onSaved(changed ? 'Hausregeln gespeichert – Karte und Toilette gelten ab sofort.' : 'Nichts geändert.')
      setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  if (!open) return <div className="menu house"><small>DEIN HAUS</small><button className="open-school" onClick={() => setOpen(true)}>Hausregeln: Preise, Angebot, Toilette</button></div>
  return <div className="menu house">
    <small>HAUSREGELN · KARTE</small>
    <p className="hint">Leer lassen heißt: üblicher Preis der Lokalart. Abgehakt steht der Posten auf der Karte.</p>
    {items.map(item => <label key={item.itemCode} className="rule">
      <input type="checkbox" checked={active[item.itemCode] ?? true} onChange={e => setActive(c => ({ ...c, [item.itemCode]: e.target.checked }))} />
      <span>{item.label}</span>
      <input type="number" min={1} max={999} inputMode="numeric" placeholder={String(item.basePriceCredits)} value={prices[item.itemCode] ?? ''} onChange={e => setPrices(c => ({ ...c, [item.itemCode]: e.target.value }))} aria-label={`Preis ${item.label}`} />
      <em>Cr</em>
    </label>)}
    <small>HAUSREGELN · TOILETTE</small>
    <label className="rule"><input type="checkbox" checked={wc.available} onChange={e => setWc(c => ({ ...c, available: e.target.checked }))} /><span>Toilette für Besucher</span></label>
    {wc.available && <>
      <label className="rule"><input type="checkbox" checked={wc.guestsOnly} onChange={e => setWc(c => ({ ...c, guestsOnly: e.target.checked }))} /><span>nur für Gäste mit Bestellung</span></label>
      <label className="rule"><span>Gebühr je Benutzung</span><input type="number" min={0} max={99} value={wc.priceCredits} onChange={e => setWc(c => ({ ...c, priceCredits: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} aria-label="Toilettengebühr" /><em>Cr</em></label>
    </>}
    {error && <p className="hint warn">{error}</p>}
    <div className="moves"><button disabled={busy} onClick={() => void save()}>{busy ? 'Speichert …' : 'Speichern'}</button><button disabled={busy} onClick={() => setOpen(false)}>Abbrechen</button></div>
    <style jsx>{`
      .rule{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11px;color:#cbd6d2}
      .rule span{flex:1}
      .rule input[type=number]{width:56px;background:#061012;color:#eef;border:1px solid #40595a;border-radius:4px;padding:3px 5px}
      .rule em{font-style:normal;color:#9fb5b0;font-size:10px}
    `}</style>
  </div>
}
