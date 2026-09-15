'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  WORLD_DEVELOPMENT_DRIVERS,
  type WorldDevelopmentDriverId,
  type WorldDevelopmentPolarity,
} from '@/lib/game/worldDevelopment'

type EvidenceValue = number | string | boolean

type LiveSignal = {
  driverId: WorldDevelopmentDriverId
  value: number
  sourceRef: string
  explanation: string
  evidence: Record<string, EvidenceValue>
}

type LocationSignals = {
  locationId: string
  slug: string
  name: string | null
  signals: LiveSignal[]
}

type UnresolvedSignal = {
  driverId: WorldDevelopmentDriverId
  reason: string
}

type WorldDevelopmentResponse = {
  locationSignals: LocationSignals[]
  systemSignals: LiveSignal[]
  unresolved: UnresolvedSignal[]
  boundaries?: {
    readOnly?: boolean
    persistsState?: boolean
    advancesTicks?: boolean
    grantsUnlocks?: boolean
    mutatesEconomy?: boolean
  }
}

type SignalState = 'critical' | 'constrained' | 'developing' | 'strong'

const DRIVER_BY_ID = new Map(WORLD_DEVELOPMENT_DRIVERS.map(driver => [driver.id, driver]))

const DRIVER_LABELS: Partial<Record<WorldDevelopmentDriverId, string>> = {
  water_security: 'Wassersicherheit',
  orbital_logistics: 'Orbital-Logistik',
  grid_capacity: 'Netzkapazität',
  firm_energy: 'Gesicherte Energie',
  climate_stress: 'Klimastress',
  maintenance_capacity: 'Wartungskapazität',
}

const STATE_LABELS: Record<SignalState, string> = {
  critical: 'kritisch',
  constrained: 'angespannt',
  developing: 'im Aufbau',
  strong: 'stark',
}

