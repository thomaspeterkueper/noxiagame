-- Bank: Tageszins mit Gegenkonto, Festgeld, Neuberechnung der Altguthaben.
-- Entschieden (Thomas, 28.10.2026): „Tageszins, Bank zahlt“ und „Neu berechnen“; „Festgeld klingt gut“.
--
-- Befund: runBankInterestTick schrieb Einlagen 0,5 % je Tick (Stunde) gut, ohne dass
-- jemand zahlte – Geld aus dem Nichts (gegen NOXIA-FIN-0001). Aus 1 500 eingezahlten
-- Credits wurden so rund 577 000. Kreditzinsen liefen mit 2 % je Stunde.
--
-- Neu:
--   * Die Bank ist ein Akteur (Solar Central Bank) mit eigenem Konto im npc_ledger.
--     Startreserve 5 000 Cr, ausgewiesen als bootstrap:bank:solar-central-bank.
--   * Zinsen einmal am Tag (alle 24 Ticks, run_bank_daily): Einlagen 0,1 %/Tag, Kredite
--     0,5 %/Tag. Einlagezinsen zahlt die Bank aus ihrem Konto; reicht es nicht, gibt es
--     weniger (ausgewiesen im Bankbuch). Kreditzinsen laufen auf und werden beim Tilgen
--     zuerst bezahlt – dieser Teil geht an die Bank. Kredit selbst bleibt Kreditgeld:
--     Auszahlung schafft Geld, Tilgung der Hauptsumme vernichtet es.
--   * Festgeld (bank_term_deposits): 7 Tage zu 0,2 %/Tag oder 30 Tage zu 0,3 %/Tag,
--     einfacher Zins, ausgezahlt bei Fälligkeit. Vorzeitig kündbar ohne Zins.
--     Erst nach dem Lernmodul „Was ist Zinseszins?“ (ECO-L0-000002, R-15).
--   * Altguthaben: eingezahlter Betrag plus Tageszins seit der Einzahlung; die
--     Korrektur steht im Bankbuch (entry_type 'correction').
-- Sätze in noxia_bank_rates(); app/api/game/bank/route.ts liest sie mit.
--
-- Nebenbefund: academy_completions verwies per Fremdschlüssel auf academy_modules
-- (alte Kennungen wie 'finanzgrundlagen'). Abschlüsse der SSF-Module (ECO-L0-000001 …)
-- scheiterten deshalb still – niemand konnte den Kreditnachweis erbringen. Der
-- Fremdschlüssel fällt weg; die Module kommen heute aus der SSF.

set search_path to public;

-- ── Bankbuch: neue Buchungsarten ────────────────────────────────────────────
alter table public.bank_ledger drop constraint if exists bank_ledger_entry_type_check;
alter table public.bank_ledger add constraint bank_ledger_entry_type_check check (entry_type = any (array[
  'deposit', 'withdrawal', 'loan_taken', 'loan_repaid', 'interest_deposit', 'interest_loan',
  'term_open', 'term_payout', 'term_break', 'correction']::text[]));

alter table public.bank_accounts add column if not exists loan_principal numeric not null default 0;
update public.bank_accounts set loan_principal = loan where loan_principal = 0 and loan > 0;

alter table public.academy_completions drop constraint if exists academy_completions_module_id_fkey;

-- ── Sätze ────────────────────────────────────────────────────────────────────
create or replace function public.noxia_bank_rates() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'deposit_daily', 0.001,
    'loan_daily', 0.005,
    'term', jsonb_build_array(
      jsonb_build_object('days', 7, 'rate_daily', 0.002),
      jsonb_build_object('days', 30, 'rate_daily', 0.003)),
    'term_min', 100,
    'term_module', 'ECO-L0-000002',
    'term_unlock', 'UNL:NOX:bank-compound')
$$;

-- ── Die Bank als Akteur ──────────────────────────────────────────────────────
create table if not exists public.bank_institution (
  id        boolean primary key default true check (id),
  actor_id  uuid not null references public.actors(id),
  name      text not null
);
alter table public.bank_institution enable row level security;
revoke all on public.bank_institution from anon, authenticated;
grant select on public.bank_institution to service_role;

do $$
declare
  v_actor uuid;
  v_tick bigint;
