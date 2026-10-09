-- One shared DaVaRu destination; remote sessions never update physical presence.
create table if not exists public.davaru_temple_remote_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  destination_key text not null default 'davaru-temple'
    check (destination_key = 'davaru-temple'),
  channel text not null check (channel in ('endia','adventure_park')),
  room_id text not null default 'entrance'
    check (room_id in ('entrance','conversation','library','garden')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create index if not exists davaru_temple_remote_sessions_expiry
  on public.davaru_temple_remote_sessions(expires_at);
alter table public.davaru_temple_remote_sessions enable row level security;
revoke all on public.davaru_temple_remote_sessions from anon, authenticated;
grant select, insert, update, delete on public.davaru_temple_remote_sessions to service_role;
comment on table public.davaru_temple_remote_sessions is
  'Authenticated virtual visitors to the single DaVaRu destination; separate from physical location, movement and NPC presence.';
