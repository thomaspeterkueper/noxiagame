'use client'

import { useEffect, useState } from 'react'
import SchoolOverlay from '@/app/dashboard/SchoolOverlay'
import WarehouseOverlay from '@/app/dashboard/WarehouseOverlay'
import LandingOverlay from '@/app/dashboard/LandingOverlay'
import SpaceportOverlay from '@/app/dashboard/SpaceportOverlay'
import { getToken } from '@/lib/supabase/auth'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import type { BuildingEntryRequest } from '@/lib/game/buildings/entry'

type AccessData = {
  location?: {
    slug: string
    name: string
    population: number
    population_max: number
    location_resources?: { resource: string; stock: number; consumption: number; production: number }[]
  }
  prices?: any[]
  orders?: any[]
  locations?: { slug: string; name: string; population: number }[]
  tickNumber?: number
  error?: string
}

type SpaceportMode = 'hub' | 'navigation' | 'maintenance' | 'cargo'

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
      <div style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(2,7,12,.82)', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ width: 'min(480px,94vw)', background: '#f5f0e5', borderRadius: 12, padding: 18, color: '#4d3434' }}>
          <strong>Gebäudezugang nicht verfügbar</strong>
          <p style={{ fontSize: 12 }}>{data.error}</p>
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    )
  }

  const location = data?.location
  const resources = location?.location_resources ?? []
  const locationName = location?.name ?? 'Erde'

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

  if (spaceportMode === 'cargo') return warehouse

  if (spaceportMode === 'navigation') {
    return (
      <LandingOverlay
        currentLocation="earth"
        locations={data?.locations ?? []}
        cargo={cargo}
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(2,7,12,.86)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={event => event.target === event.currentTarget && setSpaceportMode('hub')}>
        <div style={{ width: 'min(560px,94vw)', background: '#eef1ed', border: '1px solid #78919a', borderRadius: 12, overflow: 'hidden', color: '#1b3540' }}>
          <div style={{ padding: '14px 16px', background: '#102b38', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
            <div><small style={{ color: '#d8bd68', fontWeight: 800 }}>WARTUNG & BODENSERVICE</small><strong style={{ display: 'block', marginTop: 3 }}>{request.buildingName}</strong></div>
            <button onClick={() => setSpaceportMode('hub')} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Aktives Schiff</span><b>{shipTypeId}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccd4d1', paddingBottom: 7 }}><span>Standort</span><b>Erde</b></div>
            </div>
            <p style={{ margin: '14px 0 0', color: '#607279', fontSize: 11, lineHeight: 1.55 }}>Der Zugang zum Wartungsbereich ist jetzt Teil des Raumhafens. Ein belastbares Verschleiß-/Reparaturmodell existiert jedoch noch nicht; deshalb werden hier noch keine erfundenen Reparaturwerte oder Kosten angeboten.</p>
            {message && <div style={{ marginTop: 10, padding: 8, background: '#fff8df', borderRadius: 7, fontSize: 10 }}>{message}</div>}
            <button onClick={() => void loadFromServer().then(() => setMessage('Schiffsdaten aktualisiert'))} style={{ marginTop: 12, border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '8px 11px', fontWeight: 800, cursor: 'pointer' }}>Schiffsdaten aktualisieren</button>
          </div>
        </div>
      </div>
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
