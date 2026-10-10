-- Prüft move_person_to_public_housing gegen den echten Bestand und hinterlässt nichts:
-- der Block endet immer mit einer Ausnahme, die alles zurückrollt.
-- Erwartete Abschlussmeldung: NOXIA_TEST_OK ... (alles andere ist ein Fehler).
-- Als service_role bzw. im SQL-Editor ausführen.

do $$
declare
  v_person uuid;
  v_other_person uuid;
  v_tile public.tile_entities%rowtype;
  v_foreign_tile uuid;
  v_private_tile uuid;
  v_filler uuid;
  v_free integer;
  v_results text := '';
  v_err text;
begin
  -- Eine Person ohne Wohnung und ein staatliches Wohngebäude an ihrem Ort.
  select p.id into v_person
  from public.people p
  where not exists (select 1 from public.person_assignments a where a.person_id=p.id and a.assignment_type='home' and a.is_active)
  order by p.id limit 1;
  if v_person is null then raise exception 'NOXIA_TEST_SKIPPED: keine Person ohne Wohnung'; end if;

  select te.* into v_tile
  from public.tile_entities te
  join public.people p on p.id=v_person and p.current_location_id=te.location_id
  where te.owner_class='STATE' and te.entity_type='building' and te.status='active' and te.residential_capacity>0
  order by te.id limit 1;
  if not found then raise exception 'NOXIA_TEST_SKIPPED: kein staatliches Wohngebäude am Ort'; end if;

  -- 1. Fremder Standort
  select te.id into v_foreign_tile from public.tile_entities te
  where te.owner_class='STATE' and te.entity_type='building' and te.status='active' and te.residential_capacity>0 and te.location_id<>v_tile.location_id
  order by te.id limit 1;
  if v_foreign_tile is not null then
    begin
      perform public.move_person_to_public_housing(v_person, v_foreign_tile, 0);
      v_results := v_results || ' FAIL:other_location_accepted';
    exception when others then
      get stacked diagnostics v_err = message_text;
      v_results := v_results || case when v_err='NOXIA_PUBLIC_HOUSING_OTHER_LOCATION' then ' ok:other_location' else ' FAIL:other_location=' || v_err end;
    end;
  end if;

  -- 2. Privates Gebäude
  select te.id into v_private_tile from public.tile_entities te
  where te.owner_class='PLAYER' and te.entity_type='building' and te.status='active' and te.residential_capacity>0
  order by te.id limit 1;
  if v_private_tile is not null then
    begin
      perform public.move_person_to_public_housing(v_person, v_private_tile, 0);
      v_results := v_results || ' FAIL:private_accepted';
    exception when others then
      get stacked diagnostics v_err = message_text;
      v_results := v_results || case when v_err='NOXIA_PUBLIC_HOUSING_NOT_PUBLIC' then ' ok:not_public' else ' FAIL:not_public=' || v_err end;
    end;
  end if;

  -- 3. Volles Gebäude: freie Plätze mit Testpersonen füllen, dann muss der Einzug scheitern.
  select v_tile.residential_capacity - count(*) into v_free
  from public.person_assignments where tile_entity_id=v_tile.id and assignment_type='home' and is_active;
  for i in 1..v_free loop
    insert into public.people(display_name, current_location_id) values ('Test Füller ' || i, v_tile.location_id) returning id into v_filler;
    perform public.move_person_to_public_housing(v_filler, v_tile.id, 0);
  end loop;
  begin
    perform public.move_person_to_public_housing(v_person, v_tile.id, 0);
    v_results := v_results || ' FAIL:full_accepted';
  exception when others then
    get stacked diagnostics v_err = message_text;
    v_results := v_results || case when v_err='NOXIA_PUBLIC_HOUSING_FULL' then ' ok:full' else ' FAIL:full=' || v_err end;
  end;
  if (select count(*) from public.person_assignments where tile_entity_id=v_tile.id and assignment_type='home' and is_active) <> v_tile.residential_capacity then
    v_results := v_results || ' FAIL:capacity_exceeded';
  else
    v_results := v_results || ' ok:capacity_held';
  end if;

  raise exception 'NOXIA_TEST_OK%', v_results;
end $$;
