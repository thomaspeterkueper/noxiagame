'use client'

import { useMemo, useState, type ComponentProps } from 'react'
import LegacyBuildingInterior from './LegacyBuildingInterior'
import { getFacilityDefinition, type FacilityInteractionDef } from '@/lib/game/facilities/catalog'

type Props = ComponentProps<typeof LegacyBuildingInterior>
type LegacyAction = NonNullable<Props['onAction']> extends (kind: infer K) => void ? K : never

const LEGACY_ACTIVE = new Set(['market', 'shipyard', 'navigation', 'ship', 'parts'])

function zoneIcon(kind: string) {
  if (kind === 'access') return '↪'
  if (kind === 'operations') return '⌁'
  if (kind === 'logistics') return '▦'
  if (kind === 'social') return '◌'
  if (kind === 'residential') return '⌂'
  if (kind === 'technical') return '⚙'
  if (kind === 'research') return '⌬'
  if (kind === 'vehicle') return '◇'
  return '·'
}

function interactionIcon(kind: string) {
  if (kind === 'navigation') return '🧭'
  if (kind === 'market') return '📦'
  if (kind === 'shipyard' || kind === 'parts') return '🛠'
  if (kind === 'ship') return '🛸'
  if (kind === 'logistics') return '🚚'
  if (kind === 'research') return '🔬'
  if (kind === 'conversation') return '💬'
  if (kind === 'life_support') return '♻'
  if (kind === 'power') return '⚡'
  return '•'
}

function InteractionButton({ interaction, onRun }: { interaction: FacilityInteractionDef; onRun: (interaction: FacilityInteractionDef) => void }) {
  const active = interaction.availability === 'active'
  return <button className={`facility-action ${active ? 'active' : 'planned'}`} type="button" disabled={!active} onClick={() => onRun(interaction)}>
    <span className="facility-action-icon">{interactionIcon(interaction.kind)}</span>
    <span><strong>{interaction.label}</strong><small>{interaction.description}</small></span>
    <em>{active ? 'Öffnen →' : 'vorbereitet'}</em>
  </button>
}

