// app/dashboard/StationOverlay.tsx
// Erstellt:     21.06.2026
// Aktualisiert: 22.06.2026 08:50
//
// Raumstations-Ansicht für L4/L5-Stationen und Orbit-Stationen.
// Ersetzt das ColonyGrid für Orte mit location_type='station'.
//
// Aufbau:
//   - Modul-Ring: kreisförmige SVG-Anordnung der tile_entities (entity_type='module')
//   - Klick auf Modul → Details in Sidebar
//   - Bauen: neues Modul hinzufügen (Kosten in Credits)
//   - Ressourcen-Status (aus location_resources)

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

// ── Modul-Definitionen ────────────────────────────────────────────────────────

interface ModuleDef {
  label:       string
  icon:        string
  color:       string
  description: string
  produces?:   { resource: string; amount: number }
  cost:        number
  buildTicks:  number
}

const MODULE_DEFS: Record<string, ModuleDef> = {
  command_center:  { label: 'Kommandozentrum', icon: '🎯', color: '#c9a961', description: 'Koordiniert alle Stationssysteme. Pflichtmodul.', cost: 0,    buildTicks: 0 },
  solar_array:     { label: 'Solar-Array',     icon: '☀️', color: '#f5d742', description: '+8 Energie/Tick. Nutzlos im Schatten.',          produces: { resource: 'energy', amount: 8 }, cost: 1800, buildTicks: 2 },
  docking_bay:     { label: 'Andockbucht',     icon: '🚀', color: '#7c8590', description: 'Erlaubt Schiffstransfers und Ladeoperationen.',   cost: 2200, buildTicks: 3 },
  habitat_module:  { label: 'Wohnmodul',       icon: '🏠', color: '#4a7ba3', description: '+50 maximale Besatzung.',                        cost: 2000, buildTicks: 3 },
  research_lab:    { label: 'Forschungslabor', icon: '🔬', color: '#b48ce8', description: 'Wissenspunkte für die Besatzung.',                cost: 3000, buildTicks: 4 },
  water_recycler:  { label: 'Wasserrecycler',  icon: '💧', color: '#2f86c9', description: '+3 Wasser/Tick durch Kreislaufwirtschaft.',       produces: { resource: 'water', amount: 3 }, cost: 2500, buildTicks: 3 },
  storage_bay:     { label: 'Lagerbay',        icon: '📦', color: '#8a7a4a', description: '+200t Lagerkapazität für alle Ressourcen.',       cost: 1500, buildTicks: 2 },
  observatory:     { label: 'Observatorium',   icon: '🔭', color: '#7fb8de', description: 'Erweitert die Orbital-Sicht. Narrative Funktion.', cost: 2800, buildTicks: 4 },
  reactor:         { label: 'Fusionsreaktor',  icon: '⚛️',  color: '#ff6b6b', description: '+20 Energie/Tick. Fortgeschrittene Technologie.',  produces: { resource: 'energy', amount: 20 }, cost: 8000, buildTicks: 6 },
}

const BUILDABLE_MODULES = Object.entries(MODULE_DEFS)
  .filter(([id]) => id !== 'command_center')  // Command Center ist Startmodul, nicht baubar

// ── Interfaces ────────────────────────────────────────────────────────────────

interface StationModule {
  id:         string
  entity_id:  string
  slot:       number
  condition:  number
  status:     string
  is_state_owned: boolean
  profile_id: string | null
  actor_id:   string | null
}

interface LocationResource {
  resource:    string
  stock:       number
  production:  number
  consumption: number
}

interface StationOverlayProps {
  slug:              string
  name:              string
  population:        number
  populationMax:     number
  userId:            string
  locationId:        string
  locationResources: LocationResource[]
  credits:           number
  entities:          StationModule[]
  onChanged:         () => void
  onOpenWarehouse?:  () => void
  // Optionale Props von DashboardClient (werden akzeptiert aber noch nicht verwendet)
  allLocations?:     any[]
  cargo?:            any
  shipRange?:        number
  currentTick?:      number
  inTransit?:        boolean
  onTravel?:         (dest: string) => void
}

// ── Hilfen ────────────────────────────────────────────────────────────────────

const MONO = "'Courier Prime', monospace"
const DARK = '#0d1a26'
const RES_ICON: Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const RES_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }

function stockColor(stock: number, consumption: number): string {
  if (consumption === 0) return '#6fcf97'
  const ticks = stock / consumption
  if (ticks < 2)  return '#e74c3c'
  if (ticks < 5)  return '#f5d742'
  return '#6fcf97'
}

// ── Modul-SVG-Ring ────────────────────────────────────────────────────────────

