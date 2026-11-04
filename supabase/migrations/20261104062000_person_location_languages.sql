-- NOXIA-LIVING-0014: persistent person/location language competence.
-- Language is explicit biographical/world data and must never be inferred from
-- names, appearance or ethnicity.
create table if not exists public.person_languages (
  person_id uuid not null references public.people(id) on delete cascade,
  language_code text not null,
  proficiency double precision not null default 0 check (proficiency >= 0 and proficiency <= 1),
  is_native boolean not null default false,
  comprehension double precision check (comprehension is null or (comprehension >= 0 and comprehension <= 1)),
  production double precision check (production is null or (production >= 0 and production <= 1)),
  grammar double precision check (grammar is null or (grammar >= 0 and grammar <= 1)),
  vocabulary double precision check (vocabulary is null or (vocabulary >= 0 and vocabulary <= 1)),
  pragmatic_skill double precision check (pragmatic_skill is null or (pragmatic_skill >= 0 and pragmatic_skill <= 1)),
  phoneme_discrimination double precision check (phoneme_discrimination is null or (phoneme_discrimination >= 0 and phoneme_discrimination <= 1)),
  learned_from text,
  updated_at timestamptz not null default now(),
  primary key (person_id, language_code),
  check (char_length(language_code) between 2 and 48)
);

create index if not exists person_languages_language_idx
  on public.person_languages(language_code, proficiency desc);

create table if not exists public.location_languages (
  location_id uuid not null references public.locations(id) on delete cascade,
  language_code text not null,
  share double precision not null check (share >= 0 and share <= 1),
  source_kind text,
  updated_at timestamptz not null default now(),
  primary key (location_id, language_code),
  check (char_length(language_code) between 2 and 48)
);

create index if not exists location_languages_language_idx
  on public.location_languages(language_code, share desc);

alter table public.person_languages enable row level security;
alter table public.location_languages enable row level security;

revoke all on public.person_languages from anon, authenticated;
revoke all on public.location_languages from anon, authenticated;
grant select, insert, update, delete on public.person_languages, public.location_languages to service_role;

-- No browser policies in v0.1. Language data is read by server-side game APIs
-- using service_role and projected to clients only as needed.
