-- Miete nach Kaufpreis (NOXIA-FIN-0002, Frage 5 und Miete).
-- Entschieden (Thomas, 06.11.2026): „Wohnungen sollten Miete kosten, die Höhe der Miete richtet
-- sich nach dem Kaufpreis des Gebäudes. Bei privaten Objekten legt der Besitzer das fest.“
-- Dazu (Auswahl Thomas, 06.11.2026): „Habitate teurer“ – Kaufpreis der Habitate auf Erd-Niveau.
--
-- * Mietsatz je Ort: colony_settings.rent_yield_30d, Start 11 % des Kaufpreises je Wohnung und
--   30 Tage. So bleibt ein Wohnhaus auf der Erde bei heutigen Preisen um 200 Cr. Je Ort änderbar.
-- * Kaufpreis eines Gebäudes (noxia_building_purchase_price): Angebotspreis, wenn es angeboten
--   ist; sonst Baupreis der Gebäudeart; echte Gebäude der Erde mindestens 1 800 Cr je Wohnung
--   (Bezugswert der Erdkarte, lib/worldlab/buildingOffer.ts).
-- * Habitate kosten 16 000 Cr statt 2 000 Cr (8 Wohnungen à 2 000 Cr): Wohnraum in der Kuppel
--   ist knapp. Miete dort damit rund 220 Cr je Wohnung.
-- * Staatliche Wohnungen: Miete = Kaufpreis ÷ Wohnungen × Mietsatz; die kostenfreien Wohnungen
--   auf der Erde werden ebenfalls vermietet, erste Miete nach einer Woche.
-- * Private Wohnungen: Der Besitzer legt die Miete fest (tile_entities.lease_price,
--   noxia_set_dwelling_rent); ohne Festlegung gilt die Rechnung wie beim Staat.
-- * noxia_refresh_rents passt laufende Mietverträge an, wirksam zur nächsten Abrechnung;
--   der Tick ruft sie einmal am Tag.

set search_path to public;

alter table public.colony_settings
  add column if not exists rent_yield_30d numeric(8,4) not null default 0.11
  check (rent_yield_30d >= 0 and rent_yield_30d <= 1);
comment on column public.colony_settings.rent_yield_30d is
  'Miete je Wohnung und 30 Tage als Anteil am Kaufpreis je Wohnung (NOXIA-FIN-0002). Je Ort änderbar.';

update public.building_definitions set cost_credits = 16000 where key = 'habitat' and coalesce(cost_credits, 0) < 16000;

create or replace function public.noxia_building_purchase_price(p_tile_entity_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1, coalesce(
           te.asking_price::integer,
           case when te.source_ref is not null
                then greatest(coalesce(bd.cost_credits, 0), 1800 * greatest(1, coalesce(te.residential_capacity, 1)))
                else bd.cost_credits end,
           1800 * greatest(1, coalesce(te.residential_capacity, 1))
         ))::integer
    from public.tile_entities te
    left join public.building_definitions bd on bd.key = te.entity_id
   where te.id = p_tile_entity_id
$$;

-- Miete je Wohnung und 30 Tage für ein Gebäude.
create or replace function public.noxia_dwelling_rent(p_tile_entity_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case
           when te.profile_id is not null and te.lease_price is not null then te.lease_price::integer
           when not te.is_state_owned and te.lease_price is not null then te.lease_price::integer
           else greatest(1, round(public.noxia_building_purchase_price(te.id)::numeric
                                  / greatest(1, coalesce(te.residential_capacity, 1))
                                  * coalesce(cs.rent_yield_30d, 0.11)))::integer
         end
    from public.tile_entities te
    left join public.colony_settings cs on cs.location_id = te.location_id
   where te.id = p_tile_entity_id
$$;

-- Laufende Verträge an die Regel anpassen; kostenfreie staatliche Wohnungen vermieten.
create or replace function public.noxia_refresh_rents(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_converted integer; v_updated integer;
begin
  update public.person_tenancies t
     set origin = 'market', tenure = 'rented', status = 'active',
         rent_per_billing = public.noxia_dwelling_rent(t.tile_entity_id), billing_interval_ticks = 720,
         next_due_tick = p_tick + 168
    from public.tile_entities te, public.location_public_actors lpa
   where te.id = t.tile_entity_id and te.is_state_owned
     and lpa.location_id = t.location_id and t.landlord_actor_id = lpa.actor_id
     and t.status = 'provided';
  get diagnostics v_converted = row_count;

  update public.person_tenancies t
     set rent_per_billing = public.noxia_dwelling_rent(t.tile_entity_id)
   where t.status = 'active' and t.origin = 'market' and t.tenure = 'rented' and t.tile_entity_id is not null
     and t.rent_per_billing is distinct from public.noxia_dwelling_rent(t.tile_entity_id);
  get diagnostics v_updated = row_count;

  return jsonb_build_object('ok', true, 'tick', p_tick, 'converted', v_converted, 'updated', v_updated);
end;
$$;

-- Private Besitzer legen die Miete fest (Spieler über das Spiel).
create or replace function public.noxia_set_dwelling_rent(p_profile_id uuid, p_tile_entity_id uuid, p_rent integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_te public.tile_entities%rowtype;
begin
  select * into v_te from public.tile_entities where id = p_tile_entity_id;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_te.profile_id is distinct from p_profile_id then raise exception 'NOXIA_NOT_OWNER' using errcode = 'P0001'; end if;
  if coalesce(v_te.residential_capacity, 0) <= 0 then raise exception 'NOXIA_NO_DWELLINGS' using errcode = 'P0001'; end if;
  if p_rent is null or p_rent < 0 or p_rent > 100000 then raise exception 'NOXIA_RENT_INVALID' using errcode = 'P0001'; end if;
  update public.tile_entities set lease_price = p_rent where id = p_tile_entity_id;
  update public.person_tenancies set rent_per_billing = p_rent
   where tile_entity_id = p_tile_entity_id and status = 'active' and origin = 'market' and tenure = 'rented';
  return jsonb_build_object('ok', true, 'rent', p_rent, 'purchase_price', public.noxia_building_purchase_price(p_tile_entity_id),
                            'reference_rent', greatest(1, round(public.noxia_building_purchase_price(p_tile_entity_id)::numeric
                              / greatest(1, v_te.residential_capacity)
                              * coalesce((select rent_yield_30d from public.colony_settings where location_id = v_te.location_id), 0.11)))::integer);
end;
$$;

revoke all on function public.noxia_building_purchase_price(uuid), public.noxia_dwelling_rent(uuid),
  public.noxia_refresh_rents(bigint), public.noxia_set_dwelling_rent(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.noxia_building_purchase_price(uuid), public.noxia_dwelling_rent(uuid),
  public.noxia_refresh_rents(bigint), public.noxia_set_dwelling_rent(uuid, uuid, integer) to service_role;
