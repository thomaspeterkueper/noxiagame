'use client'

// app/dashboard/BuildingInterior.tsx
// Scanner routing facade. All existing building interiors remain in
// LegacyBuildingInterior byte-for-byte; only scanner uses the walkable slice.

import type { ComponentProps } from 'react'
import LegacyBuildingInterior from './LegacyBuildingInterior'
import ScannerMicroScene from './ScannerMicroScene'

type Props = ComponentProps<typeof LegacyBuildingInterior>

export default function BuildingInterior(props: Props) {
  const { entity } = props
  if (entity.entity_id !== 'scanner') return <LegacyBuildingInterior {...props} />

  const isOwn = entity.profile_id === props.userId
  const isState = entity.owner_class === 'STATE'
  const ownerLabel = isOwn
    ? '🔑 Dein Gebäude'
    : isState
      ? '🏛 Staatlich'
      : `👤 ${entity.actor_name ?? entity.username ?? 'Fremd'}`

  return (
    <ScannerMicroScene
      resources={props.locationResources}
      population={props.population}
      ownerLabel={ownerLabel}
      locationSlug={props.currentLocationSlug ?? 'unknown'}
      scannerEntityId={entity.id}
      scannerRow={entity.tile_row}
      scannerCol={entity.tile_col}
      gridRows={24}
      gridCols={32}
      onClose={props.onClose}
    />
  )
}
