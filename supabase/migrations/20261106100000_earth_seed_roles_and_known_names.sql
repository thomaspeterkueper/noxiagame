-- 06.11.2026 — Spieltest: „Victor Chen“ / „Viktor Gellert“ und Mars-Begriffe in Rollen auf der Erde.
--
-- 1. Bekannte Namen: player_person_identity_knowledge.known_name ist eine Kopie von
--    people.display_name beim Kennenlernen. Nach der Umbenennung von Victor Chen in
--    Viktor Gellert blieb die Kopie alt. Die Anzeige liest jetzt den aktuellen Namen
--    (currentKnownName); hier werden die alten Kopien nachgezogen.
update public.player_person_identity_knowledge k
set known_name = p.display_name
from public.people p
where p.id = k.person_id
  and k.identity_state = 'known'
  and k.known_name is distinct from p.display_name;

-- 2. Rollen der vier ersten Erd-Bewohner (Seed 28.08.2026) trugen den internen Ortsnamen
--    „Tharsis Hub Sauerland“ – im Gespräch klang das nach Mars. Der Ortsname bleibt intern;
--    Rolle und Kurzbio nennen Sundern. Keine erfundenen Gebäudenamen.
do $$
declare
  v_earth uuid := '08b6feff-e1d8-48d8-bb65-dbcff4490587';
begin
  update public.people set
    public_role = 'Bildung · Sundern',
    bio_short = 'Arbeitet in der Bildung in Sundern, Anfang 30. Ihre Eltern stammen aus Südafrika.'
  where current_location_id = v_earth and display_name = 'Amara Ndlovu' and public_role = 'Bildung · Tharsis Hub Sauerland';

  update public.people set
    public_role = 'Verwaltung · Sundern',
    bio_short = 'Arbeitet in der Verwaltung der öffentlichen Dienste in Sundern. Hat dort einen stabilen Wohn- und Arbeitsalltag.'
  where current_location_id = v_earth and display_name = 'Viktor Gellert' and public_role = 'Verwaltung · Tharsis Hub Sauerland';

  update public.people set
    public_role = 'Logistik · Sundern',
    bio_short = 'Arbeitet in der Logistik der öffentlichen Dienste in Sundern. Hat dort einen stabilen Wohn- und Arbeitsalltag.'
  where current_location_id = v_earth and display_name = 'Hana Moreau' and public_role = 'Logistik · Tharsis Hub Sauerland';

  update public.people set
    public_role = 'Ingenieur/in · Sundern',
    bio_short = 'Arbeitet als Ingenieur/in für die öffentlichen Dienste in Sundern. Hat dort einen stabilen Wohn- und Arbeitsalltag.'
  where current_location_id = v_earth and display_name = 'Jules Martens' and public_role = 'Ingenieur/in · Tharsis Hub Sauerland';
end $$;
