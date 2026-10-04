-- NOXIA-LIVING — persistent person appearance and presentation.
-- Identity, visible presentation, clothing and heritage remain separate concepts.

set search_path to public;

create table if not exists public.person_appearance (
  person_id uuid primary key references public.people(id) on delete cascade,
  gender_identity text
    check (gender_identity is null or gender_identity in ('woman','man','nonbinary','other','unspecified')),
  gender_presentation text not null default 'androgynous'
    check (gender_presentation in ('feminine','masculine','androgynous')),
  body_frame text not null default 'average'
    check (body_frame in ('slender','average','broad')),
  skin_tone_code text not null default 'skin_3',
  hair_style_code text not null default 'short',
  hair_color_code text not null default 'dark',
  facial_hair_code text not null default 'none',
  visible_age_band text not null default 'adult'
    check (visible_age_band in ('child','teen','young_adult','adult','older')),
  clothing_profile jsonb not null default '{}'::jsonb,
  cultural_heritage jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.person_appearance enable row level security;
drop policy if exists person_appearance_service on public.person_appearance;
create policy person_appearance_service on public.person_appearance
  for all to service_role using (true) with check (true);

revoke all on public.person_appearance from anon, authenticated;
grant all on public.person_appearance to service_role;

-- Existing people receive deterministic visible presentation only.
-- This does NOT infer or assign gender identity.
insert into public.person_appearance (
  person_id,
  gender_identity,
  gender_presentation,
  body_frame,
  skin_tone_code,
  hair_style_code,
  hair_color_code,
  facial_hair_code,
  visible_age_band
)
select
  p.id,
  null,
  case
    when mod(abs(hashtextextended(p.id::text, 11)), 20) = 0 then 'androgynous'
    when mod(abs(hashtextextended(p.id::text, 11)), 2) = 0 then 'feminine'
    else 'masculine'
  end,
  case mod(abs(hashtextextended(p.id::text, 23)), 3)
    when 0 then 'slender'
    when 1 then 'average'
    else 'broad'
  end,
  'skin_' || (1 + mod(abs(hashtextextended(p.id::text, 37)), 6))::text,
  case mod(abs(hashtextextended(p.id::text, 41)), 5)
    when 0 then 'short'
    when 1 then 'long'
    when 2 then 'curly'
    when 3 then 'braided'
    else 'shaved'
  end,
  case mod(abs(hashtextextended(p.id::text, 43)), 5)
    when 0 then 'dark'
    when 1 then 'brown'
    when 2 then 'light'
    when 3 then 'red'
    else 'grey'
  end,
  case
    when mod(abs(hashtextextended(p.id::text, 47)), 5) = 0 then 'short'
    else 'none'
  end,
  case
    when pls.life_stage = 'child' then 'child'
    else 'adult'
  end
from public.people p
left join public.person_life_state pls on pls.person_id = p.id
on conflict (person_id) do nothing;
