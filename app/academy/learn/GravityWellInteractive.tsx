'use client'

import { useMemo, useState } from 'react'
import type { SsfInteractiveParams } from '@/lib/ssfKnowledge'

function fmt(value: number, digits = 3) {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) return value.toExponential(2)
  return value.toLocaleString('de-DE', { maximumFractionDigits: digits })
}

export default function GravityWellInteractive({
  title,
  instruction,
  params,
  fallback,
}: {
  title: string
  instruction: string
  params: SsfInteractiveParams
  fallback: string
}) {
  const [bodyId, setBodyId] = useState(params.bodies[0]?.id ?? '')
  const [distance, setDistance] = useState(params.distance.default)
  const body = params.bodies.find(b => b.id === bodyId) ?? params.bodies[0]

  const values = useMemo(() => {
    if (!body) return null
    const G = params.constants.G
    const r = Math.max(body.radiusM, body.radiusM * distance)
    const surfacePotential = -G * body.massKg / body.radiusM
    const potential = -G * body.massKg / r
    const deltaPhi = potential - surfacePotential
    const work = params.testMassKg * deltaPhi
    const escapeVelocity = Math.sqrt(2 * G * body.massKg / r)
    return { r, potential, deltaPhi, work, escapeVelocity }
  }, [body, distance, params.constants.G, params.testMassKg])

  if (!body || !values) {
    return <div style={{ padding: '0.9rem', border: '1px solid #ddd6c8', borderRadius: 8 }}>{fallback}</div>
  }

  return (
    <section style={{ border: '1px solid #b8cce2', background: '#f4f8fc', borderRadius: 10, padding: '1rem', margin: '0.9rem 0' }}>
      <div style={{ color: '#1d3a5f', fontWeight: 700, fontSize: '1rem' }}>{title}</div>
      <p style={{ color: '#5b6470', lineHeight: 1.6, margin: '0.45rem 0 0.9rem' }}>{instruction}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 220px) 1fr', gap: '0.8rem 1rem', alignItems: 'center' }}>
        <label style={{ color: '#394b5f', fontWeight: 700 }}>Himmelskörper</label>
        <select value={body.id} onChange={e => setBodyId(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #b9c5d2', borderRadius: 6, background: '#fff' }}>
          {params.bodies.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
        </select>

        <label style={{ color: '#394b5f', fontWeight: 700 }}>Abstand vom Zentrum</label>
        <div>
          <input
            type="range"
            min={params.distance.min}
            max={params.distance.max}
            step={params.distance.step}
            value={distance}
            onChange={e => setDistance(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ color: '#5b6470', fontSize: '0.8rem' }}>{fmt(distance, 1)} × Körperradius · r = {fmt(values.r / 1000, 0)} km</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: '1rem' }}>
        <Metric label="Gravitationspotential Φ" value={`${fmt(values.potential)} J/kg`} />
        <Metric label="ΔΦ ab Oberfläche" value={`${fmt(values.deltaPhi)} J/kg`} />
        <Metric label={`Hubarbeit für ${fmt(params.testMassKg, 0)} kg`} value={`${fmt(values.work)} J`} />
        <Metric label="Fluchtgeschwindigkeit" value={`${fmt(values.escapeVelocity / 1000)} km/s`} />
      </div>

      <details style={{ marginTop: '0.85rem', color: '#5b6470', lineHeight: 1.6 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#2a4e7a' }}>Erklärung / Text-Fallback</summary>
        <div style={{ marginTop: 6 }}>{fallback}</div>
      </details>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d7e1eb', borderRadius: 7, padding: '0.7rem' }}>
      <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#1d3a5f', fontWeight: 700 }}>{value}</div>
    </div>
  )
}
