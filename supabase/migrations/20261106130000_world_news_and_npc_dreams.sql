-- 06.11.2026 — NOXIA-LIVING-0016, Schritte 1 und 2: regionale Meldungen und Träume.
--
-- world_news_items: Anreißer öffentlicher Feeds je Region (nur Titel, Link, ein Satz).
-- world_news_source_status: letzter Abruf je Quelle (ob die Feed-Adresse stimmt).
-- npc_dreams: ein Traum je Figur und Nacht; die meisten unterbewusst (recall = 'none').
-- Alles nur für den Server (service_role); keine Policies für Spieler.

create table if not exists public.world_news_items (
  id text primary key,
  source_id text not null,
  region text not null check (region in ('de', 'de-nrw', 'space')),
  title text not null,
  teaser text not null default '',
  url text not null,
  published_at timestamptz not null,
  topics text[] not null default '{}',
  dream_ok boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index if not exists world_news_items_region_published on public.world_news_items (region, published_at desc);
alter table public.world_news_items enable row level security;

create table if not exists public.world_news_source_status (
  source_id text primary key,
  checked_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_count integer not null default 0,
  last_error text
);
alter table public.world_news_source_status enable row level security;

create table if not exists public.npc_dreams (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  night date not null,
  tick integer not null,
  intensity numeric(4,3) not null check (intensity >= 0 and intensity <= 1),
  recall text not null check (recall in ('none', 'fragment', 'clear')),
  tellable boolean not null default false,
  motifs text[] not null default '{}',
  news_item_id text references public.world_news_items(id) on delete set null,
  sources jsonb not null default '{}'::jsonb,
  canonical boolean not null default false check (canonical = false),
  created_at timestamptz not null default now(),
  unique (person_id, night)
);
create index if not exists npc_dreams_person_created on public.npc_dreams (person_id, created_at desc);
alter table public.npc_dreams enable row level security;

grant select, insert, update, delete on public.world_news_items, public.world_news_source_status, public.npc_dreams to service_role;
