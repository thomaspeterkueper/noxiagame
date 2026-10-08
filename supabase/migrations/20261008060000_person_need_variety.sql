-- NOXIA-LIVING-0009 — need for variety.
-- Extends the allowed need codes and gives every person a starting value.
-- Until this is applied the engine treats variety as satisfied and nothing changes.

alter table public.person_needs drop constraint if exists person_needs_need_code_check;
alter table public.person_needs add constraint person_needs_need_code_check
  check (need_code in ('sustenance', 'rest', 'safety', 'social', 'purpose', 'variety'));

insert into public.person_needs (person_id, need_code, satisfaction)
select p.id, 'variety', 0.7
from public.people p
on conflict (person_id, need_code) do nothing;
