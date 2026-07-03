# NOX-0002 — Location reputation RPC for trade deliveries

## Target System
NOXIA

## Origin
Solar Science Foundation project conversation / NOXIA code review

## Target Files

- `supabase/migrations/031_reputation_rpc.sql`
- `app/api/game/trade/route.ts`

## Reason
Selling resources to a colony should increase the player's local reputation. The proposed implementation uses a PostgreSQL RPC so the reputation row is inserted or incremented atomically with `INSERT ... ON CONFLICT DO UPDATE`.

## Deploy Order

1. Apply `031_reputation_rpc.sql` in Supabase first.
2. Deploy the updated `app/api/game/trade/route.ts` after the RPC exists.

## Requested Change

### 1. Add Supabase RPC migration

Create `supabase/migrations/031_reputation_rpc.sql` with:

```sql
CREATE OR REPLACE FUNCTION upsert_location_reputation(
  p_profile_id  uuid,
  p_location_id uuid,
  p_deliveries  integer DEFAULT 1,
  p_volume      integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO location_reputation (profile_id, location_id, deliveries, total_volume, updated_at)
  VALUES (p_profile_id, p_location_id, p_deliveries, p_volume, now())
  ON CONFLICT (profile_id, location_id) DO UPDATE
    SET deliveries   = location_reputation.deliveries   + p_deliveries,
        total_volume = location_reputation.total_volume + p_volume,
        updated_at   = now();
$$;
```

### 2. Call RPC after successful sell transaction

In `app/api/game/trade/route.ts`, directly after `trade_transactions.insert`, call:

```ts
if (action === 'sell') {
  try {
    await serviceClient.rpc('upsert_location_reputation', {
      p_profile_id:  user.id,
      p_location_id: loc.id,
      p_deliveries:  1,
      p_volume:      booked,
    })
  } catch {
    // Reputation is not business-critical; ignore RPC failures.
  }
}
```

## Design Notes

- Only `sell` increases reputation, because deliveries build trust.
- `buy` does not increase reputation, because buying from a colony makes the player a customer, not a supplier.
- RPC errors should not block successful trade transactions.
- The increment must remain atomic at the database layer to avoid race conditions.

## Priority
Medium

## Blocking
Not blocking current trade flow, but needed for future reputation-aware colony behaviour and economic relationship systems.

## Status
Open

## Created
2026-07-03
