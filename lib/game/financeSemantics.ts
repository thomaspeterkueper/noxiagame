// lib/game/financeSemantics.ts
// NOXIA-FIN-0001 / Gate G1 — pure booking semantics and money-supply invariants.
//
// These rules do not mutate ledgers. They classify and validate postings so live
// migrations and research runs can prove whether a transaction preserves,
// creates or destroys local simulation credits.

export type MoneyOperation =
  | 'transfer'
  | 'fiscal'
  | 'emission'
  | 'sink'
  | 'credit_issue'
  | 'credit_repayment'
  | 'clearing'

export interface MoneyPosting {
  accountId: string
  /** Positive credits the account, negative debits it. */
  amount: number
  /** Optional logical account family for diagnostics only. */
  accountClass?: 'player' | 'npc' | 'public' | 'bank' | 'external'
}

export interface MoneyTransaction {
  id: string
  operation: MoneyOperation
  postings: MoneyPosting[]
  reference?: string
}

export interface MoneyInvariantResult {
  ok: boolean
  operation: MoneyOperation
  postingSum: number
  liquidDelta: number | null
  errors: string[]
}

const round = (value: number): number => Math.round(value * 10000) / 10000
const sum = (postings: readonly MoneyPosting[]): number =>
  round(postings.reduce((total, posting) => total + Number(posting.amount || 0), 0))

/**
 * Change in liquid money implied by the transaction.
 *
 * Credit issue/repayment deliberately returns null: their monetary effect
 * depends on the banking regime and matched asset/liability postings, which G1
 * keeps separate until the credit model is activated.
 */
export function liquidMoneyDelta(tx: MoneyTransaction): number | null {
  const total = sum(tx.postings)
  switch (tx.operation) {
    case 'transfer':
    case 'fiscal':
    case 'clearing':
      return 0
    case 'emission':
    case 'sink':
      return total
    case 'credit_issue':
    case 'credit_repayment':
      return null
  }
}

/**
 * Core G1 invariants:
 * - transfer/fiscal/clearing must net to zero;
 * - emission must be strictly positive;
 * - sink must be strictly negative;
 * - credit operations are not accepted as ordinary transfers and require a
 *   later credit-balance-sheet validator.
 */
export function validateMoneyTransaction(tx: MoneyTransaction): MoneyInvariantResult {
  const postingSum = sum(tx.postings)
  const errors: string[] = []
  if (!tx.id) errors.push('missing_transaction_id')
  if (!tx.postings.length) errors.push('no_postings')
  if (tx.postings.some((posting) => !Number.isFinite(posting.amount))) errors.push('non_finite_posting')

  if (tx.operation === 'transfer' || tx.operation === 'fiscal' || tx.operation === 'clearing') {
    if (postingSum !== 0) errors.push('non_zero_sum_transfer')
    if (tx.postings.length < 2) errors.push('transfer_needs_two_sides')
  } else if (tx.operation === 'emission') {
    if (postingSum <= 0) errors.push('emission_must_increase_money')
    if (!tx.reference) errors.push('emission_needs_reference')
  } else if (tx.operation === 'sink') {
    if (postingSum >= 0) errors.push('sink_must_reduce_money')
    if (!tx.reference) errors.push('sink_needs_reference')
  } else {
    errors.push('credit_requires_separate_balance_sheet_rule')
  }

  return {
    ok: errors.length === 0,
    operation: tx.operation,
    postingSum,
    liquidDelta: liquidMoneyDelta(tx),
    errors,
  }
}

export interface MoneyFlowSummary {
  transfers: number
  fiscal: number
  emissions: number
  sinks: number
  clearing: number
  unclassifiedCredit: number
  netLiquidDelta: number
  invalidTransactions: number
}

