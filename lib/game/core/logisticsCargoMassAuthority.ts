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
 * KUEPER Engineering completed EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS with
 * components/logistics/engineering-commodities-r1.json. Engineering deliberately
 * leaves the mapping from its commodity ids to NOXIA gameplay ids to NOXIA.
 *
 * NOXIA now explicitly maps the gameplay commodity `water` to Engineering
 * `ENG-COM-0001` ("Liquid water, bulk") when the catalog quantity is expressed
 * as an actual mass unit (kg or metric tonnes). This is a commodity-specific
 * gameplay-semantic decision; it does not promote the historical global
 * `resources.unit = 't'` default to physical truth for any other resource.
 *
 * Abstract `energy`, `metal`, and `components` therefore remain unresolved
 * until NOXIA introduces a concrete carrier/material/product form.
 */
export const LOGISTICS_CARGO_MASS_AUTHORITIES: readonly LogisticsCargoMassAuthorityEntry[] = [
  {
    commodityId: 'water',
    basis: {
      kind: 'catalog-unit',
      authority: 'authoritative',
      sourceId: 'KUEPER-Engineering:ENG-COM-0001:r1',
    },
    source: {
      repository: 'thomaspeterkueper/kueper-engineering',
      reference: 'components/logistics/engineering-commodities-r1.json#ENG-COM-0001',
    },
  },
]

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
