import {
  liquidMoneyDelta,
  summarizeMoneyFlows,
  transferTransaction,
  validateMoneyTransaction,
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