const EVIDENCE_LABELS: Record<string, string> = {
  stock: 'Bestand',
  production: 'Produktion',
  consumption: 'Verbrauch',
  sustainable: 'Nachhaltig',
  stockCoverageTicks: 'Bestandsreichweite',
  deficitCoverageTicks: 'Defizitreichweite',
  stationCount: 'Stationen',
  cargoPorts: 'Frachtports',
  heavyPorts: 'Heavy-Ports',
  servicePorts: 'Service-Ports',
  depotCount: 'Depots',
  onwardTransferStations: 'Transferknoten',
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function classify(value: number, polarity: WorldDevelopmentPolarity): SignalState {
  const normalized = clamp01(value)
  if (polarity === 'pressure') {
    if (normalized >= 0.75) return 'critical'
    if (normalized >= 0.5) return 'constrained'
    if (normalized >= 0.25) return 'developing'
    return 'strong'
  }
  if (normalized < 0.25) return 'critical'
  if (normalized < 0.5) return 'constrained'
  if (normalized < 0.75) return 'developing'
  return 'strong'
}

function driverLabel(id: WorldDevelopmentDriverId) {
  return DRIVER_LABELS[id] ?? DRIVER_BY_ID.get(id)?.label ?? id
}

function formatEvidence(value: EvidenceValue) {
  if (typeof value === 'boolean') return value ? 'ja' : 'nein'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return value
}

function SignalRow({ signal, scope }: { signal: LiveSignal; scope?: string }) {
  const definition = DRIVER_BY_ID.get(signal.driverId)
  const state = classify(signal.value, definition?.polarity ?? 'capacity')
  const percentage = Math.round(clamp01(signal.value) * 100)
  const evidence = Object.entries(signal.evidence ?? {})

  return (
    <article className={`wd-signal wd-${state}`}>
      <div className="wd-signal-head">
        <div>
          {scope && <small>{scope}</small>}
          <strong>{driverLabel(signal.driverId)}</strong>
        </div>
        <div className="wd-signal-score"><b>{percentage}%</b><span>{STATE_LABELS[state]}</span></div>
      </div>
      <div className="wd-meter" aria-label={`${driverLabel(signal.driverId)} ${percentage} Prozent`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p>{signal.explanation}</p>
      {evidence.length > 0 && (
        <details>
          <summary>Evidenz</summary>
          <dl>
            {evidence.map(([key, value]) => (
              <React.Fragment key={key}>
                <dt>{EVIDENCE_LABELS[key] ?? key}</dt>
                <dd>{formatEvidence(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
          <code>{signal.sourceRef}</code>
        </details>
      )}
    </article>
  )
}

export default function DashboardWorldDevelopmentOverlay() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<WorldDevelopmentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const response = await fetch('/api/game/world-development', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const next = await response.json() as WorldDevelopmentResponse
        if (!cancelled) {
          setData(next)
          setError(null)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const refresh = window.setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(refresh)
    }
  }, [open])

  const measuredCount = useMemo(() => {
    if (!data) return 0
    return data.systemSignals.length + data.locationSignals.reduce((sum, location) => sum + location.signals.length, 0)
  }, [data])

  return <>
    <style>{styles}</style>
    <button
      type="button"
      className={`noxia-world-development-toggle${open ? ' active' : ''}`}
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-controls="noxia-world-development-panel"
      title="Messbare Weltbedingungen und noch ungelöste Systemtreiber"
    >
      <span aria-hidden="true">◎</span>
      <b>Weltlage</b>
      {data && <em>{measuredCount}</em>}
    </button>

    {open && (
      <aside id="noxia-world-development-panel" className="noxia-world-development-panel" aria-label="NOXIA Weltlage">
        <header>
          <div><small>WORLD DEVELOPMENT · CORE LIVE</small><h2>Weltlage</h2></div>
          <div className="wd-head-actions">
            <span>{loading ? 'aktualisiert …' : 'read-only'}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Weltlage schließen">×</button>
          </div>
        </header>

        {error && <div className="wd-error">Live-Projektion nicht verfügbar: {error}</div>}
        {!data && loading && <div className="wd-empty">Lese aktuelle Core-Zustände …</div>}

        {data && <div className="wd-content">
          <section>
            <div className="wd-section-head"><strong>System</strong><span>{data.systemSignals.length} gemessen</span></div>
            {data.systemSignals.length > 0
              ? data.systemSignals.map(signal => <SignalRow key={`system-${signal.driverId}`} signal={signal} scope="Sonnensystem" />)
              : <div className="wd-empty">Noch kein belastbares systemweites Signal.</div>}
          </section>

          <section>
            <div className="wd-section-head"><strong>Siedlungen</strong><span>{data.locationSignals.length} mit Messwerten</span></div>
            {data.locationSignals.length > 0
              ? data.locationSignals.flatMap(location => location.signals.map(signal => (
                <SignalRow
                  key={`${location.locationId}-${signal.driverId}`}
                  signal={signal}
                  scope={location.name || location.slug}
                />
              )))
              : <div className="wd-empty">Keine aktuelle Siedlung liefert bereits einen belastbaren Makrowert.</div>}
          </section>

          <section className="wd-unresolved-section">
            <div className="wd-section-head"><strong>Nicht aufgelöst</strong><span>{data.unresolved.length} Modelllücken</span></div>
            <div className="wd-unresolved-list">
              {data.unresolved.map(item => (
                <div className="wd-unresolved" key={item.driverId}>
                  <div><span>?</span><strong>{driverLabel(item.driverId)}</strong></div>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <footer>
            <span>Projektion aus Core-Quellen</span>
            <span>keine eigene Persistenz · kein eigener Tick · keine Unlocks</span>
          </footer>
        </div>}
      </aside>
    )}
  </>
}

const styles = `
  .noxia-world-development-toggle {
    position: fixed;
    z-index: 2240;
    right: 14px;
    bottom: 76px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    border: 1px solid rgba(80,126,154,.5);
    border-radius: 8px;
    background: rgba(7,17,27,.88);
    box-shadow: 0 8px 26px rgba(0,0,0,.28);
    backdrop-filter: blur(12px);
    color: #9fc0cf;
    cursor: pointer;
    font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: .06em;
  }
  .noxia-world-development-toggle:hover,
  .noxia-world-development-toggle.active {
    border-color: rgba(79,196,240,.65);
    color: #e8f7fb;
    background: rgba(18,62,83,.9);
  }
  .noxia-world-development-toggle > span { color: #d7b96e; font-size: 15px; }
  .noxia-world-development-toggle > em {
    min-width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    padding: 0 4px;
    border-radius: 9px;
    background: rgba(79,196,240,.16);
    color: #bceaf7;
    font-style: normal;
    font-size: 9px;
  }

  .noxia-world-development-panel {
    position: fixed;
    z-index: 2260;
    right: 14px;
    bottom: 120px;
    width: min(470px, calc(100vw - 28px));
    max-height: min(68vh, 650px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid rgba(83,136,164,.52);
    border-radius: 12px;
    background: rgba(8,21,31,.95);
    box-shadow: 0 22px 64px rgba(0,0,0,.42);
    backdrop-filter: blur(18px) saturate(108%);
    color: #d5e4ea;
    font: 500 11px/1.45 system-ui, sans-serif;
    pointer-events: auto;
  }
  .noxia-world-development-panel > header {
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    box-sizing: border-box;
    border-bottom: 1px solid rgba(103,149,173,.2);
  }
  .noxia-world-development-panel header small { color: #c9a961; font: 800 8px/1 ui-monospace, monospace; letter-spacing: .14em; }
  .noxia-world-development-panel h2 { margin: 4px 0 0; color: #eff8fa; font: 500 18px/1.05 Georgia, serif; }
  .wd-head-actions { display: flex; align-items: center; gap: 8px; color: #7896a4; font: 700 8px/1 ui-monospace, monospace; text-transform: uppercase; }
  .wd-head-actions button { width: 28px; height: 28px; border: 1px solid rgba(104,150,174,.3); border-radius: 6px; background: rgba(255,255,255,.04); color: #b7ced8; cursor: pointer; font-size: 18px; }
  .wd-content { overflow: auto; padding: 10px; display: grid; gap: 12px; }
  .wd-content section { display: grid; gap: 7px; }
  .wd-section-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; color: #9eb6c1; }
  .wd-section-head strong { color: #cfe1e8; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
  .wd-section-head span { color: #657f8c; font: 700 8px/1 ui-monospace, monospace; }

  .wd-signal { padding: 9px 10px; border: 1px solid rgba(105,151,174,.2); border-radius: 8px; background: rgba(255,255,255,.025); }
  .wd-signal-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .wd-signal-head small { display: block; margin-bottom: 2px; color: #6f8b99; font-size: 8px; }
  .wd-signal-head strong { color: #dcebf0; font-size: 11px; }
  .wd-signal-score { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
  .wd-signal-score b { color: #e7f3f6; font: 800 14px/1 ui-monospace, monospace; }
  .wd-signal-score span { color: #7f9aa7; font-size: 8px; text-transform: uppercase; }
  .wd-meter { height: 4px; margin: 8px 0 7px; overflow: hidden; border-radius: 2px; background: rgba(255,255,255,.08); }
  .wd-meter span { display: block; height: 100%; border-radius: inherit; background: #6fa7bc; }
  .wd-strong .wd-meter span { background: #86b99e; }
  .wd-developing .wd-meter span { background: #c7ad69; }
  .wd-constrained .wd-meter span { background: #c88962; }
  .wd-critical .wd-meter span { background: #c66e6e; }
  .wd-signal p { margin: 0; color: #91a9b3; font-size: 9px; }
  .wd-signal details { margin-top: 7px; color: #708a97; font-size: 8px; }
  .wd-signal summary { cursor: pointer; color: #809da9; }
  .wd-signal dl { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 3px 10px; margin: 7px 0; }
  .wd-signal dt, .wd-signal dd { margin: 0; }
  .wd-signal dd { color: #b5cbd4; font-family: ui-monospace, monospace; }
  .wd-signal code { display: block; overflow-wrap: anywhere; color: #597481; font-size: 7px; }

  .wd-unresolved-section { padding-top: 2px; }
  .wd-unresolved-list { display: grid; gap: 5px; }
  .wd-unresolved { padding: 8px 9px; border: 1px dashed rgba(119,142,151,.28); border-radius: 7px; background: rgba(255,255,255,.015); }
  .wd-unresolved > div { display: flex; align-items: center; gap: 6px; }
  .wd-unresolved > div span { width: 17px; height: 17px; display: grid; place-items: center; border-radius: 50%; background: rgba(201,169,97,.12); color: #d3b76f; font: 800 10px/1 ui-monospace, monospace; }
  .wd-unresolved strong { color: #b5c9d1; font-size: 10px; }
  .wd-unresolved p { margin: 5px 0 0 23px; color: #718b97; font-size: 8px; }
  .wd-empty, .wd-error { padding: 11px; border-radius: 7px; color: #78929e; background: rgba(255,255,255,.025); font-size: 9px; }
  .wd-error { color: #d7a39c; }
  .wd-content footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px 10px; padding-top: 3px; color: #536e7a; font: 700 7px/1.4 ui-monospace, monospace; text-transform: uppercase; }

  @media (max-width: 760px) {
    .noxia-world-development-toggle { right: 8px; bottom: 68px; }
    .noxia-world-development-panel { right: 6px; bottom: 110px; width: calc(100vw - 12px); max-height: 62vh; }
  }
`
