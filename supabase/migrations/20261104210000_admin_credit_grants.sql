-- Administrativ ausgegebene Test-Credits: getrennt von Spielertransfers.
create table if not exists public.admin_credit_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  admin_profile_id uuid not null references auth.users(id),
  player_profile_id uuid not null references public.profiles(id),
  amount integer not null check (amount between 1 and 5000),
  previous_balance integer not null,
  new_balance integer not null,
  reason text not null check (char_length(reason) between 5 and 200),
  created_at timestamptz not null default now()
);
create index if not exists admin_credit_grants_player_created_idx
  on public.admin_credit_grants(player_profile_id, created_at desc);
alter table public.admin_credit_grants enable row level security;
revoke all on table public.admin_credit_grants from public, anon, authenticated;
grant select, insert on table public.admin_credit_grants to service_role;

create or replace function public.noxia_admin_grant_credits(
  p_admin uuid, p_player uuid, p_amount integer, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_old integer;
  v_new integer;
  v_id uuid;
  v_prior public.admin_credit_grants%rowtype;
begin
  if p_admin is null or p_player is null or p_request_id is null
     or p_amount is null or p_amount < 1 or p_amount > 5000
     or p_reason is null or char_length(btrim(p_reason)) < 5
     or char_length(p_reason) > 200 then
    raise exception 'Invalid credit grant arguments';
  end if;
  if p_admin = p_player then
    raise exception 'Admin cannot grant credits to own profile';
  end if;
  if not exists (select 1 from public.admin_profiles where profile_id = p_admin) then
    raise exception 'Not authorized as admin';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.admin_credit_grants where request_id = p_request_id;
  if found then
    if v_prior.admin_profile_id <> p_admin or v_prior.player_profile_id <> p_player
       or v_prior.amount <> p_amount or v_prior.reason <> btrim(p_reason) then
      raise exception 'Request ID reused with different values';
    end if;
    return jsonb_build_object('grant_id',v_prior.id,'new_balance',v_prior.new_balance,'duplicate',true);
  end if;

  select credits into v_old from public.profiles where id = p_player for update;
  if not found then raise exception 'Player profile not found'; end if;
  if v_old > 2147483647 - p_amount then raise exception 'Credit balance limit exceeded'; end if;
  v_new := v_old + p_amount;
  update public.profiles set credits = v_new where id = p_player;
  insert into public.admin_credit_grants
    (request_id,admin_profile_id,player_profile_id,amount,previous_balance,new_balance,reason)
  values (p_request_id,p_admin,p_player,p_amount,v_old,v_new,btrim(p_reason))
  returning id into v_id;
  return jsonb_build_object('grant_id',v_id,'new_balance',v_new,'duplicate',false);
end;
$$;
revoke execute on function public.noxia_admin_grant_credits(uuid,uuid,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_admin_grant_credits(uuid,uuid,integer,text,uuid)
  to service_role;
