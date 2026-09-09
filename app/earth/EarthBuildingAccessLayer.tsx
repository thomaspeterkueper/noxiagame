'use client'

import { useEffect, useState, type ReactNode } from 'react'
import SchoolOverlay from '@/app/dashboard/SchoolOverlay'
import WarehouseOverlay from '@/app/dashboard/WarehouseOverlay'
import LandingOverlay from '@/app/dashboard/LandingOverlay'
import SpaceportOverlay from '@/app/dashboard/SpaceportOverlay'
import AdminOverlay from '@/app/dashboard/AdminOverlay'
import BankOverlay from '@/app/dashboard/BankOverlay'
import { getToken } from '@/lib/supabase/auth'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import type { BuildingEntryRequest } from '@/lib/game/buildings/entry'

type ResourceRow = { resource: string; stock: number; consumption: number; production: number }
type AccessData = {
  location?: {
    slug: string
    name: string
    population: number
    population_max: number
    location_resources?: ResourceRow[]
  }
  prices?: any[]
  orders?: any[]
  locations?: { slug: string; name: string; population: number }[]
  tickNumber?: number
  error?: string
}

type SpaceportMode = 'hub' | 'navigation' | 'maintenance' | 'cargo'

function FacilityPanel({
  eyebrow,
  title,
  copy,
  children,
  onClose,
}: {
  eyebrow: string
  title: string
  copy?: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(2,7,12,.86)', display: 'grid', placeItems: 'center', padding: 20 }}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div style={{ width: 'min(640px,94vw)', maxHeight: '86vh', overflow: 'auto', background: '#eef1ed', border: '1px solid #78919a', borderRadius: 12, color: '#1b3540', boxShadow: '0 18px 60px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '14px 16px', background: '#102b38', color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 18 }}>
          <div>
            <small style={{ color: '#d8bd68', fontWeight: 900, letterSpacing: '.08em' }}>{eyebrow}</small>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 16 }}>{title}</strong>
            {copy && <p style={{ margin: '5px 0 0', maxWidth: 500, color: '#c3d0d0', fontSize: 10, lineHeight: 1.45 }}>{copy}</p>}
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 20, cursor: 'pointer', alignSelf: 'start' }}>×</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  )
}

function ResourceTable({ resources }: { resources: ResourceRow[] }) {
  if (!resources.length) return <p style={{ fontSize: 11, color: '#65767b' }}>Für diesen Erdstandort liegen noch keine Ressourcenwerte vor.</p>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {resources.map(resource => (
        <div key={resource.resource} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3,auto)', gap: 12, padding: '7px 8px', borderBottom: '1px solid #ccd4d1', fontSize: 10 }}>
          <b>{resource.resource}</b>
          <span>Lager {Number(resource.stock).toLocaleString('de-DE')}</span>
          <span>+{Number(resource.production).toLocaleString('de-DE')}/Tick</span>
          <span>−{Number(resource.consumption).toLocaleString('de-DE')}/Tick</span>
        </div>
      ))}
    </div>
  )
}

const actionButton: React.CSSProperties = {
  border: '1px solid #476b79',
  background: '#183e4d',
  color: '#fff',
  borderRadius: 7,
  padding: '9px 12px',
  fontWeight: 800,
  fontSize: 10,
  cursor: 'pointer',
}

