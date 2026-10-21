'use client'

import { useMemo, useState } from 'react'

type Edge = { from: string; to: string; relation: string }
type Props = { sourceEntityIds: string[]; edges: Edge[]; status: string }

const W = 640, H = 350
const short = (value: string) => value.length > 25 ? value.slice(0, 22) + '…' : value

/** Edges are supplied by KG; this component never infers relationships. */
export default function AcademyKnowledgeGraph({ sourceEntityIds, edges, status }: Props) {
  const [focus, setFocus] = useState<string | null>(null)
  const graph = useMemo(() => {
    const sources = new Set(sourceEntityIds.filter(Boolean))
    const uniqueEdges: Edge[] = []
    const keys = new Set<string>()
    for (const edge of edges) {
      if (!edge || !edge.from || !edge.to || !edge.relation) continue
      const key = [edge.from, edge.to, edge.relation].join('|')
      if (!keys.has(key)) { keys.add(key); uniqueEdges.push(edge) }
    }
    const names = [...new Set([...sources, ...uniqueEdges.flatMap(e => [e.from, e.to])])].slice(0, 14)
    const selected = new Set(names)
    const filtered = uniqueEdges.filter(e => selected.has(e.from) && selected.has(e.to))
    const positions = new Map(names.map((id, i) => {
      const angle = (i * 2 * Math.PI / Math.max(names.length, 1)) - Math.PI / 2
      return [id, { x: W / 2 + 235 * Math.cos(angle), y: H / 2 + 115 * Math.sin(angle) }] as const
    }))
    return { sources, nodes: names, edges: filtered, positions }
  }, [sourceEntityIds, edges])
  const focusedEdges = focus ? graph.edges.filter(e => e.from === focus || e.to === focus) : graph.edges

  return <section aria-label="Wissensgraph aus verifizierten KG-Beziehungen" style={{ marginTop: 15, padding: 12, background: '#fff', border: '1px solid #d8dedf', borderRadius: 12 }}>
    <h4 style={{ margin: '0 0 5px', color: '#2a4e7a' }}>KG-Wissensnetz</h4>
    <p style={{ margin: '0 0 12px', color: '#625f59', fontSize: 12, lineHeight: 1.5 }}>
      Gold umrandet: Quellen des Lernmoduls. Linien: tatsächliche Beziehungen aus dem KG. Knoten auswählen, um die zugehörigen Relationen zu sehen.
    </p>
    {!graph.nodes.length ? <p style={{ color: '#625f59', fontSize: 12 }}>Keine referenzierten KG-Entitäten vorhanden.</p> : <>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${graph.nodes.length} Wissensknoten mit ${graph.edges.length} geprüften Relationen`} style={{ width: '100%', minWidth: 310, height: 'auto', background: '#f7f9fa', borderRadius: 9 }}>
          {graph.edges.map((edge, i) => {
            const from = graph.positions.get(edge.from)!, to = graph.positions.get(edge.to)!
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={focus && (edge.from === focus || edge.to === focus) ? '#356b9e' : '#9db2bc'} strokeWidth={focus && (edge.from === focus || edge.to === focus) ? 2.7 : 1.6} opacity={focus && edge.from !== focus && edge.to !== focus ? 0.3 : 1}/>
          })}
          {graph.nodes.map(id => {
            const { x, y } = graph.positions.get(id)!
            const source = graph.sources.has(id)
            return <g key={id} opacity={focus && focus !== id && !focusedEdges.some(e => e.from === id || e.to === id) ? 0.5 : 1}>
              <circle cx={x} cy={y} r={focus === id ? 28 : 24} stroke={source ? '#a17c27' : '#5d8aa0'} strokeWidth={focus === id ? 3.5 : 2.2} fill={source ? '#faf0d9' : '#e8f1f5'}/>
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#284356">{source ? 'Quelle' : 'KG'}</text>
              <text x={x} y={y + 40} textAnchor="middle" fontSize="9" fill="#284356">{short(id)}</text>
            </g>
          })}
        </svg>
      </div>
      <div role="group" aria-label="Wissensknoten auswählen" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {graph.nodes.map(id => <button key={id} onClick={() => setFocus(focus === id ? null : id)} aria-pressed={focus === id} style={{ fontSize: 11, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', border: '1px solid ' + (focus === id ? '#2a4e7a' : '#cbd5d9'), background: focus === id ? '#e6eff8' : '#fff', color: '#243d53' }}>{id}</button>)}
      </div>
      {focusedEdges.length > 0 ? <ul style={{ paddingLeft: 18, marginBottom: 2, color: '#34495a', fontSize: 12 }}>
        {focusedEdges.map((e, i) => <li key={i} style={{ marginBottom: 5, overflowWrap: 'anywhere' }}>{e.from} → <strong>{e.relation}</strong> → {e.to}</li>)}
      </ul> : <p style={{ color: '#625f59', fontSize: 12 }}>{status === 'loading' ? 'Lade KG-Relationen …' : 'Zu dieser Auswahl liegen keine bestätigten Beziehungen vor.'}</p>}
    </>}
    <small style={{ color: '#625f59' }}>Darstellung auf bis zu 14 Entitäten begrenzt. Die Anordnung ist rein visuell und behauptet keine zusätzlichen Beziehungen.</small>
  </section>
}
