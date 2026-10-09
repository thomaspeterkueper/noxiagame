import {
  liquidMoneyDelta,
  summarizeMoneyFlows,
  taxedTransfer,
  transferTransaction,
  validateMoneyTransaction,
  fiscalCoverage,
  type MoneyTransaction,
} from './financeSemantics'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const wage = transferTransaction({ id: 'wage:1', from: 'employer', to: 'person', amount: 90 })
check(validateMoneyTransaction(wage).ok, 'ordinary wage is a zero-sum transfer')
check(validateMoneyTransaction(wage).postingSum === 0 && liquidMoneyDelta(wage) === 0, 'transfer leaves money supply unchanged')

const tax = transferTransaction({ id: 'tax:1', from: 'person', to: 'colony', amount: 10, operation: 'fiscal' })
check(validateMoneyTransaction(tax).ok && liquidMoneyDelta(tax) === 0, 'tax is a fiscal transfer, not emission')

const mirroredTax: MoneyTransaction = {
  id: 'tax:bad',
  operation: 'fiscal',
  postings: [
    { accountId: 'colony', amount: 10 },
    { accountId: 'public-employer', amount: 10 },
  ],
}
check(!validateMoneyTransaction(mirroredTax).ok, 'crediting tax twice without a debit violates the fiscal invariant')
check(validateMoneyTransaction(mirroredTax).errors.includes('non_zero_sum_transfer'), 'double-counted tax is detected explicitly')

// Migration 20261008210000: colony treasury debited, public employer credited, same reference.
const publicFunding: MoneyTransaction = {
  id: 'colony_ledger:42',
  operation: 'fiscal',
  reference: 'colony_ledger:42',
  postings: [
    { accountId: 'colony', amount: -10, accountClass: 'public' },
    { accountId: 'public-employer', amount: 10, accountClass: 'public' },
  ],
}
check(validateMoneyTransaction(publicFunding).ok && liquidMoneyDelta(publicFunding) === 0, 'public funding is a zero-sum fiscal transfer from the colony treasury')

const bootstrap: MoneyTransaction = {
  id: 'bootstrap:person:p1',
  operation: 'emission',
  reference: 'bootstrap:person:p1',
  postings: [{ accountId: 'person:p1', amount: 980 }],
}
check(validateMoneyTransaction(bootstrap).ok && liquidMoneyDelta(bootstrap) === 980, 'bootstrap is explicit audited emission')

const unlabeledEmission: MoneyTransaction = {
  id: 'mystery',
  operation: 'emission',
  postings: [{ accountId: 'person:p1', amount: 100 }],
}
check(!validateMoneyTransaction(unlabeledEmission).ok, 'emission without audit reference is rejected')

const buildSink: MoneyTransaction = {
  id: 'build:1',
  operation: 'sink',
  reference: 'npc-build:1',
  postings: [{ accountId: 'npc-firm', amount: -33400 }],
}
check(validateMoneyTransaction(buildSink).ok && liquidMoneyDelta(buildSink) === -33400, 'unmatched build spend is an explicit sink')

const badSink: MoneyTransaction = {
  id: 'sink:bad',
  operation: 'sink',
  reference: 'bad',
  postings: [{ accountId: 'npc', amount: 10 }],
}
check(!validateMoneyTransaction(badSink).ok, 'a sink cannot increase money')

const credit: MoneyTransaction = {
  id: 'loan:1',
  operation: 'credit_issue',
  postings: [{ accountId: 'borrower', amount: 1000 }],
  reference: 'loan:1',
}
check(!validateMoneyTransaction(credit).ok && liquidMoneyDelta(credit) === null, 'credit is not silently treated as an ordinary emission')
check(validateMoneyTransaction(credit).errors.includes('credit_requires_separate_balance_sheet_rule'), 'credit requires its own balance-sheet invariant')

const summary = summarizeMoneyFlows([wage, tax, bootstrap, buildSink, credit])
check(summary.transfers === 1 && summary.fiscal === 1 && summary.emissions === 1 && summary.sinks === 1, 'flow classes remain separated')
check(summary.netLiquidDelta === 980 - 33400, 'summary changes money only through explicit emission and sink')
check(summary.unclassifiedCredit === 1, 'credit stays visibly unresolved at G1')

if (failures) throw new Error(String(failures) + ' finance invariant test(s) failed')
console.log('Finance semantics G1: tests passed; live mutations=0')


const taxedRent = taxedTransfer({
  id: 'rent:1',
  payer: 'tenant',
  recipient: 'landlord',
  publicAccount: 'colony',
  gross: 400,
  taxRate: 0.1,
  reference: 'tenancy:1',
})
check(taxedRent.gross === 400 && taxedRent.tax === 40 && taxedRent.net === 360, 'rent tax is carved out of the gross payment')
check(validateMoneyTransaction(taxedRent.transaction).ok, 'taxed rent remains a zero-sum fiscal transfer')
check(validateMoneyTransaction(taxedRent.transaction).postingSum === 0, 'tenant debit equals landlord net plus tax')



const impossibleConsumptionFunding = fiscalCoverage({
  publicPayroll: 1880,
  taxableBases: { transactionGross: 40 },
  rates: { transaction: 1 },
})
check(impossibleConsumptionFunding.projectedRevenue === 40, 'fiscal coverage never exceeds the observed taxable transaction base')
check(Math.abs(impossibleConsumptionFunding.coverageRatio - (40 / 1880)) < 0.0001, 'fiscal coverage reports the observed public-payroll ratio')
check(impossibleConsumptionFunding.fundingGap === 1840, 'fiscal coverage exposes the remaining funding gap')

const mixedFiscalBases = fiscalCoverage({
  publicPayroll: 1000,
  taxableBases: { transactionGross: 2000, rentGross: 500, landingGross: 300 },
  rates: { transaction: 0.1, rent: 0.2, landing: 0.5 },
})
check(mixedFiscalBases.bySource.transaction === 200, 'transaction-tax projection uses only its declared base')
check(mixedFiscalBases.bySource.rent === 100, 'rent-tax projection uses only its declared base')
check(mixedFiscalBases.bySource.landing === 150, 'landing-tax projection uses only its declared base')
check(mixedFiscalBases.projectedRevenue === 450 && mixedFiscalBases.fundingGap === 550, 'independent fiscal bases combine without hidden emission')

if (failures > 0) {
  throw new Error(`NOXIA-FIN-0001: ${failures} finance semantic checks failed`)
}
console.log('NOXIA-FIN-0001 finance semantic checks passed')
