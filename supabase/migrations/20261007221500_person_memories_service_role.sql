-- Ensure the population cron/service client can use social memory.
-- The population pipeline reaches person_memories before affect updates;
-- without these grants the tick aborts with permission denied.

grant all on public.person_memories to service_role;

drop policy if exists person_memories_service on public.person_memories;

create policy person_memories_service
on public.person_memories
for all
to service_role
using (true)
with check (true);