export default function EarthBuildingAccessLayer({
  request,
  onClose,
}: {
  request: BuildingEntryRequest | null
  onClose: () => void
}) {
  const {
    credits, cargo, cargoMax, buy, sell, loadFromServer,
    shipTypeId, shipRange, inTransit, travel,
  } = useGameStore()
  const [data, setData] = useState<AccessData | null>(null)
  const [loading, setLoading] = useState(false)
  const [spaceportMode, setSpaceportMode] = useState<SpaceportMode>('hub')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!request) return
    setSpaceportMode('hub')
    setMessage(null)
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const response = await fetch('/api/game/building-access?location=earth', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await response.json() as AccessData
        if (!response.ok) throw new Error(json.error ?? 'Gebäudedaten konnten nicht geladen werden')
        if (!cancelled) setData(json)
      } catch (error) {
        if (!cancelled) setData({ error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [request])

  if (!request) return null

  if (loading && !data) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(2,7,12,.82)', display: 'grid', placeItems: 'center', color: '#eef4f1', font: '700 13px system-ui' }}>Gebäude wird betreten …</div>
  }

  if (data?.error) {
    return (
      <FacilityPanel eyebrow="ZUGANG" title="Gebäudezugang nicht verfügbar" onClose={onClose}>
        <p style={{ fontSize: 12, color: '#714747' }}>{data.error}</p>
      </FacilityPanel>
    )
  }

  const location = data?.location
  const resources = location?.location_resources ?? []
  const locationName = location?.name ?? 'Erde'

  if (request.kind === 'administration') {
    return <AdminOverlay locationSlug="earth" onClose={onClose} />
  }

  if (request.kind === 'bank') {
    return (
      <BankOverlay
        locationSlug="earth"
        locationName={locationName}
        credits={credits}
        onClose={onClose}
        onCreditsChanged={() => void loadFromServer()}
      />
    )
  }

  if (request.kind === 'academy') {
    const water = resources.find(resource => resource.resource === 'water')
    return (
      <SchoolOverlay
        locationSlug="earth"
        colonyContext={{
          locationName,
          population: Number(location?.population ?? 0),
          waterStock: Number(water?.stock ?? 0),
          waterCons: Number(water?.consumption ?? 0),
          credits,
        }}
        onClose={onClose}
        onKnowledgeEarned={() => {}}
      />
    )
  }

  const warehouse = (
    <WarehouseOverlay
      locationSlug={'earth' as LocationSlug}
      locationName={locationName}
      prices={data?.prices ?? []}
      resources={resources}
      orders={data?.orders ?? []}
      cargo={cargo}
      cargoMax={cargoMax}
      credits={credits}
      onTrade={async (resource, mode, amount, price) => {
        const result = mode === 'buy'
          ? await buy(resource as ResourceType, price, amount)
          : await sell(resource as ResourceType, price, amount)
        setMessage(result.msg)
        await loadFromServer()
        return result.ok
      }}
      onFulfillOrder={async (orderId, agreedReward) => {
        try {
          const token = await getToken()
          if (!token) return false
          const response = await fetch(`/api/game/orders?action=fulfill&orderId=${encodeURIComponent(orderId)}&agreedReward=${Math.round(agreedReward)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const json = await response.json()
          setMessage(json.ok ? `Auftrag erfüllt · +${Number(json.reward ?? agreedReward).toLocaleString('de-DE')} Cr` : (json.error ?? 'Auftrag konnte nicht erfüllt werden'))
          if (json.ok) await loadFromServer()
          return Boolean(json.ok)
        } catch {
          setMessage('Auftrag konnte nicht erfüllt werden')
          return false
        }
      }}
      onClose={request.kind === 'spaceport' ? () => setSpaceportMode('hub') : onClose}
    />
  )

  if (request.kind === 'warehouse') return warehouse

  if (request.kind === 'foundation') {
    return (
      <FacilityPanel
        eyebrow="EINZIGARTIGES WELTGEBÄUDE · SSF"
        title="Solar Science Foundation · Hauptsitz"
        copy="Bogenstraße 15 · Sundern. Kanonischer, nicht duplizierbarer Sitz der Solar Science Foundation auf der globalen NOXIA-Erde."
        onClose={onClose}
      >
        <div style={{ display: 'grid', gap: 8, fontSize: 11 }}>
          <div style={{ padding: 10, border: '1px solid #ccd4d1', borderRadius: 8, background: '#f8faf6' }}>
            <b>Gebäudeform</b><span style={{ display: 'block', marginTop: 3, color: '#65767b' }}>Bungalow · staatlich/SSF · einzigartiges kanonisches Weltobjekt</span>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 4 }}>
            <button style={actionButton} onClick={() => window.location.assign('/ssf')}>Solar Science Foundation öffnen</button>
            <button style={actionButton} onClick={() => window.location.assign('/knowledge')}>Wissenssystem öffnen</button>
            <button style={actionButton} onClick={() => window.location.assign('/academy/learn')}>Lernen öffnen</button>
          </div>
        </div>
      </FacilityPanel>
    )
  }

  if (request.kind === 'research') {
    const isScanner = request.buildingTypeId === 'scanner'
    return (
      <FacilityPanel
        eyebrow={isScanner ? 'GEODÄSIE & ANALYSE' : 'FORSCHUNG'}
        title={request.buildingName}
        copy={isScanner ? 'Die Earth-Scannerstation ist bereits als Weltgebäude angebunden. Die alte Tile-Scanner-Messung ist für globale WGS84-Positionen noch nicht freigeschaltet.' : 'Forschungszugang auf Basis des bestehenden NOXIA-Wissenssystems.'}
        onClose={onClose}
      >
        <ResourceTable resources={resources} />
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
          <button style={actionButton} onClick={() => window.location.assign('/knowledge')}>Wissensstand öffnen</button>
          {!isScanner && <button style={actionButton} onClick={() => window.location.assign('/ssf')}>SSF-Module öffnen</button>}
        </div>
      </FacilityPanel>
    )
  }

  if (request.kind === 'production') {
    return (
      <FacilityPanel
        eyebrow="PRODUKTION"
        title={request.buildingName}
        copy="Die Fabrik ist betretbar und zeigt den realen Standortzustand. Einzelne Fertigungsrezepte und Maschinensteuerung sind noch nicht als eigener Produktions-Backendloop vorhanden."
        onClose={onClose}
      >
        <ResourceTable resources={resources} />
      </FacilityPanel>
    )
  }

  if (request.kind === 'residents') {
    return (
      <FacilityPanel
        eyebrow="WOHNEN & BEVÖLKERUNG"
        title={request.buildingName}
        copy="Persönliche Bewohnerverwaltung wird nicht simuliert, solange dafür kein belastbarer People-/Staff-Backendzustand vorliegt."
        onClose={onClose}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: 10, background: '#f8faf6', border: '1px solid #ccd4d1', borderRadius: 8 }}><small>Bevölkerung Erde</small><b style={{ display: 'block', marginTop: 3 }}>{Number(location?.population ?? 0).toLocaleString('de-DE')}</b></div>
          <div style={{ padding: 10, background: '#f8faf6', border: '1px solid #ccd4d1', borderRadius: 8 }}><small>Kapazität</small><b style={{ display: 'block', marginTop: 3 }}>{Number(location?.population_max ?? 0).toLocaleString('de-DE')}</b></div>
        </div>
        <ResourceTable resources={resources} />
      </FacilityPanel>
    )
  }

  if (request.kind === 'shipyard') {
    return (
      <FacilityPanel
        eyebrow="WERFT"
        title={request.buildingName}
        copy="Die Selmecke-Werft ist als funktionaler Zugang vorhanden. Schiffskäufe bleiben an die in den Schiffstypen tatsächlich freigeschalteten Fertigungsorte gebunden; NOXIA erfindet hier keine Earth-Angebote."
        onClose={onClose}
      >
        <div style={{ display: 'grid', gap: 7, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Aktives Schiff</span><b>{shipTypeId}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Reichweite</span><b>{shipRange}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Frachtraum</span><b>{cargoMax} t</b></div>
          <button style={{ ...actionButton, justifySelf: 'start', marginTop: 5 }} onClick={() => void loadFromServer().then(() => setMessage('Schiffsdaten aktualisiert'))}>Schiffsdaten aktualisieren</button>
          {message && <div style={{ padding: 8, background: '#fff8df', borderRadius: 7, fontSize: 10 }}>{message}</div>}
        </div>
      </FacilityPanel>
    )
  }

  if (request.kind !== 'spaceport') {
    return (
      <FacilityPanel eyebrow="GEBÄUDE" title={request.buildingName} onClose={onClose}>
        <p style={{ fontSize: 11 }}>Der Gebäudeeingang ist vorhanden, aber noch keiner NOXIA-Funktion zugeordnet.</p>
      </FacilityPanel>
    )
  }

  if (spaceportMode === 'cargo') return warehouse

  if (spaceportMode === 'navigation') {
    return (
      <LandingOverlay
        currentLocation="earth"
        locations={data?.locations ?? []}
        cargo={{ water: cargo.water, energy: cargo.energy, metal: cargo.metal }}
        shipRange={shipRange}
        currentTick={Number(data?.tickNumber ?? 0)}
        inTransit={inTransit}
        onTravel={dest => void travel(dest as LocationSlug, Number(data?.tickNumber ?? 0))}
        onClose={() => setSpaceportMode('hub')}
      />
    )
  }

  if (spaceportMode === 'maintenance') {
    return (
      <FacilityPanel eyebrow="WARTUNG & BODENSERVICE" title={request.buildingName} onClose={() => setSpaceportMode('hub')}>
        <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Aktives Schiff</span><b>{shipTypeId}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Standort</span><b>Erde</b></div>
        </div>
        <p style={{ margin: '14px 0 0', color: '#607279', fontSize: 11, lineHeight: 1.55 }}>Ein belastbares Verschleiß-/Reparaturmodell existiert noch nicht; deshalb werden keine erfundenen Reparaturwerte oder Kosten angeboten.</p>
        {message && <div style={{ marginTop: 10, padding: 8, background: '#fff8df', borderRadius: 7, fontSize: 10 }}>{message}</div>}
        <button onClick={() => void loadFromServer().then(() => setMessage('Schiffsdaten aktualisiert'))} style={{ ...actionButton, marginTop: 12 }}>Schiffsdaten aktualisieren</button>
      </FacilityPanel>
    )
  }

  return (
    <SpaceportOverlay
      buildingTypeId={request.buildingTypeId}
      buildingName={request.buildingName}
      onClose={onClose}
      onOpenNavigation={() => setSpaceportMode('navigation')}
      onOpenMaintenance={() => setSpaceportMode('maintenance')}
      onOpenCargo={() => setSpaceportMode('cargo')}
    />
  )
}