export default function FacilityInterior(props: Props) {
  const facility = useMemo(() => getFacilityDefinition(props.entity.entity_id), [props.entity.entity_id])
  const [zoneId, setZoneId] = useState(facility.zones[0]?.id ?? 'entry')
  const zone = facility.zones.find(item => item.id === zoneId) ?? facility.zones[0]
  const interactions = useMemo(() => {
    if (!zone) return []
    const ids = new Set(zone.interactionIds)
    return facility.interactions.filter(item => ids.has(item.id))
  }, [facility.interactions, zone])

  const run = (interaction: FacilityInteractionDef) => {
    if (interaction.availability !== 'active' || !props.onAction) return
    if (!LEGACY_ACTIVE.has(interaction.kind)) return
    props.onAction(interaction.kind as LegacyAction)
  }

  return <div className="facility-interior">
    <aside className="facility-zones" aria-label="Gebäudebereiche">
      <div className="facility-id"><small>FACILITY</small><strong>{facility.label}</strong><span>{facility.description}</span></div>
      <nav>
        {facility.zones.map(item => <button key={item.id} type="button" className={item.id === zone?.id ? 'selected' : ''} onClick={() => setZoneId(item.id)}>
          <i>{zoneIcon(item.kind)}</i><span><strong>{item.label}</strong><small>{item.kind}</small></span>
        </button>)}
      </nav>
    </aside>

    <main className="facility-zone">
      <header>
        <div><small>INNENRAUM · {zone?.kind?.toUpperCase()}</small><h3>{zone?.label ?? facility.label}</h3><p>{zone?.description ?? facility.description}</p></div>
        <div className="facility-status"><span>Weltobjekt</span><b>persistent</b></div>
      </header>

      <section className="facility-scene" aria-label={`${zone?.label ?? facility.label} Innenraum`}>
        <div className="facility-depth back" />
        <div className="facility-depth mid" />
        <div className="facility-floor" />
        <div className="facility-room-label"><small>BEREICH</small><strong>{zone?.label ?? facility.label}</strong><span>Dieser Bereich ist bereits als eigener Facility-Zustand adressierbar. Eine spätere begehbare Szene kann dieselbe Zone-ID übernehmen.</span></div>
      </section>

      <section className="facility-actions">
        <div className="facility-section-head"><small>INTERAKTIONSPUNKTE</small><span>{interactions.length ? `${interactions.length} in diesem Bereich` : 'noch keine direkte Aktion'}</span></div>
        {interactions.length ? interactions.map(interaction => <InteractionButton key={interaction.id} interaction={interaction} onRun={run} />) : <div className="facility-empty">Dieser Bereich ist als Ort vorhanden, hat aber noch keine eigene Systemaktion.</div>}
      </section>
    </main>

    <style jsx>{`
      .facility-interior{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:610px;background:#e9ebe5;border:1px solid #c7ccc3;border-radius:10px;overflow:hidden;color:#213943}
      .facility-zones{background:#102833;color:#eaf1ed;padding:14px;display:flex;flex-direction:column;gap:14px}.facility-id small{display:block;color:#d5b65d;font:800 9px/1.2 ui-monospace,monospace;letter-spacing:.13em}.facility-id strong{display:block;margin-top:4px;font:400 19px/1.2 Georgia,serif}.facility-id span{display:block;margin-top:5px;color:#9fb2b9;font-size:10px;line-height:1.45}.facility-zones nav{display:grid;gap:6px}.facility-zones nav button{display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:center;border:1px solid #314a54;border-radius:8px;background:#17333e;color:#dce8e8;text-align:left;padding:8px;cursor:pointer}.facility-zones nav button.selected{border-color:#c5a44b;background:#213d47;box-shadow:inset 3px 0 #c5a44b}.facility-zones nav i{font-style:normal;font-size:18px;text-align:center;color:#d5b65d}.facility-zones nav strong,.facility-zones nav small{display:block}.facility-zones nav strong{font-size:11px}.facility-zones nav small{margin-top:2px;color:#7f9aa4;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
      .facility-zone{min-width:0;padding:16px}.facility-zone>header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.facility-zone header small{color:#7b642d;font:800 9px/1.2 ui-monospace,monospace;letter-spacing:.12em}.facility-zone h3{margin:3px 0 4px;font:400 24px/1.2 Georgia,serif}.facility-zone p{margin:0;max-width:650px;color:#68777d;font-size:11px;line-height:1.5}.facility-status{border:1px solid #b7c1ba;border-radius:8px;background:#f8f8f1;padding:7px 9px;text-align:right}.facility-status span,.facility-status b{display:block}.facility-status span{font-size:8px;color:#7d8886;text-transform:uppercase}.facility-status b{font-size:10px;color:#3b6653}
      .facility-scene{position:relative;height:285px;margin-top:14px;overflow:hidden;border:1px solid #6f7f80;border-radius:10px;background:linear-gradient(180deg,#243940 0,#546367 48%,#858b85 100%);perspective:700px}.facility-depth{position:absolute;left:50%;transform:translateX(-50%);border:1px solid rgba(220,231,225,.24);background:rgba(18,36,42,.54)}.facility-depth.back{top:45px;width:46%;height:120px}.facility-depth.mid{top:22px;width:70%;height:176px;background:transparent;border-color:rgba(220,231,225,.16)}.facility-floor{position:absolute;left:8%;right:8%;bottom:-22%;height:55%;background:linear-gradient(180deg,#747c79,#454e4e);transform:rotateX(58deg);transform-origin:center top;border-top:1px solid rgba(255,255,255,.18)}.facility-room-label{position:absolute;left:18px;bottom:17px;width:min(430px,72%);padding:11px 12px;border:1px solid rgba(213,182,93,.52);border-radius:8px;background:rgba(9,24,30,.82);color:#edf3ef;backdrop-filter:blur(5px)}.facility-room-label small,.facility-room-label strong,.facility-room-label span{display:block}.facility-room-label small{color:#d5b65d;font:800 8px/1.2 ui-monospace,monospace;letter-spacing:.12em}.facility-room-label strong{margin-top:2px;font-size:15px}.facility-room-label span{margin-top:4px;color:#a8bbc0;font-size:9px;line-height:1.45}
      .facility-actions{margin-top:14px}.facility-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.facility-section-head small{color:#7b642d;font:800 9px/1.2 ui-monospace,monospace;letter-spacing:.11em}.facility-section-head span{color:#778583;font-size:9px}.facility-actions :global(.facility-action){width:100%;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center;margin-top:6px;border:1px solid #bdc7c1;border-radius:8px;background:#f8f8f1;color:#263e47;padding:9px 10px;text-align:left}.facility-actions :global(.facility-action.active){cursor:pointer}.facility-actions :global(.facility-action.active:hover){border-color:#9a7a30;background:#fffaf0}.facility-actions :global(.facility-action.planned){opacity:.62}.facility-actions :global(.facility-action-icon){font-size:20px;text-align:center}.facility-actions :global(.facility-action strong),.facility-actions :global(.facility-action small){display:block}.facility-actions :global(.facility-action strong){font-size:11px}.facility-actions :global(.facility-action small){margin-top:2px;color:#6c7c80;font-size:9px;line-height:1.35}.facility-actions :global(.facility-action em){font-style:normal;color:#7e682d;font-size:9px;font-weight:800}.facility-empty{padding:12px;border:1px dashed #b8c0ba;border-radius:8px;color:#75817f;font-size:10px;background:#f6f6ef}
      @media(max-width:760px){.facility-interior{grid-template-columns:1fr}.facility-zones{padding:10px}.facility-zones nav{grid-template-columns:repeat(2,minmax(0,1fr))}.facility-zone{padding:12px}.facility-scene{height:230px}}
    `}</style>
  </div>
}
