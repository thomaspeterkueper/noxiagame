'use client'
// Zeitregler der Weltkarte (Issue #541): zeigt abgerissene Gebäude zu einem früheren Zeitpunkt wieder.
// Nur Abrisse mit Beleg (Grabstein mit Datum) lassen sich zurückspielen; Neubauten bleiben, wie sie sind.

import { SLIDER_DAY_MS as DAY_MS, timeSliderRange } from '@/lib/worldlab/timeSliderRange'
import type { WorldPlot } from './worldEngine'

export default function TimeSlider({ plots, asOf, onChange }: { plots: readonly WorldPlot[]; asOf: string | null; onChange: (iso: string | null) => void }) {
  const range = timeSliderRange(plots)
  if (!range) return null
  const value = asOf ? Date.parse(asOf) : range.max
  const label = asOf ? new Date(asOf).toLocaleDateString('de-DE') : 'jetzt'
  return <div className="time-slider" role="group" aria-label="Zeitregler">
    <span>Zeit</span>
    <input type="range" min={range.min} max={range.max} step={DAY_MS / 24} value={value} aria-label="Zeitpunkt wählen"
      onChange={event => { const next = Number(event.target.value); onChange(next >= range.max - DAY_MS / 24 ? null : new Date(next).toISOString()) }}/>
    <b>{label}</b>
    {asOf && <button type="button" onClick={() => onChange(null)}>Jetzt</button>}
    <style jsx>{`
      .time-slider{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;width:min(420px,calc(100% - 28px));box-sizing:border-box;padding:7px 12px;background:#0d1c22ee;border:1px solid #40595a;border-radius:8px;color:#eef2ed;font:11px system-ui;z-index:6}
      .time-slider span{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .time-slider input{flex:1;min-width:0}
      .time-slider b{min-width:62px;text-align:right;font-variant-numeric:tabular-nums}
      .time-slider button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer}
    `}</style>
  </div>
}
