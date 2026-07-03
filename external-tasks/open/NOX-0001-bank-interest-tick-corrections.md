# NOX-0001 — Bank interest tick corrections

## Target System
NOXIA

## Origin
Solar Science Foundation project conversation / NOXIA code review

## Target File
`lib/game/tick.ts`

## Reason
The uploaded `tick.ts` version adds `runBankInterestTick`, but three small corrections are needed before the implementation should be considered clean and testable.

## Requested Change

### 1. Correct misleading comment

Current comment says the bank account update and ledger insert are atomic, but they are two separate Supabase calls and therefore not transactional.

Replace:

```ts
// Atomarer Update + Ledger-Einträge
```

with:

```ts
// Sequenzieller Update + Ledger-Einträge; nicht transaktional
```

### 2. Check ledger insert errors

After successful account update, check whether inserting into `bank_ledger` fails.

Suggested implementation:

```ts
if (!updateErr && ledgerEntries.length > 0) {
  const { error: ledgerErr } = await supabase.from('bank_ledger').insert(ledgerEntries)
  if (ledgerErr) console.error('runBankInterestTick: ledger error', ledgerErr)
}
```

This avoids silently losing the audit trail if `bank_accounts` updates but `bank_ledger` insert fails.

### 3. Export `runBankInterestTick`

Change:

```ts
async function runBankInterestTick(supabase: SB, tickNumber: number) {
```

into:

```ts
export async function runBankInterestTick(supabase: SB, tickNumber: number) {
```

Reason: this allows direct unit/integration testing of the bank-interest tick without running the complete game tick.

## Priority
Medium

## Blocking
Not blocking deployment if the current version already builds, but important for audit correctness and future testability.

## Status
Open

## Created
2026-07-03