begin
  if exists (select 1 from public.bank_institution) then return; end if;
  insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
  values ('institution', 'Solar Central Bank', 'Bank der Kolonien: Einlagen, Kredite, Festgeld.', '{}'::jsonb, '{}'::jsonb)
  returning id into v_actor;
  insert into public.bank_institution(actor_id, name) values (v_actor, 'Solar Central Bank');
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'endowment', null, 0, 5000, null, 'bootstrap:bank:solar-central-bank',
          'Bootstrap-Startreserve der Solar Central Bank: zahlt Einlagezinsen, bis Kreditzinsen sie tragen');
end $$;

-- ── Festgeld ─────────────────────────────────────────────────────────────────
create table if not exists public.bank_term_deposits (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references auth.users(id) on delete cascade,
  location_id    uuid not null references public.locations(id) on delete cascade,
  principal      integer not null check (principal >= 100),
  rate_daily     numeric not null check (rate_daily > 0 and rate_daily < 0.05),
  term_days      integer not null check (term_days > 0),
  opened_tick    bigint not null,
  matures_tick   bigint not null,
  status         text not null default 'open' check (status in ('open', 'paid', 'broken')),
  interest_paid  integer not null default 0,
  opened_at      timestamptz not null default now(),
  closed_at      timestamptz
);
create index if not exists bank_term_deposits_profile_idx on public.bank_term_deposits (profile_id, status);
create index if not exists bank_term_deposits_due_idx on public.bank_term_deposits (status, matures_tick);
alter table public.bank_term_deposits enable row level security;
revoke all on public.bank_term_deposits from anon, authenticated;
grant select, insert, update on public.bank_term_deposits to service_role;

