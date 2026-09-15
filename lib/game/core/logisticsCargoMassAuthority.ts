import {
  resolveLogisticsCargoMass,
  type LogisticsCargoMassBasis,
  type LogisticsCargoMassResolution,
  type LogisticsCargoQuantity,
} from './logisticsCargoMass'

export interface LogisticsCargoMassAuthorityEntry {
  commodityId: string
  basis: LogisticsCargoMassBasis
  source: {
    repository: string
    reference: string
  }
}

/**
 * Shared explicit mapping from gameplay commodity ids to authoritative physical
 * cargo-mass bases. Entries belong here only after the owning Engineering/domain
 * source has defined the physical transport form and quantity basis.
 *
 * EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS is still open, so the productive
 * catalog remains empty. In particular, a legacy catalog unit such as `t` is
 * not promoted to physical mass merely because it is present in an inventory
 * snapshot.
 */
export const LOGISTICS_CARGO_MASS_AUTHORITIES: readonly LogisticsCargoMassAuthorityEntry[] = []

export interface AuthoritativeLogisticsCargoMassResolution {
  resolution: LogisticsCargoMassResolution
  source: LogisticsCargoMassAuthorityEntry['source'] | null
}

export function resolveAuthoritativeLogisticsCargoMass(
  quantity: LogisticsCargoQuantity,
): AuthoritativeLogisticsCargoMassResolution {
  const matches = LOGISTICS_CARGO_MASS_AUTHORITIES.filter(entry => entry.commodityId === quantity.commodityId)
  if (matches.length > 1) {
    throw new Error(`Duplicate authoritative cargo-mass basis for ${quantity.commodityId}`)
  }

  const entry = matches[0]
  if (!entry) {
    return {
      resolution: resolveLogisticsCargoMass(quantity, {
        kind: 'catalog-unit',
        authority: 'unknown',
      }),
      source: null,
    }
  }

  return {
    resolution: resolveLogisticsCargoMass(quantity, entry.basis),
    source: entry.source,
  }
}
