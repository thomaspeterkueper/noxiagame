-- 20261105110000_safety_filter_and_learning.sql
-- NOXIA-SAFETY-0001 (Thomas, 05.11.2026): Schutzfilter gegen Absprachen realer
-- Straftaten. Bei Verdacht wird der Ausschnitt als Bericht gesichert (origin
-- 'filter') – nur diese Kopie ist für Menschen lesbar und von der 14-Tage-
-- Löschung des Wortlauts ausgenommen.
-- NOXIA-LEARN-0001: Figuren behalten Aussagen anderer Spieler über die Welt als
-- Gehörtes (npc_learned_claims). Vergessen gestuft, nicht pauschal.

set search_path to public;

-- 1. Berichte: von Spielern oder vom Schutzfilter ------------------------------
alter table public.conversation_reports alter column reporter_profile_id drop not null;
alter table public.conversation_reports add column if not exists origin text not null default 'player';
alter table public.conversation_reports add column if not exists subject_profile_id uuid references auth.users(id) on delete set null;
alter table public.conversation_reports add column if not exists signals text[] not null default '{}';
alter table public.conversation_reports drop constraint if exists conversation_reports_reason_check;
alter table public.conversation_reports add constraint conversation_reports_reason_check
  check (reason in ('error', 'harassment', 'feedback', 'other', 'safety'));
alter table public.conversation_reports drop constraint if exists conversation_reports_origin_check;
alter table public.conversation_reports add constraint conversation_reports_origin_check
  check (origin in ('player', 'filter'));
alter table public.conversation_reports drop constraint if exists conversation_reports_reporter_check;
alter table public.conversation_reports add constraint conversation_reports_reporter_check
  check (origin = 'filter' or reporter_profile_id is not null);
create index if not exists conversation_reports_subject_idx on public.conversation_reports(subject_profile_id, created_at desc);

-- 2. Kennzeichen am Gesprächsprotokoll (ohne Wortlaut, bleiben nach der Löschung)
alter table public.npc_conversation_log add column if not exists safety_flags text[] not null default '{}';

-- 3. Gelerntes von Spielern ----------------------------------------------------
create table if not exists public.npc_learned_claims (
  id bigint generated always as identity primary key,
  npc_person_id uuid not null references public.people(id) on delete cascade,
  source_profile_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  claim text not null check (length(claim) between 1 and 200),
  words text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (npc_person_id, source_profile_id, claim)
);
create index if not exists npc_learned_claims_npc_idx on public.npc_learned_claims(npc_person_id, created_at desc);
alter table public.npc_learned_claims enable row level security;
revoke all on public.npc_learned_claims from public, anon, authenticated;
grant select, insert, update, delete on public.npc_learned_claims to service_role;

-- 4. Wunschsicht ohne Wortlaut-Beispiele ---------------------------------------
drop view if exists public.player_feature_wishes;
create view public.player_feature_wishes
with (security_invoker = on) as
with hits as (
  select l.*, r.wish_key
    from public.npc_conversation_log l
    left join lateral (
      select r.wish_key from public.player_feature_wish_reviews r
       where exists (select 1 from unnest(r.matches) m where l.wish_object ilike m)
       order by r.wish_key limit 1
    ) r on true
   where l.wish_object is not null
)
select coalesce(h.wish_key, h.wish_object)                    as wish,
       h.wish_key is not null                                 as reviewed,
       rv.recommendation, rv.decision, rv.title,
       count(*)                                               as mentions,
       count(distinct h.player_profile_id)                    as players,
       count(*) filter (where h.wish_npc_denied)              as npc_denied,
       count(*) filter (where h.topic = 'provocation')        as provocations,
       array_agg(distinct h.wish_kind)                        as kinds,
       array_agg(distinct h.location_name) filter (where h.location_name is not null) as places,
       min(h.created_at) as first_at, max(h.created_at) as last_at
  from hits h
  left join public.player_feature_wish_reviews rv on rv.wish_key = h.wish_key
 group by 1, 2, 3, 4, 5
 order by reviewed, players desc, mentions desc, last_at desc;
revoke all on public.player_feature_wishes from public, anon, authenticated;
grant select on public.player_feature_wishes to service_role;

-- 5. Löschjob: Gelerntes über 180 Tage entfernen -------------------------------
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

  delete from public.npc_learned_claims c where c.created_at < now() - interval '180 days';
  get diagnostics claim_rows = row_count;

  return jsonb_build_object('npc_turns_purged', npc_rows, 'room_messages_deleted', room_rows,
                            'reports_expired', report_rows, 'claims_forgotten', claim_rows, 'cutoff', cutoff);
end;
$$;
revoke all on function public.purge_conversation_raw_text(integer) from public, anon, authenticated;
grant execute on function public.purge_conversation_raw_text(integer) to service_role;
