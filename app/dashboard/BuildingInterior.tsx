'use client'

import type { ComponentProps } from 'react'
import LegacyBuildingInterior from './LegacyBuildingInterior'
import ScannerMicroScene from './ScannerMicroScene'

type Props = ComponentProps<typeof LegacyBuildingInterior>

export default function BuildingInterior(props: Props) {
  const { entity } = props
  const isOwn = entity.profile_id === props.userId
  // The scanner micro-scene is backed by the canonical scanner API, which only
  // resolves the owner's scanner (GET returns scanner: null, POST 403 for a
  // foreign or STATE-owned one). Only owned scanners get the walkable scene;
  // everything else keeps the legacy interior with its owner label.
  if (entity.entity_id !== 'scanner' || !isOwn) return <LegacyBuildingInterior {...props} />

  return (
    <ScannerMicroScene
      locationSlug={props.currentLocationSlug ?? 'unknown'}
      scannerEntityId={entity.id}
      scannerRow={entity.tile_row}
      scannerCol={entity.tile_col}
      resources={props.locationResources}
      population={props.population}
      ownerLabel="Dein Gebäude"
      onClose={props.onClose}
    />
  )
}
