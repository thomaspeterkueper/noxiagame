import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const failures = [];
const passes = [];

function pass(label) {
  passes.push(label);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
}

function requireTokens(label, content, tokens) {
  let ok = true;
  for (const token of tokens) {
    if (!content.includes(token)) {
      ok = false;
      fail(label, `missing token ${JSON.stringify(token)}`);
    }
  }
  if (ok) pass(label);
}

function functionBlock(content, name) {
  const lower = content.toLowerCase();
  const start = lower.indexOf(`create or replace function public.${name.toLowerCase()}`);
  if (start < 0) return null;
  const next = lower.indexOf('create or replace function public.', start + 1);
  return content.slice(start, next < 0 ? content.length : next);
}

const logistics = read('supabase/migrations/20260911060537_logistics_core_inventories_and_transport_jobs.sql');
const transportPhases = read('supabase/migrations/20260911065436_transport_loading_unloading_phases.sql');
const custodyMarket = read('supabase/migrations/20260911111420_custody_marketplace_core.sql');
const marketRetry = read('supabase/migrations/20260911112830_market_command_idempotency_hardening.sql');
const facilityProduction = read('supabase/migrations/20260911064000_facility_output_production.sql');
const buildResources = read('supabase/migrations/20260831205000_authoritative_build_resource_costs.sql');
const resourceTick = read('supabase/migrations/20260901130000_atomic_resource_tick_updates.sql');
const componentsChain = read('supabase/migrations/20260831210000_components_chain_consolidation.sql');
const finance = read('supabase/migrations/20260910090000_atomic_finance_asset_commands.sql');
const retrySerialization = read('supabase/migrations/20260911114600_core_command_retry_serialization.sql');

// 1. Native physical stock cannot be negative at the schema boundary.
requireTokens('native inventory stock remains non-negative', logistics, [
  'constraint logistics_inventory_item_amount_check check (amount >= 0)',
]);

// 2. The shared adjustment primitive serializes mutations and refuses negative results.
const adjustInventory = functionBlock(logistics, 'noxia_adjust_inventory_amount');
if (!adjustInventory) {
  fail('inventory adjustment remains row-locked and non-negative', 'missing noxia_adjust_inventory_amount');
} else {
  requireTokens('inventory adjustment remains row-locked and non-negative', adjustInventory, [
    'where id = p_inventory_id and active for update',
    'v_next := v_current + p_delta',
    "if v_next < 0 then raise exception 'NOXIA_INVENTORY_STOCK_INSUFFICIENT",
  ]);
}

// 3. One read boundary must continue to bridge native, location and ship backing stores.
requireTokens('inventory adapter boundary remains explicit', logistics, [
  "if v_inventory.storage_kind = 'native' then",
  "elsif v_inventory.storage_kind = 'location_resources' then",
  "elsif v_inventory.storage_kind = 'ship_cargo' then",
  "jsonb_build_object('legacyAggregate', true)",
  "jsonb_build_object('vehicleClass', 'ship')",
]);

// 4. Availability is physical quantity minus active outbound reservations.
const reservedFn = functionBlock(logistics, 'noxia_inventory_reserved');
if (!reservedFn) {
  fail('active reservations define reserved quantity', 'missing noxia_inventory_reserved');
} else {
  requireTokens('active reservations define reserved quantity', reservedFn, [
    "direction = p_direction",
    "status = 'active'",
    'coalesce(sum(amount), 0)',
  ]);
}
requireTokens('inventory snapshot exposes physical reserved and available separately', logistics, [
  "'amount',public.noxia_inventory_amount(p_inventory_id,r.type)",
  "'reservedOutbound',public.noxia_inventory_reserved(p_inventory_id,r.type,'outbound')",
  "'available',greatest(0,public.noxia_inventory_amount(p_inventory_id,r.type)-public.noxia_inventory_reserved(p_inventory_id,r.type,'outbound'))",
]);

// 5. Direct cargo transfer must lock both inventories, honor reservations/capacity,
//    then debit and credit the exact same requested quantity.
const transferCargo = functionBlock(logistics, 'noxia_transfer_cargo');
if (!transferCargo) {
  fail('direct cargo transfer remains locally conservative', 'missing noxia_transfer_cargo');
} else {
  requireTokens('direct cargo transfer remains locally conservative', transferCargo, [
    'where id in (p_source_inventory_id, p_target_inventory_id) order by id for update',
    "v_source_reserved := public.noxia_inventory_reserved(p_source_inventory_id, p_resource, 'outbound')",
    'v_source_amount - v_source_reserved < p_amount',
    "direction='inbound' and status='active'",
    'v_target_total + v_target_reserved + p_amount > v_target_capacity',
    'public.noxia_adjust_inventory_amount(p_source_inventory_id, p_resource, -p_amount)',
    'public.noxia_adjust_inventory_amount(p_target_inventory_id, p_resource, p_amount)',
    'insert into public.cargo_transfer_commands',
  ]);
}

