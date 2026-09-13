import type { VehicleCargoLoad } from '../vehicles/types'

/**
 * Provenance for the quantity unit presented by a logistics/resource catalog.
 *
 * `authoritative` means the caller knows that `unit` is an intentional physical
 * quantity definition for this commodity. `legacy-default` explicitly marks old
 * catalog defaults that must not be promoted to physics. `unknown` is equally
 * non-authoritative.
 */
export type LogisticsUnitAuthority = 'authoritative' | 'legacy-default' | 'unknown'

export interface LogisticsCargoQuantity {
  commodityId: string
  amount: number
  unit: string | null
}

export type LogisticsCargoMassBasis =
  | {
      kind: 'catalog-unit'
      authority: LogisticsUnitAuthority
      sourceId?: string | null
    }
  | {
      kind: 'mass-per-unit'
      authority: Exclude<LogisticsUnitAuthority, 'legacy-default'>
      massPerUnitKg: number
      sourceId?: string | null
    }

export type LogisticsCargoMassUnresolvedReason =
  | 'invalid-amount'
  | 'missing-unit'
  | 'legacy-unit-not-authoritative'
  | 'mass-basis-not-authoritative'
  | 'invalid-mass-per-unit'
  | 'unsupported-unit'

export interface ResolvedLogisticsCargoMass {
  status: 'resolved'
  commodityId: string
  sourceAmount: number
  sourceUnit: string | null
  massKg: number
  cargo: VehicleCargoLoad
  resolution: 'direct-mass-unit' | 'mass-per-unit'
  sourceId: string | null
}

export interface UnresolvedLogisticsCargoMass {
  status: 'unresolved'
  commodityId: string
  sourceAmount: number
  sourceUnit: string | null
  reason: LogisticsCargoMassUnresolvedReason
}

export type LogisticsCargoMassResolution = ResolvedLogisticsCargoMass | UnresolvedLogisticsCargoMass

function unresolved(
  quantity: LogisticsCargoQuantity,
  reason: LogisticsCargoMassUnresolvedReason,
): UnresolvedLogisticsCargoMass {
  return {
    status: 'unresolved',
    commodityId: quantity.commodityId,
    sourceAmount: quantity.amount,
    sourceUnit: quantity.unit,
    reason,
  }
}

/**
 * Resolve a Core logistics quantity into the kg-based vehicle cargo contract.
 *
 * This function intentionally does not infer density, packaging mass, or a
 * conversion from a generic gameplay unit. A physical mass is only returned if
 * either:
 *   1. an authoritative catalog unit is already `kg` or metric tonnes (`t`), or
 *   2. an authoritative mass-per-unit value is supplied by the owning domain.
 *
 * In particular, the historical `resources.unit default 't'` must be passed as
 * `legacy-default`; it is not evidence that every NOXIA resource is measured in
 * tonnes.
 */
export function resolveLogisticsCargoMass(
  quantity: LogisticsCargoQuantity,
  basis: LogisticsCargoMassBasis,
): LogisticsCargoMassResolution {
  if (!quantity.commodityId || !Number.isFinite(quantity.amount) || quantity.amount <= 0) {
    return unresolved(quantity, 'invalid-amount')
  }

  if (basis.authority !== 'authoritative') {
    return unresolved(
      quantity,
      basis.kind === 'catalog-unit' && basis.authority === 'legacy-default'
        ? 'legacy-unit-not-authoritative'
        : 'mass-basis-not-authoritative',
    )
  }

  if (basis.kind === 'mass-per-unit') {
    if (!Number.isFinite(basis.massPerUnitKg) || basis.massPerUnitKg <= 0) {
      return unresolved(quantity, 'invalid-mass-per-unit')
    }
    const massKg = quantity.amount * basis.massPerUnitKg
    if (!Number.isFinite(massKg) || massKg <= 0) {
      return unresolved(quantity, 'invalid-mass-per-unit')
    }
    return {
      status: 'resolved',
      commodityId: quantity.commodityId,
      sourceAmount: quantity.amount,
      sourceUnit: quantity.unit,
      massKg,
      cargo: {
        commodityId: quantity.commodityId,
        amount: massKg,
        unit: 'kg',
      },
      resolution: 'mass-per-unit',
      sourceId: basis.sourceId ?? null,
    }
  }

  const unit = quantity.unit?.trim() ?? ''
  if (!unit) return unresolved(quantity, 'missing-unit')

  if (unit === 'kg') {
    return {
      status: 'resolved',
      commodityId: quantity.commodityId,
      sourceAmount: quantity.amount,
      sourceUnit: unit,
      massKg: quantity.amount,
      cargo: {
        commodityId: quantity.commodityId,
        amount: quantity.amount,
        unit: 'kg',
      },
      resolution: 'direct-mass-unit',
      sourceId: basis.sourceId ?? null,
    }
  }

  if (unit === 't') {
    const massKg = quantity.amount * 1000
    if (!Number.isFinite(massKg)) return unresolved(quantity, 'invalid-amount')
    return {
      status: 'resolved',
      commodityId: quantity.commodityId,
      sourceAmount: quantity.amount,
      sourceUnit: unit,
      massKg,
      cargo: {
        commodityId: quantity.commodityId,
        amount: quantity.amount,
        unit: 't',
      },
      resolution: 'direct-mass-unit',
      sourceId: basis.sourceId ?? null,
    }
  }

  return unresolved(quantity, 'unsupported-unit')
}
