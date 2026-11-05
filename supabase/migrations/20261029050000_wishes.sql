-- Wünsche und Gebete, die die Welt erhört (Thomas, 29.10.2026), siehe lib/game/wishes/rules.ts.
-- Nur der Server liest und schreibt (Service-Rolle); Spieler sehen fremde Wünsche nie.

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tick bigint,
  source text not null check (source in ('player', 'npc')),
  profile_id uuid references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  channel text not null check (channel in ('fuerbitte', 'gespraech', 'resonanz', 'wunschbrunnen', 'figur')),
  place_ref text,
  place_name text,
  tradition text,
  text text not null check (char_length(text) between 1 and 400),
  status text not null default 'neu' check (status in ('neu', 'privat', 'abgelehnt', 'sammelt', 'erfuellt', 'in_arbeit', 'angenommen')),
  category text,
  summary text,
  cluster_key text,
  sense real,
  assessment jsonb not null default '{}'::jsonb,
  reason text,
  decided_by text check (decided_by in ('spiel', 'admin')),
  decided_at timestamptz,
  fulfilment jsonb,
  fulfilled_at timestamptz,
  admin_note text,
  updated_at timestamptz not null default now()
);

alter table public.wishes enable row level security;
create index if not exists wishes_status_idx on public.wishes (status, created_at desc);
create index if not exists wishes_cluster_idx on public.wishes (cluster_key, created_at desc);
create index if not exists wishes_profile_idx on public.wishes (profile_id, created_at desc);

-- Wer den Admin-Bereich sehen darf (Wünsche ansehen, ablehnen, anpassen).
create table if not exists public.admin_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admin_profiles enable row level security;

-- Thomas' Konten: Aristeas, Thomas, McKnight
insert into public.admin_profiles (profile_id, note)
select id, 'Thomas' from public.profiles
where id in ('2bebaa83-1b2e-4217-8959-6953e863aa8c', '27aec8ad-a035-4af6-8cf5-cd13575c8409', '1838fbc7-80e3-4b10-8ddf-da966257d183')
on conflict (profile_id) do nothing;

grant select, insert, update, delete on public.wishes, public.admin_profiles to service_role;