/** Aggregate only transactions whose liquid-money effect G1 can define. */
export function summarizeMoneyFlows(transactions: readonly MoneyTransaction[]): MoneyFlowSummary {
  const out: MoneyFlowSummary = {
    transfers: 0,
    fiscal: 0,
    emissions: 0,
    sinks: 0,
    clearing: 0,
    unclassifiedCredit: 0,
    netLiquidDelta: 0,
    invalidTransactions: 0,
  }

  for (const tx of transactions) {
    const checked = validateMoneyTransaction(tx)
    if (!checked.ok) out.invalidTransactions += 1
    if (tx.operation === 'transfer') out.transfers += 1
    else if (tx.operation === 'fiscal') out.fiscal += 1
    else if (tx.operation === 'emission') out.emissions += 1
    else if (tx.operation === 'sink') out.sinks += 1
    else if (tx.operation === 'clearing') out.clearing += 1
    else out.unclassifiedCredit += 1
    if (checked.liquidDelta != null) out.netLiquidDelta = round(out.netLiquidDelta + checked.liquidDelta)
  }
  return out
}

/** Convenience constructor for an ordinary two-sided transfer. */
export function transferTransaction(input: {
  id: string
  from: string
  to: string
  amount: number
  operation?: 'transfer' | 'fiscal' | 'clearing'
  reference?: string
}): MoneyTransaction {
  const amount = Math.max(0, Number(input.amount || 0))
  return {
    id: input.id,
    operation: input.operation ?? 'transfer',
    reference: input.reference,
    postings: [
      { accountId: input.from, amount: -amount },
      { accountId: input.to, amount },
    ],
  }
}


export interface TaxedTransfer {
  gross: number
  tax: number
  net: number
  transaction: MoneyTransaction
}

/**
 * One payer, one recipient, one public till. The tax is carved out of the
 * gross payment; it is not added on top and therefore cannot create money.
 */
export function taxedTransfer(input: {
  id: string
  payer: string
  recipient: string
  publicAccount: string
  gross: number
  taxRate: number
  reference?: string
}): TaxedTransfer {
  const gross = Math.max(0, Math.round(Number(input.gross || 0)))
  const rate = Math.max(0, Math.min(1, Number(input.taxRate || 0)))
  const tax = Math.min(gross, Math.round(gross * rate))
  const net = gross - tax
  return {
    gross,
    tax,
    net,
    transaction: {
      id: input.id,
      operation: 'fiscal',
      reference: input.reference,
      postings: [
        { accountId: input.payer, amount: -gross },
        { accountId: input.recipient, amount: net },
        { accountId: input.publicAccount, amount: tax },
      ],
    },
  }
}


export interface FiscalCoverageInput {
  publicPayroll: number
  taxableBases: {
    transactionGross?: number
    rentGross?: number
    propertyGross?: number
    landingGross?: number
    tariffGross?: number
  }
  rates: {
    transaction?: number
    rent?: number
    property?: number
    landing?: number
    tariff?: number
  }
}

export interface FiscalCoverageResult {
  publicPayroll: number
  projectedRevenue: number
  coverageRatio: number
  fundingGap: number
  bySource: Record<'transaction'|'rent'|'property'|'landing'|'tariff', number>
}

/**
 * Read-only fiscal sustainability measure.
 *
 * It does not choose rates and does not alter gameplay. It only asks whether
 * observed taxable flows, at explicitly supplied rates, could finance the
 * public payroll without emission.
 */
export function fiscalCoverage(input: FiscalCoverageInput): FiscalCoverageResult {
  const payroll = Math.max(0, Number(input.publicPayroll || 0))
  const clampRate = (value: number | undefined) => Math.max(0, Math.min(1, Number(value || 0)))
  const base = (value: number | undefined) => Math.max(0, Number(value || 0))

  const bySource = {
    transaction: round(base(input.taxableBases.transactionGross) * clampRate(input.rates.transaction)),
    rent: round(base(input.taxableBases.rentGross) * clampRate(input.rates.rent)),
    property: round(base(input.taxableBases.propertyGross) * clampRate(input.rates.property)),
    landing: round(base(input.taxableBases.landingGross) * clampRate(input.rates.landing)),
    tariff: round(base(input.taxableBases.tariffGross) * clampRate(input.rates.tariff)),
  }
  const projectedRevenue = round(Object.values(bySource).reduce((total, value) => total + value, 0))
  const fundingGap = round(Math.max(0, payroll - projectedRevenue))
  const coverageRatio = payroll > 0 ? round(projectedRevenue / payroll) : 1

  return { publicPayroll: payroll, projectedRevenue, coverageRatio, fundingGap, bySource }
}