// 6. Retried direct transfers remain command-id serialized and payload-safe.
requireTokens('cargo transfer retry identity remains explicit', retrySerialization + logistics, [
  "pg_advisory_xact_lock(hashtextextended('noxia_transfer_cargo:' || p_command_id::text, 0))",
  'where command_id = p_command_id',
  'NOXIA_CARGO_TRANSFER_COMMAND_CONFLICT',
  "jsonb_build_object('idempotent', true)",
]);

// 7. Transport reservation must claim both source stock and target capacity.
const createTransport = functionBlock(logistics, 'noxia_create_transport_job');
if (!createTransport) {
  fail('transport creates paired reservation claims', 'missing noxia_create_transport_job');
} else {
  requireTokens('transport creates paired reservation claims', createTransport, [
    "public.noxia_inventory_reserved(p_source_inventory_id,p_resource,'outbound')",
    "direction='inbound' and status='active'",
    "(p_source_inventory_id,p_actor_profile_id,p_resource,p_amount,'outbound','transport_job',v_job_id)",
    "(p_destination_inventory_id,p_actor_profile_id,p_resource,p_amount,'inbound','transport_job',v_job_id)",
  ]);
}

// 8. Departure physically moves cargo source -> vehicle once and consumes outbound claim.
const startTransport = functionBlock(transportPhases, 'noxia_start_transport_job');
if (!startTransport) {
  fail('transport departure consumes source reservation exactly once', 'missing noxia_start_transport_job');
} else {
  requireTokens('transport departure consumes source reservation exactly once', startTransport, [
    "if v_job.status='in_transit' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true)",
    'public.noxia_adjust_inventory_amount(v_job.source_inventory_id,v_job.resource,-v_job.amount)',
    'public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,v_job.amount)',
    "direction='outbound' and status='active'",
    "set status='consumed',settled_at=now()",
  ]);
}

// 9. Completion physically moves cargo vehicle -> destination once and consumes inbound claim.
const completeTransport = functionBlock(transportPhases, 'noxia_complete_transport_job');
if (!completeTransport) {
  fail('transport completion consumes destination reservation exactly once', 'missing noxia_complete_transport_job');
} else {
  requireTokens('transport completion consumes destination reservation exactly once', completeTransport, [
    "if v_job.status='completed' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true)",
    "direction='inbound' and status='active'",
    'public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,-v_job.amount)',
    'public.noxia_adjust_inventory_amount(v_job.destination_inventory_id,v_job.resource,v_job.amount)',
    "set status='completed'",
  ]);
}

// 10. Cancellation releases claims and contains no physical inventory mutation.
const cancelTransport = functionBlock(transportPhases, 'noxia_cancel_transport_job');
if (!cancelTransport) {
  fail('transport cancellation releases claims without moving stock', 'missing noxia_cancel_transport_job');
} else {
  const releases = cancelTransport.includes("set status='released',settled_at=now()") && cancelTransport.includes("status='active'");
  const mutatesStock = cancelTransport.includes('noxia_adjust_inventory_amount');
  if (releases && !mutatesStock) pass('transport cancellation releases claims without moving stock');
  else fail('transport cancellation releases claims without moving stock', 'cancellation no longer cleanly releases reservations without stock mutation');
}

// 11. Marketplace uses custody inventory and an outbound reservation, not a copied stock pool.
requireTokens('market offers reserve seller custody stock', custodyMarket, [
  'seller_inventory_id uuid not null references public.logistics_inventories(id)',
  'reservation_id uuid not null unique references public.logistics_reservations(id)',
  "storage_kind <> 'native'",
  "subject_type <> 'storage_account'",
  "'outbound', 'market_offer'",
]);

