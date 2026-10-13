# REQ-NOXIA-20261013 – Alte Straßenstücke der Erdkarte löschen

Status: done  
Repository: noxiagame  
Scope: Earth / Prototyp „eine Welt“ (`docs/workstreams/world-map.md`)  
Priority: Normal  
Type: Internal Request  
Für: Thomas (Löschbefehle an die Datenbank kommen aus der Claude-Umgebung nicht durch)

## Beschluss (Thomas, 13.10.2026)

- Die vier Straßenstücke aus dem alten Bausystem löschen, samt ihren abgeschlossenen Bauaufträgen.
- Die leeren Ortseinträge gescheiterter Kartenabrufe **stehen lassen** – sie zeigen, welche Orte noch in die Karte gehören (siehe Aufgabe 11 in `world-map.md`).
- Alle übrigen NOXIA-Gebäude stehen lassen.
- Die zwei Wohnblöcke ohne Koordinaten löschen; die vier Bewohner ziehen vorher um (siehe unten).

Geprüft: Auf die Straßenstücke verweist nichts (keine Kinder, Konzessionen, Bewohner, Wartung, Versorgung, Schiffe). Sicherung aller Kennungen und Koordinaten: `docs/cleanup/2026-10-13-erdkarte-altlasten.md`.

## SQL – im Supabase-SQL-Editor ausführen

```sql
begin;
delete from tile_entities
 where entity_id = 'road'
   and id in ('fdd233f9-63fb-47ec-8b5a-9d6db1f1e6de','11849775-6bf2-479b-bd64-27079ebd2b98',
              'ce2f34d6-2680-487d-89c9-6bf33348f5b5','23b880f2-b003-4f63-9705-94e81559775e');
delete from player_builds
 where buildable_id = 'road' and status = 'complete'
   and id in ('5efe1b40-c3fc-446b-9614-abed3edcd83c','e5c4f849-4690-42b8-9636-fe552bc41f3f',
              'f96295b5-bfb7-4674-8cac-18807e560052','5a7a8238-01df-4edd-8389-86b09e2b5807');
commit;

-- Prüfen: beide Werte 0
select (select count(*) from tile_entities where entity_id = 'road') as strassen,
       (select count(*) from player_builds where buildable_id = 'road') as bauauftraege;
```

## Wohnblöcke ohne Koordinaten: Bewohner umziehen, dann löschen (Thomas, 13.10.2026)

| id | Konto | Bewohner |
|---|---|---|
| 8d697841-df03-44b8-9101-b7d19a82c588 | Thomas | 4 Figuren mit aktivem Zuhause (Mietverhältnis „provided“, Vermieter Thomas) |
| afab5749-fd05-42a1-8c48-4f49b65fa234 | McKnight | keine |

Neues Zuhause der vier: der leere Wohnblock von McKnight in Sundern (`5662262e-1b12-44c6-a11c-060ff06366c1`, 51,33057 / 8,00830, Platz für 12). Wie bisher frei gestellt („provided“), Vermieter ist jetzt McKnight (`c0259ff6-…`). Der Umzug folgt dem Muster von `move_person_to_market_rental`: altes Zuhause und Mietverhältnis beenden, neues anlegen – in einer Transaktion. Danach werden beide Blöcke ohne Koordinaten gelöscht; die Anwesenheit drinnen fällt dabei mit weg.

```sql
begin;

-- 1. Umzug der Bewohner
do $$
declare
  v_old uuid := '8d697841-df03-44b8-9101-b7d19a82c588';
  v_new uuid := '5662262e-1b12-44c6-a11c-060ff06366c1';
  v_landlord uuid := 'c0259ff6-b80f-45bb-932f-6cedbc8c6cf8';
  v_location uuid;
  v_cap int;
  v_moving int;
  r record;
  v_assignment uuid;
begin
  select location_id, residential_capacity into v_location, v_cap
    from tile_entities where id = v_new and status = 'active' for update;
  if v_location is null then raise exception 'Zielhaus fehlt'; end if;
  select count(*) into v_moving from person_assignments where tile_entity_id = v_old and assignment_type = 'home' and is_active;
  if v_moving + (select count(*) from person_assignments where tile_entity_id = v_new and assignment_type = 'home' and is_active) > v_cap then
    raise exception 'Zielhaus zu klein';
  end if;
  for r in select id, person_id from person_assignments where tile_entity_id = v_old and assignment_type = 'home' and is_active loop
    update person_assignments set is_active = false, updated_at = now() where id = r.id;
    update person_tenancies set status = 'ended', updated_at = now() where assignment_id = r.id and status <> 'ended';
    insert into person_assignments(person_id, assignment_type, location_id, tile_entity_id, role_code, is_active)
      values (r.person_id, 'home', v_location, v_new, 'resident', true) returning id into v_assignment;
    insert into person_tenancies(assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
      rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure)
      values (v_assignment, r.person_id, v_location, v_new, v_landlord, null, 720, null, 'provided', 'provided', 'provided');
  end loop;
end $$;

-- 2. Beide Blöcke ohne Koordinaten löschen – nur, wenn niemand mehr dort wohnt
delete from tile_entities t
 where t.id in ('8d697841-df03-44b8-9101-b7d19a82c588','afab5749-fd05-42a1-8c48-4f49b65fa234')
   and t.entity_id = 'residential_block' and t.latitude_deg is null
   and not exists (select 1 from person_assignments a where a.tile_entity_id = t.id and a.assignment_type = 'home' and a.is_active);

commit;

-- Prüfen: 4 Bewohner im neuen Haus, 0 alte Blöcke
select (select count(*) from person_assignments where tile_entity_id = '5662262e-1b12-44c6-a11c-060ff06366c1' and assignment_type = 'home' and is_active) as bewohner_neu,
       (select count(*) from tile_entities where id in ('8d697841-df03-44b8-9101-b7d19a82c588','afab5749-fd05-42a1-8c48-4f49b65fa234')) as alte_bloecke;
```

Hinweis für das Teilprojekt Bevölkerung: Die beendeten Zuhause bleiben als `is_active = false` und Mietverhältnis `ended` erhalten; ihr `tile_entity_id` wird beim Löschen des Blocks auf leer gesetzt.

## Erledigt, wenn

Beide Prüfabfragen stimmen (Straßen 0/0; Bewohner 4, alte Blöcke 0). Dann diese Datei nach `internal-tasks/done/` verschieben.


## Abschluss

Ausgeführt am 13.10.2026 gegen die Produktionsdatenbank. Prüfergebnisse: Straßen 0, Bauaufträge 0, Bewohner im neuen Haus 4, alte koordinatenlose Wohnblöcke 0.
