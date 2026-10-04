create index if not exists person_parent_child_partnership_idx
  on public.person_parent_child(partnership_id)
  where partnership_id is not null;

drop policy if exists person_life_state_service on public.person_life_state;
create policy person_life_state_service on public.person_life_state
  for all to service_role using (true) with check (true);

drop policy if exists person_partnerships_service on public.person_partnerships;
create policy person_partnerships_service on public.person_partnerships
  for all to service_role using (true) with check (true);

drop policy if exists person_parent_child_service on public.person_parent_child;
create policy person_parent_child_service on public.person_parent_child
  for all to service_role using (true) with check (true);

drop policy if exists location_family_demand_service on public.location_family_demand;
create policy location_family_demand_service on public.location_family_demand
  for all to service_role using (true) with check (true);

drop policy if exists npc_player_conversation_memory_service on public.npc_player_conversation_memory;
create policy npc_player_conversation_memory_service on public.npc_player_conversation_memory
  for all to service_role using (true) with check (true);