// 12. Market settlement must preserve local goods and payment balance.
const buyMarket = functionBlock(marketRetry, 'noxia_buy_market_offer');
if (!buyMarket) {
  fail('market settlement moves equal goods and credits', 'missing noxia_buy_market_offer');
} else {
  requireTokens('market settlement moves equal goods and credits', buyMarket, [
    'v_total_price := p_amount::bigint * v_offer.unit_price::bigint',
    'set credits = credits - v_total_price::integer',
    'set credits = credits + v_total_price::integer',
    'public.noxia_adjust_inventory_amount(v_offer.seller_inventory_id, v_offer.resource, -p_amount)',
    'public.noxia_adjust_inventory_amount(v_buyer_inventory_id, v_offer.resource, p_amount)',
  ]);
}

// 13. The active reservation must mirror offer remainder; full fill consumes it.
if (buyMarket) {
  requireTokens('market reservation mirrors remaining offer quantity', buyMarket, [
    'v_reservation.amount is distinct from v_offer.amount_remaining',
    "set status = 'consumed', settled_at = now()",
    'set amount = v_remaining',
    'set amount_remaining = v_remaining',
  ]);
}

// 14. Market buy is explicit-command idempotent and locks the economic participants.
if (buyMarket) {
  requireTokens('market settlement remains serialized and replay-safe', buyMarket, [
    "pg_advisory_xact_lock(hashtextextended('noxia_market_buy:' || p_command_id::text, 0))",
    'where command_id = p_command_id',
    'from public.market_offers',
    'for update',
    'where id in (p_buyer_profile_id, v_offer.seller_profile_id)',
    'order by id',
    'NOXIA_MARKET_BUY_COMMAND_CONFLICT',
  ]);
}

// 15. Facility production is a uniquely identified, capacity-checked physical source.
const creditFacilityOutput = functionBlock(facilityProduction, 'noxia_credit_facility_output');
if (!creditFacilityOutput) {
  fail('facility production remains explicit and tick-idempotent', 'missing noxia_credit_facility_output');
} else {
  requireTokens('facility production remains explicit and tick-idempotent', facilityProduction + creditFacilityOutput, [
    'unique (tick_number, tile_entity_id, resource)',
    'on conflict (tick_number, tile_entity_id, resource) do nothing',
    'v_total + p_amount > v_capacity',
    'public.noxia_adjust_inventory_amount(v_inventory.id, p_resource, p_amount)',
    "'facility.production_credited'",
  ]);
}

// 16. Build resource consumption is row-locked and part of the build insert transaction.
const consumeBuildResources = functionBlock(buildResources, 'noxia_consume_build_resources');
if (!consumeBuildResources) {
  fail('build resources remain authoritative and atomic', 'missing noxia_consume_build_resources');
} else {
  requireTokens('build resources remain authoritative and atomic', buildResources + consumeBuildResources, [
    'PRIMARY KEY (buildable_id, resource)',
    'FOR UPDATE',
    'SET stock = stock - v_cost.amount',
    'BEFORE INSERT ON public.player_builds',
  ]);
}

// 17. Stock-only deductions/transfers must not receive an accidental economy tick.
requireTokens('resource tick remains isolated from stock-only mutations', resourceTick, [
  'BEFORE UPDATE OF production, consumption',
  'Pure stock transfers/build-cost deductions update only stock',
]);

// 18. Bank operations explicitly distinguish conserved wallet/deposit moves from modeled loan source/sink.
const bankMutation = functionBlock(finance, 'noxia_bank_mutation');
if (!bankMutation) {
  fail('bank mutation remains atomic and explicitly modeled', 'missing noxia_bank_mutation');
} else {
  requireTokens('bank mutation remains atomic and explicitly modeled', bankMutation, [
    'from public.profiles',
    'for update',
    'from public.bank_accounts',
    'v_credits := v_credits - v_amount',
    'v_new_deposit := v_account.deposit + v_amount',
    'v_credits := v_credits + v_amount',
    'v_new_deposit := v_account.deposit - v_amount',
    'v_new_loan := v_account.loan + v_amount',
    'insert into public.bank_ledger',
  ]);
}

// 19. The currently implemented production chain must remain concrete, not overstated as universal.
requireTokens('components chain remains an explicit metal to components recipe', componentsChain, [
  "'factory', 'Fabrik'",
  "'[{\"resource\":\"components\",\"amount\":1}]'::jsonb",
  "'[{\"resource\":\"metal\",\"amount\":3}]'::jsonb",
]);

if (failures.length > 0) {
  console.error('NOXIA Core resource/inventory/economy invariant check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional architecture change, update docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md and this executable guard together.');
  process.exit(1);
}

console.log(`NOXIA Core resource/inventory/economy invariant check passed (${passes.length} checks).`);
for (const label of passes) console.log(`- ${label}`);
