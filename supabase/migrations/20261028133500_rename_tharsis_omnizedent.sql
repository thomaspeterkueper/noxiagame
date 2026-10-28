-- NOXIA-NPC-RELIGION-0002: Thomas (28.10.2026) – der Tharsis-Omnizedent heißt Theodor Grün.
-- Person-Key bleibt stabil; nur Anzeigename von Person und persönlichem Wirtschaftsakteur.
update public.people
set display_name='Theodor Grün', updated_at=now()
where person_key='mars-tharsis-omnizedent-001' and display_name<>'Theodor Grün';

update public.actors a
set display_name='Theodor Grün'
from public.person_economic_actors pea
join public.people p on p.id=pea.person_id
where a.id=pea.actor_id and p.person_key='mars-tharsis-omnizedent-001' and a.display_name<>'Theodor Grün';