create or replace function public.open_term_deposit(p_profile_id uuid, p_location_id uuid, p_amount integer, p_term_days integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rates jsonb := public.noxia_bank_rates();
  v_rate numeric;
  v_credits integer;
  v_tick bigint;
  v_row public.bank_term_deposits%rowtype;
begin
  if not exists (select 1 from public.tile_entities where location_id = p_location_id and entity_type = 'building' and entity_id = 'bank') then
    raise exception 'NOXIA_BANK_NOT_AVAILABLE';
  end if;
  if not exists (select 1 from public.academy_completions where profile_id = p_profile_id and module_id = v_rates->>'term_module')
     and not exists (select 1 from public.player_unlocks where profile_id = p_profile_id and unlock_id = v_rates->>'term_unlock') then
    raise exception 'NOXIA_BANK_TERM_CLEARANCE_REQUIRED:%', v_rates->>'term_module';
  end if;
  select (t->>'rate_daily')::numeric into v_rate from jsonb_array_elements(v_rates->'term') t where (t->>'days')::int = p_term_days;
  if v_rate is null then raise exception 'NOXIA_BANK_TERM_INVALID'; end if;
  if p_amount is null or p_amount < (v_rates->>'term_min')::int then raise exception 'NOXIA_BANK_TERM_MIN:%', v_rates->>'term_min'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits < p_amount then raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits - p_amount where id = p_profile_id;
  insert into public.bank_term_deposits(profile_id, location_id, principal, rate_daily, term_days, opened_tick, matures_tick)
  values (p_profile_id, p_location_id, p_amount, v_rate, p_term_days, v_tick, v_tick + p_term_days * 24)
  returning * into v_row;
  insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
  values (p_profile_id, p_location_id, 'term_open', p_amount, p_amount,
          format('Festgeld angelegt: %s Cr für %s Tage zu %s %%/Tag', p_amount, p_term_days, round(v_rate * 100, 2)), v_tick);
  return jsonb_build_object('ok', true, 'id', v_row.id, 'principal', p_amount, 'term_days', p_term_days, 'rate_daily', v_rate,
    'matures_tick', v_row.matures_tick, 'interest_at_maturity', floor(p_amount * v_rate * p_term_days), 'credits', v_credits - p_amount);
end;
$$;

create or replace function public.break_term_deposit(p_profile_id uuid, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.bank_term_deposits%rowtype;
  v_tick bigint;
begin
  select * into v_row from public.bank_term_deposits where id = p_id and profile_id = p_profile_id for update;
  if not found then raise exception 'NOXIA_BANK_TERM_NOT_FOUND'; end if;
  if v_row.status <> 'open' then raise exception 'NOXIA_BANK_TERM_CLOSED'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.bank_term_deposits set status = 'broken', closed_at = now() where id = p_id;
  update public.profiles set credits = credits + v_row.principal where id = p_profile_id;
  insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
  values (p_profile_id, v_row.location_id, 'term_break', v_row.principal, 0, format('Festgeld vorzeitig gekündigt: %s Cr zurück, ohne Zins', v_row.principal), v_tick);
  return jsonb_build_object('ok', true, 'returned', v_row.principal);
end;
$$;

-- ── Einzahlen, Abheben, Kredit, Tilgen: Kreditzinsen gehen an die Bank ──────
create or replace function public.noxia_bank_mutation(p_profile_id uuid, p_location_id uuid, p_action text, p_amount integer, p_credit_limit integer default null::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_credits integer;
  v_account public.bank_accounts%rowtype;
  v_amount integer := p_amount;
  v_repay integer;
  v_interest_part numeric;
  v_new_deposit numeric;
  v_new_loan numeric;
  v_new_principal numeric;
  v_entry_type text;
  v_note text;
  v_bank uuid;
begin
  if p_profile_id is null or p_location_id is null then raise exception 'NOXIA_BANK_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;
  if p_action not in ('deposit','withdraw','loan','repay') then raise exception 'NOXIA_BANK_ACTION_INVALID:%',coalesce(p_action,'<null>') using errcode='P0001'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'NOXIA_BANK_AMOUNT_INVALID' using errcode='P0001'; end if;
  if not exists (select 1 from public.tile_entities where location_id=p_location_id and entity_type='building' and entity_id='bank') then raise exception 'NOXIA_BANK_NOT_AVAILABLE' using errcode='P0001'; end if;

  select credits into v_credits from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;

  insert into public.bank_accounts(profile_id,location_id,deposit,loan) values(p_profile_id,p_location_id,0,0) on conflict(profile_id,location_id) do nothing;
  select * into v_account from public.bank_accounts where profile_id=p_profile_id and location_id=p_location_id for update;
  if not found then raise exception 'NOXIA_BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;

  v_new_deposit := v_account.deposit; v_new_loan := v_account.loan; v_new_principal := v_account.loan_principal;
  if p_action='deposit' then
    if v_amount < 10 then raise exception 'NOXIA_BANK_MIN_DEPOSIT:10' using errcode='P0001'; end if;
    if v_credits < v_amount then raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT' using errcode='P0001'; end if;
    v_credits:=v_credits-v_amount; v_new_deposit:=v_account.deposit+v_amount; v_entry_type:='deposit'; v_note:=format('Einzahlung %s Cr',v_amount);
    update public.profiles set credits=v_credits where id=p_profile_id;
    update public.bank_accounts set deposit=v_new_deposit,updated_at=now() where id=v_account.id;
  elsif p_action='withdraw' then
    if v_account.deposit < v_amount then raise exception 'NOXIA_BANK_DEPOSIT_INSUFFICIENT:%',v_account.deposit using errcode='P0001'; end if;
    v_credits:=v_credits+v_amount; v_new_deposit:=v_account.deposit-v_amount; v_entry_type:='withdrawal'; v_note:=format('Auszahlung %s Cr',v_amount);
    update public.profiles set credits=v_credits where id=p_profile_id;
    update public.bank_accounts set deposit=v_new_deposit,updated_at=now() where id=v_account.id;
  elsif p_action='loan' then
    if v_amount < 100 then raise exception 'NOXIA_BANK_MIN_LOAN:100' using errcode='P0001'; end if;
    if not exists(select 1 from public.academy_completions where profile_id=p_profile_id and module_id='ECO-L0-000001') then raise exception 'NOXIA_BANK_CREDIT_CLEARANCE_REQUIRED:ECO-L0-000001' using errcode='P0001'; end if;
    if p_credit_limit is null or p_credit_limit < 0 then raise exception 'NOXIA_BANK_CREDIT_LIMIT_REQUIRED' using errcode='P0001'; end if;
    if v_account.loan + v_amount > p_credit_limit then raise exception 'NOXIA_BANK_CREDIT_LIMIT_EXCEEDED:%',greatest(0,p_credit_limit-v_account.loan)::integer using errcode='P0001'; end if;
    v_credits:=v_credits+v_amount; v_new_loan:=v_account.loan+v_amount; v_new_principal:=v_account.loan_principal+v_amount;
    v_entry_type:='loan_taken'; v_note:=format('Kredit aufgenommen: %s Cr (Schulden gesamt: %s Cr)',v_amount,v_new_loan);
    update public.profiles set credits=v_credits where id=p_profile_id;
    update public.bank_accounts set loan=v_new_loan,loan_principal=v_new_principal,updated_at=now() where id=v_account.id;
  else
    if v_account.loan <= 0 then raise exception 'NOXIA_BANK_NO_OUTSTANDING_LOAN' using errcode='P0001'; end if;
    v_repay:=least(v_amount,ceil(v_account.loan)::integer);
    if v_credits < v_repay then raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT:%',v_repay using errcode='P0001'; end if;
    -- Zuerst die aufgelaufenen Zinsen: dieser Teil ist Einnahme der Bank.
    v_interest_part := least(v_repay, greatest(0, v_account.loan - v_account.loan_principal));
    v_credits:=v_credits-v_repay; v_new_loan:=greatest(0, v_account.loan-v_repay);
    v_new_principal:=greatest(0, v_account.loan_principal-(v_repay-v_interest_part));
    v_amount:=v_repay; v_entry_type:='loan_repaid'; v_note:=format('Kredit getilgt: %s Cr, davon %s Cr Zinsen (Restschuld: %s Cr)',v_repay,floor(v_interest_part),v_new_loan);
    update public.profiles set credits=v_credits where id=p_profile_id;
    update public.bank_accounts set loan=v_new_loan,loan_principal=v_new_principal,updated_at=now() where id=v_account.id;
    select actor_id into v_bank from public.bank_institution;
    if v_bank is not null and floor(v_interest_part) > 0 then
      insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
      values (v_bank,(select coalesce(max(tick_number),0) from public.tick_log),'income',0,floor(v_interest_part),p_location_id,
              'bank_repay:' || v_account.id::text || ':' || gen_random_uuid()::text,'Kreditzinsen eingenommen');
    end if;
  end if;

  insert into public.bank_ledger(profile_id,location_id,entry_type,amount,balance_after,note)
  values(p_profile_id,p_location_id,v_entry_type,v_amount,case when p_action in ('deposit','withdraw') then v_new_deposit else v_new_loan end,v_note);
  return jsonb_build_object('action',p_action,'amount',v_amount,'credits',v_credits,'deposit',v_new_deposit,'loan',v_new_loan);
end;
$function$;

-- ── Tageslauf: Zinsen und fälliges Festgeld ──────────────────────────────────
create or replace function public.run_bank_daily(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rates jsonb := public.noxia_bank_rates();
  v_dep_rate numeric := (v_rates->>'deposit_daily')::numeric;
  v_loan_rate numeric := (v_rates->>'loan_daily')::numeric;
  v_bank uuid;
  v_bank_balance numeric;
  v_acc record;
  v_term record;
  v_due integer;
  v_paid integer;
  v_interest integer;
  v_deposit_paid integer := 0;
  v_deposit_short integer := 0;
  v_loan_accrued integer := 0;
  v_terms integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_BANK_TICK_INVALID'; end if;
  if mod(p_tick, 24) <> 0 then return jsonb_build_object('ok', true, 'due', false); end if;
  if exists (select 1 from public.bank_ledger where tick = p_tick and entry_type in ('interest_deposit', 'interest_loan')) then
    return jsonb_build_object('ok', true, 'due', true, 'already', true);
  end if;

  select actor_id into v_bank from public.bank_institution;
  select coalesce(sum(credit_delta), 0) into v_bank_balance from public.npc_ledger where actor_id = v_bank;

  for v_acc in select * from public.bank_accounts where deposit > 0 or loan > 0 order by id for update loop
    if v_acc.deposit > 0 then
      v_due := floor(v_acc.deposit * v_dep_rate)::integer;
      v_paid := least(v_due, greatest(0, floor(v_bank_balance))::integer);
      if v_paid > 0 then
        update public.bank_accounts set deposit = deposit + v_paid, updated_at = now() where id = v_acc.id;
        insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
        values (v_bank, p_tick, 'expense', 0, -v_paid, v_acc.location_id, 'bank_interest:' || v_acc.id::text || ':' || p_tick::text, 'Einlagezinsen');
        insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
        values (v_acc.profile_id, v_acc.location_id, 'interest_deposit', v_paid, v_acc.deposit + v_paid,
                format('Zinsgutschrift +%s %%/Tag', round(v_dep_rate * 100, 2)) || case when v_paid < v_due then format(' (Bank zahlt nur %s von %s Cr)', v_paid, v_due) else '' end, p_tick);
        v_bank_balance := v_bank_balance - v_paid;
        v_deposit_paid := v_deposit_paid + v_paid;
      end if;
      if v_paid < v_due then v_deposit_short := v_deposit_short + (v_due - v_paid); end if;
    end if;
    if v_acc.loan > 0 then
      v_interest := ceil(v_acc.loan * v_loan_rate)::integer;
      update public.bank_accounts set loan = loan + v_interest, updated_at = now() where id = v_acc.id;
      insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
      values (v_acc.profile_id, v_acc.location_id, 'interest_loan', v_interest, v_acc.loan + v_interest,
              format('Kreditzinsen %s %%/Tag (Zinseszins)', round(v_loan_rate * 100, 2)), p_tick);
      v_loan_accrued := v_loan_accrued + v_interest;
    end if;
  end loop;

  -- Fälliges Festgeld: Hauptsumme zurück, Zins von der Bank.
  for v_term in select * from public.bank_term_deposits where status = 'open' and matures_tick <= p_tick order by matures_tick for update loop
    v_due := floor(v_term.principal * v_term.rate_daily * v_term.term_days)::integer;
    v_paid := least(v_due, greatest(0, floor(v_bank_balance))::integer);
    update public.profiles set credits = credits + v_term.principal + v_paid where id = v_term.profile_id;
    update public.bank_term_deposits set status = 'paid', interest_paid = v_paid, closed_at = now() where id = v_term.id;
    if v_paid > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
      values (v_bank, p_tick, 'expense', 0, -v_paid, v_term.location_id, 'bank_term:' || v_term.id::text, 'Festgeldzinsen');
      v_bank_balance := v_bank_balance - v_paid;
    end if;
    insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
    values (v_term.profile_id, v_term.location_id, 'term_payout', v_term.principal + v_paid, 0,
            format('Festgeld fällig: %s Cr + %s Cr Zinsen', v_term.principal, v_paid) || case when v_paid < v_due then format(' (Bank zahlt nur %s von %s Cr Zinsen)', v_paid, v_due) else '' end, p_tick);
    v_terms := v_terms + 1;
  end loop;

  return jsonb_build_object('ok', true, 'due', true, 'deposit_interest', v_deposit_paid, 'deposit_short', v_deposit_short,
    'loan_interest', v_loan_accrued, 'terms_paid', v_terms, 'bank_balance', v_bank_balance);
end;
$$;

revoke all on function public.open_term_deposit(uuid,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.open_term_deposit(uuid,uuid,integer,integer) to service_role;
revoke all on function public.break_term_deposit(uuid,uuid) from public, anon, authenticated;
grant execute on function public.break_term_deposit(uuid,uuid) to service_role;
revoke all on function public.run_bank_daily(bigint) from public, anon, authenticated;
grant execute on function public.run_bank_daily(bigint) to service_role;
grant execute on function public.noxia_bank_rates() to service_role;

-- ── Altguthaben neu berechnen ────────────────────────────────────────────────
-- Eingezahlt plus Tageszins (0,1 %/Tag, Zinseszins) seit jeder Einzahlung; abgehoben
-- wurde bisher nichts. Die Differenz steht als Korrektur im Bankbuch.
do $$
declare
  v_acc record;
  v_new numeric;
  v_tick bigint;
begin
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  for v_acc in select * from public.bank_accounts where deposit > 0 for update loop
    select coalesce(sum(case when l.entry_type = 'deposit' then l.amount when l.entry_type = 'withdrawal' then -l.amount else 0 end
                        * power(1.001, floor(extract(epoch from now() - l.created_at) / 86400))), 0)
      into v_new
      from public.bank_ledger l
     where l.profile_id = v_acc.profile_id and l.location_id = v_acc.location_id and l.entry_type in ('deposit', 'withdrawal');
    v_new := greatest(0, floor(v_new));
    if v_new <> v_acc.deposit then
      update public.bank_accounts set deposit = v_new, updated_at = now() where id = v_acc.id;
      insert into public.bank_ledger(profile_id, location_id, entry_type, amount, balance_after, note, tick)
      values (v_acc.profile_id, v_acc.location_id, 'correction', abs(v_acc.deposit - v_new), v_new,
              format('Neuberechnung (28.10.2026): Zinsen waren 0,5 %% je Stunde ohne Gegenkonto; jetzt eingezahlt plus 0,1 %%/Tag seit Einzahlung. Vorher %s Cr, jetzt %s Cr.', v_acc.deposit, v_new), v_tick);
    end if;
  end loop;
end $$;
