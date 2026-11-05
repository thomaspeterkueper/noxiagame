-- Explicit, revocable consent for administrator viewing verbatim conversation logs.
-- Existing logs are NEVER unlocked retroactively: granted_at is the lower timestamp bound.
create table if not exists public.player_conversation_diagnostic_consent (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint consent_grant_consistency check (not enabled or granted_at is not null)
);
alter table public.player_conversation_diagnostic_consent enable row level security;
revoke all on public.player_conversation_diagnostic_consent from public, anon, authenticated;
grant select, insert, update on public.player_conversation_diagnostic_consent to service_role;

create table if not exists public.admin_conversation_read_audit (
  id bigint generated always as identity primary key,
  admin_profile_id uuid not null references auth.users(id),
  profile_id uuid not null references auth.users(id),
  conversation_log_id uuid not null,
  accessed_at timestamptz not null default now()
);
create index if not exists admin_conversation_read_audit_at_idx
  on public.admin_conversation_read_audit(accessed_at desc);
alter table public.admin_conversation_read_audit enable row level security;
revoke all on public.admin_conversation_read_audit from public, anon, authenticated;
grant select, insert on public.admin_conversation_read_audit to service_role;
