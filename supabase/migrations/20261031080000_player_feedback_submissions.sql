-- NOXIA-FEEDBACK-INTAKE-0001: durable intake, NOT an authorization to publish,
-- moderate, vote, change parcels, or emit Core events.
-- Versioned migration for review only; do not apply to production automatically.
--
-- owner_user_id is the verified Supabase Auth user id (auth.uid()), NOT a
-- client-supplied profile id. Only the authenticated server/service_role may
-- insert and later moderate. The authenticated Data API may read four receipt
-- columns of its OWN rows, never private provenance or full submission text.

create table public.player_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null default 'development'
    check (destination in ('development', 'world_initiative')),
  category text not null
    check (category in ('idea', 'problem', 'building', 'profession', 'technology', 'gameplay', 'other')),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 5000),
  location_hint text check (location_hint is null or char_length(location_hint) <= 200),
  requested_visibility text not null default 'private'
    check (requested_visibility in ('private', 'public')),
  publication_consent boolean not null default false,
  source_kind text not null check (source_kind in ('direct', 'conversation')),
  private_source_ref text,
  status text not null default 'submitted_for_review'
    check (status in (
      'submitted_for_review', 'under_review', 'needs_information',
      'accepted_for_planning', 'declined', 'closed'
    )),
  idempotency_key text not null
    check (idempotency_key ~ '^[a-zA-Z0-9_-]{16,128}$'),
  payload_fingerprint text not null
    check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_feedback_public_requires_consent
    check (requested_visibility <> 'public' or publication_consent),
  constraint player_feedback_source_ref_consistency
    check (
      (source_kind = 'direct' and private_source_ref is null)
      or
      (source_kind = 'conversation' and
        private_source_ref is not null and
        private_source_ref ~ '^npc_conversation_log:[1-9][0-9]{0,18}$')
    ),
  constraint player_feedback_owner_idempotency_unique
    unique (owner_user_id, idempotency_key)
);

create index player_feedback_owner_created_idx
  on public.player_feedback_submissions (owner_user_id, created_at desc, id desc);

alter table public.player_feedback_submissions enable row level security;

-- The table is NOT a public inbox. Service role writes are guarded by the API.
-- No authenticated INSERT, UPDATE or DELETE: in particular clients cannot
-- spoof owner, mark a proposal accepted, or alter private provenance.
revoke all on table public.player_feedback_submissions from public, anon, authenticated;
grant select (id, title, status, created_at)
  on table public.player_feedback_submissions to authenticated;
grant select, insert, update, delete
  on table public.player_feedback_submissions to service_role;

create policy player_feedback_owner_receipts_select
  on public.player_feedback_submissions
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

comment on table public.player_feedback_submissions is
  'Private, review-only NOXIA player feedback. No automatic civic authority or Core/world mutations.';
comment on column public.player_feedback_submissions.private_source_ref is
  'Server-verified NPC conversation provenance; never returned by public/player receipt APIs.';
comment on column public.player_feedback_submissions.requested_visibility is
  'User preference only. Publication requires a separate moderation and consent process.';

-- Atomic per-owner abuse guard: at most five NEW submissions in any rolling hour.
-- Transaction advisory lock serializes concurrent inserts for the same owner.
-- Existing idempotency keys bypass the cap so a concurrent retry can resolve
-- through the unique constraint and return its original receipt.
create function public.enforce_player_feedback_insert_rate()
returns trigger
language plpgsql security definer
set search_path = ''
as $feedback_rate$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_user_id::text, 0)
  );
  if exists (
    select 1 from public.player_feedback_submissions
    where owner_user_id = new.owner_user_id
      and idempotency_key = new.idempotency_key
  ) then
    return new;
  end if;
  if (
    select count(*) from public.player_feedback_submissions
    where owner_user_id = new.owner_user_id
      and created_at > pg_catalog.now() - interval '1 hour'
  ) >= 5 then
    raise exception 'feedback_rate_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$feedback_rate$;

revoke all on function public.enforce_player_feedback_insert_rate()
  from public, anon, authenticated;

create trigger player_feedback_insert_rate_guard
before insert on public.player_feedback_submissions
for each row execute function public.enforce_player_feedback_insert_rate();
