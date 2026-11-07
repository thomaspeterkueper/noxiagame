-- First explicit language biography seed.
-- Source: people.bio_short explicitly states that Yusuf Demir speaks German,
-- Turkish and Arabic. It does NOT state which language is native or primary,
-- so all three remain non-native here and use a conservative functional level.

insert into public.person_languages (
  person_id,
  language_code,
  proficiency,
  is_native,
  comprehension,
  production,
  grammar,
  vocabulary,
  pragmatic_skill,
  phoneme_discrimination,
  learned_from,
  updated_at
)
select
  p.id,
  lang.language_code,
  0.65,
  false,
  0.65,
  0.65,
  0.65,
  0.65,
  0.65,
  0.65,
  'bio_explicit_language_list:level_unspecified',
  now()
from public.people p
cross join (values ('de'), ('tr'), ('ar')) as lang(language_code)
where p.person_key = 'earth-frankfurt-hamidiye-imam-001'
  and coalesce(p.bio_short, '') ilike '%spricht Deutsch, Türkisch und Arabisch%'
on conflict (person_id, language_code) do update set
  proficiency = excluded.proficiency,
  is_native = excluded.is_native,
  comprehension = excluded.comprehension,
  production = excluded.production,
  grammar = excluded.grammar,
  vocabulary = excluded.vocabulary,
  pragmatic_skill = excluded.pragmatic_skill,
  phoneme_discrimination = excluded.phoneme_discrimination,
  learned_from = excluded.learned_from,
  updated_at = excluded.updated_at;
