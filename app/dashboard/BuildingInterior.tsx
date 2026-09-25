'use client'

import type { ComponentProps } from 'react'
import LegacyBuildingInterior from './LegacyBuildingInterior'
import ScannerMicroScene from './ScannerMicroScene'
import FacilityInterior from './FacilityInterior'

type Props = ComponentProps<typeof LegacyBuildingInterior>

export default function BuildingInterior(props: Props) {
  const { entity } = props
  const isOwn = entity.profile_id === props.userId

  // The scanner is already a real micro-scene with its own authoritative API.
  // Keep it intact. Every other building now enters through the shared Facility
  // model so Earth, Moon and future planetary surfaces use the same interior
  // address space (facility -> zone -> interaction point).
  if (entity.entity_id === 'scanner' && isOwn) {
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

  return <FacilityInterior {...props} />
}
