# Live fiscal audit — 2026-10-09

Status: read-only audit plus non-disruptive plumbing fixes. No tax rate or market behavior activated.

## Live snapshot

- Tick at audit: 2128.
- 32 active work assignments have employer actors.
- Public employment: 23 jobs, 1,880 credits daily payroll.
- Every public employer currently holds exactly 14 days of bootstrap payroll reserve.
- All configured tax rates are 0: property, transaction, landing and rent.
- colony_ledger is empty at the snapshot.
- Observed NPC consumption over the previous 24 ticks: 5 purchases, 40 credits gross.
- Active market rents: 0.
- building_trades: 0 rows.
- npc_trades: historical activity only; latest observed trade tick 1392.

## What is already zero-sum

### Wages

run_npc_payroll books employer debit and person credit with the same assignment reference.
The first post-backfill full payroll is expected at tick 2136.

### NPC service consumption

Migration 20261009073000_atomic_taxed_npc_consumption.sql makes the service purchase atomic:

buyer gross debit = seller net credit + transaction tax.

At the current live tax_transaction=0, behavior and balances are unchanged.
The consumption event stores the applied rate, tax amount and seller net for auditability.

### Player spot trade

noxia_spot_trade already reads colony_settings.tax_transaction and writes any tax to colony_ledger.
With the current rate of zero it creates no fiscal entry.

### Market rent

The dormant market-rent settlement is zero-sum:

tenant gross debit = landlord net credit + rent tax.

There are currently no active origin='market' rented tenancies.

### Passenger transit revenue

A passenger without a ship pays a real ticket price by debit to profiles.credits.
noxia_start_passenger_transit credits the same amount to colony_ledger as a public service receipt
(entry_type='payout', note prefix 'Ticketerloes Linienflug').

Migration 20261009075000_passenger_ticket_public_funding.sql allows only those identified
ticket receipts to be transferred from the local treasury to the local public employer.
Arbitrary future payout rows are deliberately not accepted.

## Sustainability finding

Observed consumption cannot finance the current public payroll on its own.

Even a hypothetical 100% transaction tax on the last 24 ticks of NPC consumption would yield:

- taxable gross: 40 credits
- maximum revenue: 40 credits
- public daily payroll: 1,880 credits
- maximum coverage: about 2.13%
- remaining gap: 1,840 credits

Therefore the next economic problem is not choosing a higher tax rate. The simulation still lacks
enough real payment flows: broader household consumption, commercial sales, public service fees,
landing/transport revenue, property flows and/or explicitly funded public budgets.

fiscalCoverage() in lib/game/financeSemantics.ts now measures this without changing behavior.

## G1 blockers found but not changed live

### Building cancellation / teardown / sale

app/api/game/build/route.ts currently contains direct profile-credit increases without a debited
counterparty: cancellation refund, module teardown payout, instant building sale payout, and
deferred sale payout through the sale completion path.

These are implicit emissions unless a buyer, recycler, insurer, treasury or explicit issuer is
introduced. They must not be silently reclassified as transfers.

### Trade-order reward

The atomic trade-order fulfilment path credits the player a reward while no explicit paying account
is visible in the audited function. This is another candidate emission. It may be a deliberate
public procurement payment, but then the public budget must be debited.

### Bank interest

Deposit and loan interest remain outside G1 ordinary-transfer validation. A proper bank balance
sheet / issuer rule is required before classifying them as neutral monetary operations.

## Next safe steps

1. Observe the full payroll at tick 2136 before changing employer funding.
2. Keep all live tax rates at zero until a fiscal scenario is explicitly chosen.
3. Audit and type the building-sale/refund payer before changing payout behavior.
4. Audit trade-order rewards as procurement versus explicit emission.
5. Expand real consumption/service/payment flows before testing sustainable tax rates.
6. Run fiscal-coverage scenarios read-only; do not infer a tax rate from the payroll gap.