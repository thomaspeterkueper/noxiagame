'use client'

// app/world-lab/LandPanel.tsx
// Tafel „Boden“ der Weltkarte (Thomas, 28.10.2026: „man sollte auch Grundstücke
// kaufen können, nicht nur Häuser“).
//   * Im Gebiet eines offenen Katasters: Flurstücke am Klickpunkt nachladen und
//     dann die Flurstückstafel öffnen (Kaufen, Bauen wie gehabt).
//   * Sonst: ein Grundstück abstecken (Größe wählen, an der Straße ausgerichtet),
//     Preis ansehen, kaufen. Es wird ein eigenes Flurstück – Bauen geht dann dort.
//   * `parentId`: ein Teilstück aus einem Flurstück der Gemeinde abstecken (Sundern:
//     ganze Flurstücke kosten Zehntausende). Auch längliche Stücke, drehbar.

import { useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { hasCadastre } from '@/lib/worldlab/alkis'
import { LAND_SHAPES } from '@/lib/worldlab/landPlot'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { WorldEngine } from './worldEngine'

type LandOffer = { available: boolean; reason?: string; ring: GeoPoint[]; areaM2: number; usage: string; price?: number; seller?: string; place?: string | null; parent?: { id: string; label: string | null } }
type Opened = { kind: 'parcel'; id: string; at: GeoPoint }

const credits = (value: number) => Math.round(value).toLocaleString('de-DE') + ' Cr'

/**
 * Wartet, bis das Flurstück am Punkt in den Kacheln steht (nach Neuladen).
 * Erst wenn die Kachel dort fertig ist und trotzdem kein Flurstück hat, gilt
 * „keins“ – das Neuladen kann nach frischen Kartendaten eine Minute dauern
 * (03.11.2026: nach 10 s stand fälschlich „kein Flurstück“ da).
 */
async function waitForParcel(engine: WorldEngine, at: GeoPoint, isStale: () => boolean, maxMs = 90_000) {
  const start = Date.now()
  let readySince: number | null = null
  while (!isStale() && Date.now() - start < maxMs) {
    const id = engine.parcelIdAt(at)
    if (id) return id
    if (engine.tileReadyAt(at)) { readySince ??= Date.now(); if (Date.now() - readySince > 1500) return null }
    else readySince = null
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  return null
}

export default function LandPanel({ engine, at, parentId, close, open, onParcelsChanged, onWorldChanged }: {
  engine: WorldEngine | null
  at: GeoPoint
  /** Teilstück aus diesem Flurstück abstecken */
  parentId?: string
  close: () => void
  open: (panel: Opened) => void
  onParcelsChanged?: () => void
  onWorldChanged: () => void
}) {
  // Kataster ohne Teilstück: erst das Flurstück an der Stelle finden
  const cadastre = hasCadastre(at) && !parentId
  const [note, setNote] = useState<string | null>(null)
  const [shape, setShape] = useState(parentId ? 4 : 1)
  const [turned, setTurned] = useState(false)
  const w = turned ? LAND_SHAPES[shape].d : LAND_SHAPES[shape].w, d = turned ? LAND_SHAPES[shape].w : LAND_SHAPES[shape].d
  const [offer, setOffer] = useState<LandOffer | null | undefined>(undefined)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')
  const rotation = useRef<number | null>(null)
  if (rotation.current === null) rotation.current = engine?.roadAngleAt(at) ?? 0

  // Kataster: Flurstücke am Klickpunkt holen, dann die Flurstückstafel öffnen.
  useEffect(() => {
    if (!cadastre || !engine) return
    let stale = false
    setNote('Flurstücke werden geladen … (nach frischen Kartendaten kann das bis zu einer Minute dauern)')
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
        const id = await waitForParcel(engine, at, () => stale)
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
        const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lon), w: String(w), d: String(d), rot: String(rotation.current ?? 0) })
        if (parentId) params.set('parent', parentId)
        const response = await fetch('/api/game/land-offer?' + params, { cache: 'no-store' })
        const json = response.ok ? await response.json().catch(() => null) as LandOffer | null : null
        if (!stale) setOffer(json && Array.isArray(json.ring) ? json : null)
      } catch { if (!stale) setOffer(null) }
    })()
    return () => { stale = true }
  }, [cadastre, w, d, parentId, at.lat, at.lon])

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
      const response = await fetch('/api/game/land-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: at.lat, lon: at.lon, w, d, rotation: rotation.current ?? 0, price: offer.price, parentId }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setError(String(json.error ?? 'Kauf nicht möglich.')); if (json.price) setOffer({ ...offer, price: Number(json.price) }); return }
      onParcelsChanged?.()
      onWorldChanged()
      const id = await waitForParcel(engine, at, () => false)
      if (id) open({ kind: 'parcel', id, at })
      else setError('Gekauft. Die Grenze erscheint gleich auf der Karte – dann das Grundstück anklicken, um zu bauen.')
    } catch { setError('Kauf derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  return <>
    <div className="head"><div><small>{cadastre ? 'FLURSTÜCK' : parentId ? 'TEILSTÜCK' : 'FREIES LAND'}</small><b>{cadastre ? 'Boden' : parentId ? (offer?.parent?.label ?? 'Teilstück abstecken') : 'Grundstück abstecken'}</b>{!cadastre && offer && <span>{w} × {d} m · {offer.areaM2.toLocaleString('de-DE')} m² · {offer.usage}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
    {cadastre && <p>{note ?? 'Flurstücke werden geladen …'}</p>}
    {!cadastre && <>
      <div className="row shapes"><span>Größe</span>{LAND_SHAPES.map((item, i) => <button key={i} disabled={buying} className={i === shape ? 'on' : undefined} onClick={() => setShape(i)}>{item.w}×{item.d}</button>)}{LAND_SHAPES[shape].w !== LAND_SHAPES[shape].d && <button disabled={buying} className={turned ? 'on' : undefined} onClick={() => setTurned(value => !value)} title="Lange Seite an die Straße oder quer dazu">↻ drehen</button>}</div>
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
        {!offer.available && <p className="hint">{parentId ? 'In das Flurstück klicken, um das Stück dorthin zu verschieben, oder drehen bzw. eine andere Größe wählen.' : 'Eine andere Stelle anklicken oder die Größe ändern.'}</p>}
      </>}
      <span className="source">{parentId ? 'Das Stück wird aus dem Flurstück der Gemeinde abgesteckt; der Rest bleibt bei ihr.' : 'Hier gibt es kein offenes Kataster – das Grundstück wird im Spiel abgesteckt.'}</span>
    </>}
    {/* Eigene Stile: die der Tafel (WorldPanels, styled-jsx) gelten nur dort (03.11.2026: Kopf unformatiert) */}
    <style jsx>{`
      .head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
      .head small{display:block;font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .head b{display:block;font-size:15px}
      .head span{display:block;font-size:11px;color:#9fb5b0;margin-top:2px}
      .head button{border:0;background:none;color:#9fb5b0;font-size:18px;cursor:pointer;line-height:1}
      .hint{margin:6px 0 0;font-size:11px;color:#c9d6c2;line-height:1.4}
      .source{display:block;margin-top:8px;font-size:10px;color:#7f9792}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0 8px;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0}
      p{margin:4px 0;font-size:11.5px;line-height:1.45}
      .row{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}
      .row span{flex:1;font-size:11px;color:#9fb5b0}
      .row button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
      .row button:disabled{opacity:.5;cursor:default}
      .row button.on{outline:2px solid #d9bb6a}
      .shapes span{flex:0 0 100%}
    `}</style>
  </>
}
