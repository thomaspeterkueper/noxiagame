-- Kreditfreigabe: SSF-Modulkennung und NOXIA-Freischaltung anerkennen
-- (28.10.2026, Thomas: „Lernvoraussetzungen wieder mit den Lernmodulen verbinden“)
--
-- Das Kreditmodul wird inzwischen über den In-Game-Lernraum abgeschlossen. Dort
-- speichert academy_completions die SSF-Kennung „LRN:SSF:ECO-L0-000001“; die
-- Bank-Funktion verlangte bisher ausschließlich die Kurzkennung „ECO-L0-000001“.
-- Wer das Modul im Spiel gelernt hatte, bekam deshalb trotzdem keinen Kredit.
--
-- Neu zählt jede bekannte Kennung desselben Moduls (lib/knowledge/learningCatalog.ts)
-- oder die Freischaltung UNL:NOX:bank-credit in player_unlocks.
-- Die Funktion ist sonst unverändert gegenüber 20260910090000.

set search_path to public;

-- ---------------------------------------------------------------------------
-- Bank
-- ---------------------------------------------------------------------------
create or replace function public.noxia_bank_mutation(
  p_profile_id uuid,
  p_location_id uuid,
  p_action text,
  p_amount integer,
  p_credit_limit integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_account public.bank_accounts%rowtype;
  v_amount integer := p_amount;
  v_repay integer;
  v_new_deposit numeric;
  v_new_loan numeric;
  v_entry_type text;
  v_note text;
begin
  if p_profile_id is null or p_location_id is null then
    raise exception 'NOXIA_BANK_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;

  if p_action not in ('deposit', 'withdraw', 'loan', 'repay') then
    raise exception 'NOXIA_BANK_ACTION_INVALID:%', coalesce(p_action, '<null>') using errcode = 'P0001';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'NOXIA_BANK_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  -- Mutations are only valid at an actual bank. The API already checks this;
  -- enforcing it again here keeps the database command authoritative.
  if not exists (
    select 1
    from public.tile_entities
    where location_id = p_location_id
      and entity_type = 'building'
      and entity_id = 'bank'
  ) then
    raise exception 'NOXIA_BANK_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- Lock the player wallet first. Bank operations never acquire ship locks,
  -- so this does not create a cycle with trade/ship commands.
  select credits into v_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.bank_accounts(profile_id, location_id, deposit, loan)
  values (p_profile_id, p_location_id, 0, 0)
  on conflict (profile_id, location_id) do nothing;

  select * into v_account
  from public.bank_accounts
  where profile_id = p_profile_id and location_id = p_location_id
  for update;

  if not found then
    raise exception 'NOXIA_BANK_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_new_deposit := v_account.deposit;
  v_new_loan := v_account.loan;

  if p_action = 'deposit' then
    if v_amount < 10 then
      raise exception 'NOXIA_BANK_MIN_DEPOSIT:10' using errcode = 'P0001';
    end if;
    if v_credits < v_amount then
      raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT' using errcode = 'P0001';
    end if;

    v_credits := v_credits - v_amount;
    v_new_deposit := v_account.deposit + v_amount;
    v_entry_type := 'deposit';
    v_note := format('Einzahlung %s Cr', v_amount);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set deposit = v_new_deposit, updated_at = now()
      where id = v_account.id;

  elsif p_action = 'withdraw' then
    if v_account.deposit < v_amount then
      raise exception 'NOXIA_BANK_DEPOSIT_INSUFFICIENT:%', v_account.deposit using errcode = 'P0001';
    end if;

    v_credits := v_credits + v_amount;
    v_new_deposit := v_account.deposit - v_amount;
    v_entry_type := 'withdrawal';
    v_note := format('Auszahlung %s Cr', v_amount);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set deposit = v_new_deposit, updated_at = now()
      where id = v_account.id;

  elsif p_action = 'loan' then
    if v_amount < 100 then
      raise exception 'NOXIA_BANK_MIN_LOAN:100' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.academy_completions
      where profile_id = p_profile_id
        and module_id in ('ECO-L0-000001', 'LRN:SSF:ECO-L0-000001', 'LRN:SSF:ECO-L0-0001')
    ) and not exists (
      select 1
      from public.player_unlocks
      where profile_id = p_profile_id
        and unlock_id = 'UNL:NOX:bank-credit'
    ) then
      raise exception 'NOXIA_BANK_CREDIT_CLEARANCE_REQUIRED:ECO-L0-000001' using errcode = 'P0001';
    end if;

    if p_credit_limit is null or p_credit_limit < 0 then
      raise exception 'NOXIA_BANK_CREDIT_LIMIT_REQUIRED' using errcode = 'P0001';
    end if;

    if v_account.loan + v_amount > p_credit_limit then
      raise exception 'NOXIA_BANK_CREDIT_LIMIT_EXCEEDED:%', greatest(0, p_credit_limit - v_account.loan)::integer using errcode = 'P0001';
    end if;

    v_credits := v_credits + v_amount;
    v_new_loan := v_account.loan + v_amount;
    v_entry_type := 'loan_taken';
    v_note := format('Kredit aufgenommen: %s Cr (Schulden gesamt: %s Cr)', v_amount, v_new_loan);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set loan = v_new_loan, updated_at = now()
      where id = v_account.id;

  else -- repay
    if v_account.loan <= 0 then
      raise exception 'NOXIA_BANK_NO_OUTSTANDING_LOAN' using errcode = 'P0001';
    end if;

    v_repay := least(v_amount, v_account.loan::integer);
    if v_credits < v_repay then
      raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT:%', v_repay using errcode = 'P0001';
    end if;

    v_credits := v_credits - v_repay;
    v_new_loan := v_account.loan - v_repay;
    v_amount := v_repay;
    v_entry_type := 'loan_repaid';
    v_note := format('Kredit getilgt: %s Cr (Restschuld: %s Cr)', v_repay, v_new_loan);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set loan = v_new_loan, updated_at = now()
      where id = v_account.id;
  end if;

  insert into public.bank_ledger(
    profile_id, location_id, entry_type, amount, balance_after, note
  ) values (
    p_profile_id,
    p_location_id,
    v_entry_type,
    v_amount,
    case when p_action in ('deposit', 'withdraw') then v_new_deposit else v_new_loan end,
    v_note
  );

  return jsonb_build_object(
    'action', p_action,
    'amount', v_amount,
    'credits', v_credits,
    'deposit', v_new_deposit,
    'loan', v_new_loan
  );
