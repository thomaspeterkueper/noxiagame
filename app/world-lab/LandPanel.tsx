'use client'

// app/world-lab/LandPanel.tsx
// Tafel „Boden“ der Weltkarte (Thomas, 28.10.2026: „man sollte auch Grundstücke
// kaufen können, nicht nur Häuser“).
//   * Im Gebiet eines offenen Katasters: Flurstücke am Klickpunkt nachladen und
//     dann die Flurstückstafel öffnen (Kaufen, Bauen wie gehabt).
//   * Sonst: ein Grundstück abstecken (Größe wählen, an der Straße ausgerichtet),
//     Preis ansehen, kaufen. Es wird ein eigenes Flurstück – Bauen geht dann dort.

import { useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { hasCadastre } from '@/lib/worldlab/alkis'
import { LAND_SIZES } from '@/lib/worldlab/landPlot'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { WorldEngine } from './worldEngine'

type LandOffer = { available: boolean; reason?: string; ring: GeoPoint[]; areaM2: number; usage: string; price?: number; seller?: string; place?: string | null }
type Opened = { kind: 'parcel'; id: string; at: GeoPoint }

const credits = (value: number) => Math.round(value).toLocaleString('de-DE') + ' Cr'

/** Wartet, bis das Flurstück am Punkt in den Kacheln steht (nach Neuladen). */
async function waitForParcel(engine: WorldEngine, at: GeoPoint, tries: number, isStale: () => boolean) {
  for (let i = 0; i < tries && !isStale(); i++) {
    const id = engine.parcelIdAt(at)
    if (id) return id
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  return null
}

export default function LandPanel({ engine, at, close, open, onParcelsChanged, onWorldChanged }: {
  engine: WorldEngine | null
  at: GeoPoint
  close: () => void
  open: (panel: Opened) => void
  onParcelsChanged?: () => void
  onWorldChanged: () => void
}) {
  const cadastre = hasCadastre(at)
  const [note, setNote] = useState<string | null>(null)
  const [size, setSize] = useState<number>(30)
  const [offer, setOffer] = useState<LandOffer | null | undefined>(undefined)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')
  const rotation = useRef<number | null>(null)
  if (rotation.current === null) rotation.current = engine?.roadAngleAt(at) ?? 0

  // Kataster: Flurstücke am Klickpunkt holen, dann die Flurstückstafel öffnen.
  useEffect(() => {
    if (!cadastre || !engine) return
    let stale = false
    setNote('Flurstücke werden geladen …')
    void (async () => {
      const ready = engine.parcelIdAt(at)
      if (ready) { open({ kind: 'parcel', id: ready, at }); return }
      try {
        const { token } = await getSessionInfo()
        if (!token) { setNote('Zum Kaufen bitte anmelden.'); return }
        const response = await fetch('/api/world-lab/parcels', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(at) })
        const json = await response.json().catch(() => null)
        if (stale) return
        if (!json?.ok) { setNote('Das Kataster ist gerade nicht erreichbar – bitte später noch einmal.'); return }
        if (!json.cached && json.parcels > 0) onParcelsChanged?.()
        const id = await waitForParcel(engine, at, 25, () => stale)
        if (stale) return
        if (id) open({ kind: 'parcel', id, at })
        else setNote('Hier liegt kein Flurstück, das man kaufen kann – meist eine Straße oder ein Gewässer.')
      } catch { if (!stale) setNote('Das Kataster ist gerade nicht erreichbar – bitte später noch einmal.') }
    })()
    return () => { stale = true }
  }, [cadastre, engine, at.lat, at.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ohne Kataster: Angebot für das abgesteckte Rechteck
  useEffect(() => {
    if (cadastre) return
    let stale = false
    setOffer(undefined); setError('')
    void (async () => {
      try {
        const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lon), w: String(size), d: String(size), rot: String(rotation.current ?? 0) })
        const response = await fetch('/api/game/land-offer?' + params, { cache: 'no-store' })
        const json = response.ok ? await response.json().catch(() => null) as LandOffer | null : null
        if (!stale) setOffer(json && Array.isArray(json.ring) ? json : null)
      } catch { if (!stale) setOffer(null) }
    })()
    return () => { stale = true }
  }, [cadastre, size, at.lat, at.lon])

  // Umriss auf der Karte
  useEffect(() => {
    engine?.setLandPreview(offer?.ring ?? null, Boolean(offer?.available))
    return () => engine?.setLandPreview(null, false)
  }, [engine, offer])

  async function buy() {
    if (!offer?.available || !offer.price || buying || !engine) return
    setBuying(true); setError('')
    try {
      const { token } = await getSessionInfo()
      if (!token) { setError('Zum Kaufen bitte anmelden.'); return }
      const response = await fetch('/api/game/land-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: at.lat, lon: at.lon, w: size, d: size, rotation: rotation.current ?? 0, price: offer.price }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setError(String(json.error ?? 'Kauf nicht möglich.')); if (json.price) setOffer({ ...offer, price: Number(json.price) }); return }
      onParcelsChanged?.()
      onWorldChanged()
      const id = await waitForParcel(engine, at, 25, () => false)
      if (id) open({ kind: 'parcel', id, at })
      else setError('Gekauft. Die Grenze erscheint gleich auf der Karte – dann das Grundstück anklicken, um zu bauen.')
    } catch { setError('Kauf derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  return <>
    <div className="head"><div><small>{cadastre ? 'FLURSTÜCK' : 'FREIES LAND'}</small><b>{cadastre ? 'Boden' : 'Grundstück abstecken'}</b>{!cadastre && offer && <span>{size} × {size} m · {offer.areaM2.toLocaleString('de-DE')} m² · {offer.usage}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
    {cadastre && <p>{note ?? 'Flurstücke werden geladen …'}</p>}
    {!cadastre && <>
      <div className="row"><span>Größe</span>{LAND_SIZES.map(side => <button key={side} disabled={buying} className={side === size ? 'on' : undefined} onClick={() => setSize(side)}>{side} m</button>)}</div>
      {offer === undefined && <p>Wird geprüft …</p>}
      {offer === null && <p>Das Angebot ist gerade nicht erreichbar.</p>}
      {offer && <>
        <dl>
          {offer.available && <><dt>Verkäufer</dt><dd>{offer.seller ?? 'Gemeinde'}</dd></>}
          {offer.available && <><dt>Preis</dt><dd><b>{credits(offer.price ?? 0)}</b></dd></>}
        </dl>
        {offer.available
          ? <div className="row"><span>{error || 'Wird dein Grundstück: bauen, teilen, weiterverkaufen.'}</span><button disabled={buying} onClick={() => void buy()}>{buying ? '…' : 'Kaufen'}</button></div>
          : <div className="row"><span>{offer.reason ?? 'Hier kann man kein Land kaufen.'}</span></div>}
        {!offer.available && <p className="hint">Eine andere Stelle anklicken oder die Größe ändern.</p>}
      </>}
      <span className="source">Hier gibt es kein offenes Kataster – das Grundstück wird im Spiel abgesteckt.</span>
    </>}
  </>
}
