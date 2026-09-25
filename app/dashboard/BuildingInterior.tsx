'use client'

import type { ComponentProps } from 'react'
import LegacyBuildingInterior from './LegacyBuildingInterior'
import ScannerMicroScene from './ScannerMicroScene'
import FacilityInterior from './FacilityInterior'
import { hasFacilityDefinition } from '@/lib/game/facilities/catalog'

type Props = ComponentProps<typeof LegacyBuildingInterior>

export default function BuildingInterior(props: Props) {
  const { entity } = props
  const isOwn = entity.profile_id === props.userId

  // The scanner is already a real micro-scene with its own authoritative API.
  // Keep it intact. Facilities with a declared shared model use the new
  // facility -> zone -> interaction-point hierarchy. Older building types stay
  // on their existing interior until their facility definition is migrated.
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

  if (hasFacilityDefinition(entity.entity_id)) return <FacilityInterior {...props} />
  return <LegacyBuildingInterior {...props} />
}