end;
$$;

revoke all on function public.noxia_bank_mutation(uuid,uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.noxia_bank_mutation(uuid,uuid,text,integer,integer) to service_role;

-- Wer das Kreditmodul unter irgendeiner Kennung abgeschlossen hat, bekommt die
-- Freischaltung nachgetragen (idempotent).
insert into player_unlocks (id, profile_id, unlock_id, granted_at, source_module)
select gen_random_uuid(), ac.profile_id, 'UNL:NOX:bank-credit', now(), min(ac.module_id)
from academy_completions ac
where ac.module_id in ('ECO-L0-000001', 'LRN:SSF:ECO-L0-000001', 'LRN:SSF:ECO-L0-0001')
  and not exists (
    select 1 from player_unlocks pu
    where pu.profile_id = ac.profile_id and pu.unlock_id = 'UNL:NOX:bank-credit'
  )
group by ac.profile_id;

insert into player_unlocks (id, profile_id, unlock_id, granted_at, source_module)
select gen_random_uuid(), ac.profile_id, 'UNL:NOX:bank-compound', now(), min(ac.module_id)
from academy_completions ac
where ac.module_id in ('ECO-L0-000002', 'LRN:SSF:ECO-L0-000002', 'LRN:SSF:ECO-L0-0002')
  and not exists (
    select 1 from player_unlocks pu
    where pu.profile_id = ac.profile_id and pu.unlock_id = 'UNL:NOX:bank-compound'
  )
group by ac.profile_id;