function ModuleRing({
  modules, selected, onSelect, userId, onOpenWarehouse
}: {
  modules:          StationModule[]
  selected:         string | null
  onSelect:         (id: string) => void
  userId:           string
  onOpenWarehouse?: () => void
}) {
  const W = 440, H = 380
  const CX = W / 2, CY = H / 2
  const R_OUTER = 140, R_INNER = 55

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Sterne */}
      {[...Array(24)].map((_, i) => {
        const s = (i * 6577 + 1234) % 10000
        return <circle key={i}
          cx={(s % W).toFixed(1)} cy={((s * 3) % H).toFixed(1)}
          r={(0.5 + (s % 10) / 20).toFixed(2)}
          fill="#aab8cc" opacity={(0.1 + (s % 5) / 15).toFixed(2)} />
      })}

      {/* Verbindungslinien Kern ↔ Module */}
      {modules.map((m, i) => {
        const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2
        const mx = CX + Math.cos(angle) * R_OUTER
        const my = CY + Math.sin(angle) * R_OUTER
        const ix = CX + Math.cos(angle) * R_INNER
        const iy = CY + Math.sin(angle) * R_INNER
        return <line key={m.id}
          x1={ix.toFixed(1)} y1={iy.toFixed(1)}
          x2={mx.toFixed(1)} y2={my.toFixed(1)}
          stroke="#1a2a3a" strokeWidth="1.5" />
      })}

      {/* Kern */}
      <circle cx={CX} cy={CY} r={R_INNER + 8} fill="#0a1520" stroke="#2a4e7a" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R_INNER}     fill="#0d1a26" stroke="#c9a961" strokeWidth="1.5" />
      <text x={CX} y={CY - 6}  textAnchor="middle" fill="#c9a961" fontSize="9" fontFamily={MONO} fontWeight="700">PROMETHEUS</text>
      <text x={CX} y={CY + 8}  textAnchor="middle" fill="#5a7a9a" fontSize="7" fontFamily={MONO}>L5 · STATION</text>

      {/* Module */}
      {modules.map((m, i) => {
        const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2
        const mx = CX + Math.cos(angle) * R_OUTER
        const my = CY + Math.sin(angle) * R_OUTER
        const def = MODULE_DEFS[m.entity_id]
        const isSelected = selected === m.id
        const isOwn = m.profile_id === userId
        const color = def?.color ?? '#5a7a9a'
        const inactive = m.status !== 'active' || m.condition < 20

        return (
          <g key={m.id} onClick={() => { if (m.entity_id === 'warehouse') { onOpenWarehouse?.(); return } onSelect(m.id) }} style={{ cursor: 'pointer' }}>
            {/* Glow */}
            {isSelected && <circle cx={mx} cy={my} r="26" fill={color} opacity="0.12" />}
            {/* Ring */}
            <circle cx={mx} cy={my} r="22"
              fill={inactive ? '#0a1520' : '#0d1a26'}
              stroke={isSelected ? color : isOwn ? '#c9a961' : m.is_state_owned ? '#5aaeff' : '#2a4e7a'}
              strokeWidth={isSelected ? 2.5 : 1.5}
              opacity={inactive ? 0.5 : 1} />
            {/* Icon */}
            <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="14" style={{ userSelect: 'none' }}>
              {inactive ? '⚠️' : (def?.icon ?? '⬡')}
            </text>
            {/* Condition-Arc */}
            {m.condition < 100 && (() => {
              const pct = m.condition / 100
              const r = 24
              const startAngle = -Math.PI / 2
              const endAngle = startAngle + pct * Math.PI * 2
              const x1 = mx + Math.cos(startAngle) * r
              const y1 = my + Math.sin(startAngle) * r
              const x2 = mx + Math.cos(endAngle) * r
              const y2 = my + Math.sin(endAngle) * r
              const large = pct > 0.5 ? 1 : 0
              return <path
                d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                fill="none"
                stroke={m.condition > 50 ? '#6fcf97' : m.condition > 25 ? '#f5d742' : '#e74c3c'}
                strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            })()}
            {/* Label */}
            <text x={mx} y={my + 32} textAnchor="middle"
              fill={isSelected ? '#c9a961' : '#5a7a9a'} fontSize="7" fontFamily={MONO}>
              {def?.label.split(' ')[0] ?? m.entity_id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Modul-Detail-Sidebar ──────────────────────────────────────────────────────

function ModuleDetail({
  module, userId, onClose, credits, onSell
}: {
  module:   StationModule
  userId:   string
  onClose:  () => void
  credits:  number
  onSell:   (id: string) => void
}) {
  const def = MODULE_DEFS[module.entity_id]
  const isOwn = module.profile_id === userId
  const isState = module.is_state_owned
  const condColor = module.condition > 60 ? '#6fcf97' : module.condition > 30 ? '#f5d742' : '#e74c3c'

  return (
    <div style={{ fontSize: '0.78rem', color: '#a0b8d0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{def?.icon ?? '⬡'}</div>
          <div style={{ fontWeight: 700, color: def?.color ?? '#c9a961', fontSize: '0.85rem' }}>{def?.label ?? module.entity_id}</div>
          <div style={{ fontSize: '0.65rem', color: '#5a7a9a', marginTop: '2px' }}>
            {isState ? '🔵 Station' : isOwn ? '🔑 Dein Modul' : '👤 Anderes'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: '#5a7a9a', fontSize: '0.7rem' }}>✕</button>
      </div>

      <div style={{ marginBottom: '0.75rem', fontSize: '0.73rem', lineHeight: 1.6, color: '#8a9ab0' }}>
        {def?.description}
      </div>

      {/* Zustand */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#5a7a9a', marginBottom: '4px' }}>
          <span>Zustand</span><span style={{ color: condColor }}>{module.condition}%</span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${module.condition}%`, height: '100%', background: condColor, borderRadius: '3px', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '0.6rem', color: '#3a5a7a', marginTop: '3px' }}>
          Status: {module.status === 'active' ? '🟢 Aktiv' : module.status === 'damaged' ? '🟡 Beschädigt' : '🔴 Deaktiviert'}
        </div>
      </div>

      {/* Produktion */}
      {def?.produces && (
        <div style={{ background: 'rgba(47,158,68,0.06)', border: '1px solid rgba(47,158,68,0.15)', borderRadius: '6px', padding: '0.5rem 0.7rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#5a7a9a', marginBottom: '2px' }}>Produktion</div>
          <div style={{ color: '#6fcf97', fontWeight: 600 }}>
            +{def.produces.amount} {RES_ICON[def.produces.resource]} {RES_LABEL[def.produces.resource]}/Tick
          </div>
        </div>
      )}

      {/* Verkaufen (eigene nicht-staatliche Module) */}
      {isOwn && !isState && module.entity_id !== 'command_center' && (
        <button onClick={() => onSell(module.id)}
          style={{ width: '100%', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px', padding: '0.5rem', color: '#e74c3c', fontSize: '0.7rem', cursor: 'pointer', fontFamily: MONO }}>
          Modul abkoppeln
        </button>
      )}
    </div>
  )
}

// ── Bau-Popup ─────────────────────────────────────────────────────────────────

function BuildModulePopup({
  locationId, credits, onClose, onBuilt
}: {
  locationId: string
  credits:    number
  onClose:    () => void
  onBuilt:    () => void
}) {
  const [building, setBuilding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function build(entityId: string) {
    setBuilding(true); setMsg(null)
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const jwt = session?.access_token ?? ''
    const res = await fetch(
      `/api/game/build?action=start&buildableId=${entityId}&location=prometheus&tileRow=0&tileCol=0&tileLevel=0&entityType=module`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    const data = await res.json()
    setBuilding(false)
    if (data.error) { setMsg(data.error); return }
    onBuilt()
    onClose()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,20,32,0.97)', borderRadius: '12px', padding: '1rem', overflowY: 'auto' as const }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ color: '#c9a961', fontWeight: 700, fontSize: '0.85rem', fontFamily: MONO }}>⚙️ Modul andocken</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>
      {msg && <div style={{ color: '#e74c3c', fontSize: '0.7rem', marginBottom: '0.5rem' }}>{msg}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {BUILDABLE_MODULES.map(([id, def]) => {
          const canAfford = credits >= def.cost
          return (
            <button key={id} disabled={building || !canAfford} onClick={() => build(id)}
              style={{
                background: canAfford ? 'rgba(42,78,122,0.3)' : 'rgba(20,30,45,0.5)',
                border: `1px solid ${canAfford ? '#2a4e7a' : '#1a2a3a'}`,
                borderRadius: '8px', padding: '0.65rem 0.85rem',
                color: canAfford ? '#cdd6e0' : '#3a4a5a',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                textAlign: 'left' as const, fontFamily: MONO,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                <span>{def.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{def.label}</span>
                <span style={{ marginLeft: 'auto', color: canAfford ? '#c9a961' : '#3a4a5a', fontSize: '0.7rem' }}>{def.cost.toLocaleString('de')} Cr</span>
              </div>
              <div style={{ fontSize: '0.63rem', color: canAfford ? '#5a7a9a' : '#2a3a4a', lineHeight: 1.4 }}>
                {def.description} · {def.buildTicks} Tick(s)
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function StationOverlay({
  slug, name, population, populationMax, userId,
  locationId, locationResources, credits, entities, onChanged, onOpenWarehouse,
}: StationOverlayProps) {
  const { loadFromServer, invalidate } = useGameStore()
  const [selected, setSelected]     = useState<string | null>(null)
  const [showBuild, setShowBuild]   = useState(false)
  const [buildHover, setBuildHover] = useState(false)

  const modules = entities.filter(e => (e as any).entity_type === 'module') as StationModule[]
  const selectedModule = selected ? modules.find(m => m.id === selected) ?? null : null
  const popPct = populationMax > 0 ? Math.round((population / populationMax) * 100) : 0

  async function handleSell(entityId: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const jwt = session?.access_token ?? ''
    await fetch(`/api/game/build?action=sell&entityId=${entityId}&mode=instant`,
      { headers: { Authorization: `Bearer ${jwt}` } })
    setSelected(null)
    await loadFromServer(); invalidate('builds')
    onChanged()
  }

  return (
    <div style={{ background: DARK, borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', position: 'relative' }}>
      <style>{`@keyframes noxia-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Build-Popup */}
      {showBuild && (
        <BuildModulePopup
          locationId={locationId}
          credits={credits}
          onClose={() => setShowBuild(false)}
          onBuilt={async () => { await loadFromServer(); invalidate('builds'); onChanged() }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c9a961', textTransform: 'uppercase', letterSpacing: '3px', fontFamily: MONO }}>🛸 {name}</div>
          <div style={{ fontSize: '0.55rem', color: '#5a7a9a', marginTop: '2px', fontFamily: MONO }}>{slug.toUpperCase()} · L5-LAGRANGE · {modules.length} MODULE</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(0,0,0,0.35)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.65rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#5a7a9a', fontSize: '0.5rem', fontFamily: MONO }}>BESATZUNG</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{population.toLocaleString('de')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#5a7a9a', fontSize: '0.5rem', fontFamily: MONO }}>KAPAZITÄT</div>
            <div style={{ color: popPct > 80 ? '#e8702a' : '#6fcf97', fontWeight: 700 }}>{popPct}%</div>
          </div>
        </div>
      </div>

      {/* Grid: Ring + Sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Modul-Ring */}
        <div style={{ flex: 1, background: '#07101a', borderRadius: '8px', border: '1px solid #1a2a3a', position: 'relative', overflow: 'hidden' }}>
          {modules.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#3a5a7a', fontFamily: MONO, fontSize: '0.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.4 }}>🛸</div>
              Keine Module vorhanden
            </div>
          ) : (
            <ModuleRing modules={modules} selected={selected} onSelect={setSelected} userId={userId} onOpenWarehouse={onOpenWarehouse} />
          )}

          {/* Bau-Button */}
          <button
            onClick={() => setShowBuild(true)}
            onMouseEnter={() => setBuildHover(true)}
            onMouseLeave={() => setBuildHover(false)}
            style={{
              position: 'absolute', bottom: '0.75rem', right: '0.75rem',
              background: buildHover ? 'linear-gradient(135deg, #3a5e8a, #2a4a6a)' : 'linear-gradient(135deg, #2a4e7a, #1a3a5a)',
              color: '#fff', border: 'none', padding: '0.5rem 0.9rem',
              borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: MONO,
              boxShadow: buildHover ? '0 4px 12px rgba(42,78,122,0.45)' : '0 2px 8px rgba(42,78,122,0.3)',
              transform: buildHover ? 'translateY(-1px)' : 'none',
              transition: 'all 0.2s',
            }}>
            ⚙️ Modul andocken
          </button>
        </div>

        {/* Sidebar */}
        <div style={{ width: '200px', flexShrink: 0, background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.85rem', minHeight: '200px', fontFamily: MONO }}>
          {selectedModule ? (
            <ModuleDetail
              module={selectedModule}
              userId={userId}
              onClose={() => setSelected(null)}
              credits={credits}
              onSell={handleSell}
            />
          ) : (
            <>
              {/* Ressourcen-Status */}
              <div style={{ fontSize: '0.6rem', color: '#3a5a7a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem' }}>
                Ressourcen
              </div>
              {locationResources.map(r => (
                <div key={r.resource} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}>
                    <span style={{ color: '#8a9ab0' }}>{RES_ICON[r.resource]} {RES_LABEL[r.resource]}</span>
                    <span style={{ color: stockColor(r.stock, r.consumption), fontWeight: 600 }}>{r.stock}t</span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', height: '3px', borderRadius: '2px' }}>
                    <div style={{ width: `${Math.min(100, (r.stock / Math.max(1, r.stock + r.consumption * 10)) * 100)}%`, height: '100%', background: stockColor(r.stock, r.consumption), borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '0.75rem', fontSize: '0.6rem', color: '#3a5a7a', lineHeight: 1.6 }}>
                Modul anklicken für Details
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bevölkerungsbalken */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#3a5a7a', marginBottom: '3px', fontFamily: MONO }}>
          <span>Besatzung</span>
          <span>{population} / {populationMax} · {popPct}% Auslastung</span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.35)', height: '4px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${popPct}%`, height: '100%', background: 'linear-gradient(90deg, #c9a961, #e8b870)', transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  )
}
