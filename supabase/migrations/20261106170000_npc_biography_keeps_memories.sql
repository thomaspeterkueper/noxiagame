-- 20261106170000_npc_biography_keeps_memories.sql
-- Thomas, 06.11.2026:
--  * „Erinnerungen an Gespräche mit echten Spielern sollen nicht einfach
--    verschwinden, nur weil der Spieler sich abgemeldet hat – das zerstört die
--    Biografie der NPCs.“
--  * „Warum verschwindet etwas, obwohl es wiederholt und wiederholt wird?“
--
-- 1. npc_player_conversation_memory: bei Kontolöschung bleibt die Erinnerung der
--    Figur erhalten; die Verbindung zum Konto wird gelöst (player_profile_id null,
--    detached_at gesetzt).
-- 2. npc_learned_claims: Quelle pseudonym über source_key (sha256 der Spieler-ID),
--    damit unabhängige Quellen auch nach einer Löschung zählbar bleiben; Konto-
--    Verbindung wird bei Löschung gelöst.
-- 3. Vergessen ab der letzten Erwähnung (last_heard_at, times_heard); Wiederholung
--    frischt auf. Festes Wissen (established) wird nie automatisch gelöscht.

set search_path to public;

-- 1. Persönliches Gedächtnis der Figuren --------------------------------------
alter table public.npc_player_conversation_memory add column if not exists detached_at timestamptz;
alter table public.npc_player_conversation_memory alter column player_profile_id drop not null;
alter table public.npc_player_conversation_memory drop constraint if exists npc_player_conversation_memory_player_profile_id_fkey;
alter table public.npc_player_conversation_memory
  add constraint npc_player_conversation_memory_player_profile_id_fkey
  foreign key (player_profile_id) references public.profiles(id) on delete set null;

create or replace function public.detach_npc_memories_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.npc_player_conversation_memory set detached_at = now() where player_profile_id = old.id;
  update public.npc_learned_claims set source_profile_id = null where source_profile_id = old.id;
  return old;
end;
$$;
drop trigger if exists detach_npc_memories_on_profile_delete on public.profiles;
create trigger detach_npc_memories_on_profile_delete
  before delete on public.profiles
  for each row execute function public.detach_npc_memories_on_profile_delete();
revoke all on function public.detach_npc_memories_on_profile_delete() from public, anon, authenticated;

-- 2./3. Gelerntes ------------------------------------------------------------
alter table public.npc_learned_claims add column if not exists source_key text;
update public.npc_learned_claims set source_key = encode(sha256(source_profile_id::text::bytea), 'hex') where source_key is null;
alter table public.npc_learned_claims alter column source_key set not null;
alter table public.npc_learned_claims add column if not exists last_heard_at timestamptz;
update public.npc_learned_claims set last_heard_at = created_at where last_heard_at is null;
alter table public.npc_learned_claims alter column last_heard_at set not null;
alter table public.npc_learned_claims alter column last_heard_at set default now();
alter table public.npc_learned_claims add column if not exists times_heard integer not null default 1;
alter table public.npc_learned_claims add column if not exists established boolean not null default false;

alter table public.npc_learned_claims alter column source_profile_id drop not null;
alter table public.npc_learned_claims drop constraint if exists npc_learned_claims_source_profile_id_fkey;
alter table public.npc_learned_claims
  add constraint npc_learned_claims_source_profile_id_fkey
  foreign key (source_profile_id) references auth.users(id) on delete set null;
alter table public.npc_learned_claims drop constraint if exists npc_learned_claims_npc_person_id_source_profile_id_claim_key;
alter table public.npc_learned_claims drop constraint if exists npc_learned_claims_npc_source_key_claim_key;
alter table public.npc_learned_claims add constraint npc_learned_claims_npc_source_key_claim_key unique (npc_person_id, source_key, claim);
create index if not exists npc_learned_claims_heard_idx on public.npc_learned_claims(npc_person_id, last_heard_at desc);

create or replace function public.remember_player_claim(
  p_npc_person_id uuid, p_source_profile_id uuid, p_source_key text,
  p_topic text, p_claim text, p_words text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.npc_learned_claims (npc_person_id, source_profile_id, source_key, topic, claim, words)
  values (p_npc_person_id, p_source_profile_id, p_source_key, p_topic, p_claim, coalesce(p_words, '{}'))
  on conflict (npc_person_id, source_key, claim)
  do update set last_heard_at = now(), times_heard = npc_learned_claims.times_heard + 1;
end;
$$;
revoke all on function public.remember_player_claim(uuid, uuid, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.remember_player_claim(uuid, uuid, text, text, text, text[]) to service_role;

-- Löschjob: Gelerntes erst 180 Tage nach der letzten Erwähnung, festes Wissen nie.
create or replace function public.purge_conversation_raw_text(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
  npc_rows integer;
  room_rows integer;
  report_rows integer;
  claim_rows integer;
begin
  update public.npc_conversation_log l
     set player_text = '', player_norm = '', npc_reply = null, text_purged_at = now()
   where l.created_at < cutoff
     and l.text_purged_at is null
     and not exists (select 1 from public.admin_profiles a where a.profile_id = l.player_profile_id);
  get diagnostics npc_rows = row_count;

  delete from public.player_room_messages m
   where m.created_at < cutoff
     and not exists (select 1 from public.admin_profiles a where a.profile_id = m.sender_id);
  get diagnostics room_rows = row_count;

  delete from public.conversation_reports r where r.expires_at < now();
  get diagnostics report_rows = row_count;

  delete from public.npc_learned_claims c
   where not c.established and c.last_heard_at < now() - interval '180 days';
  get diagnostics claim_rows = row_count;

  return jsonb_build_object('npc_turns_purged', npc_rows, 'room_messages_deleted', room_rows,
                            'reports_expired', report_rows, 'claims_forgotten', claim_rows, 'cutoff', cutoff);
end;
$$;
revoke all on function public.purge_conversation_raw_text(integer) from public, anon, authenticated;
grant execute on function public.purge_conversation_raw_text(integer) to service_role;

-- 4. Freundes-Chat im Schutzfilter (Berichte mit Quelle 'direct') --------------
alter table public.conversation_reports drop constraint if exists conversation_reports_source_check;
alter table public.conversation_reports add constraint conversation_reports_source_check
  check (source in ('npc', 'room', 'direct'));
