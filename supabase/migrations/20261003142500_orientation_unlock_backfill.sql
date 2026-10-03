-- Backfill UNL:NOX:orientation for every already-onboarded player.
--
-- UNL:NOX:orientation is a new root unlock (see lib/knowledge/unlockRegistry.ts)
-- that six specializations (resource-extraction, power-generation,
-- water-processing, pressure-systems, radiation-protection,
-- magnetobiology-experiment-design) now depend on. It didn't exist before,
-- so no player could have earned it through the normal SSF-module-complete
-- flow -- and SSF doesn't know this ID at all, since it's a NOXIA-native
-- onboarding grant, not learned content (see app/api/game/profile/route.ts's
-- grant on the 'setup' action). That grant only runs for players going
-- through onboarding for the first time, so it would never reach anyone
-- already onboarded before this change ships. Without this backfill, every
-- existing player would be locked out of all six dependent specializations
-- the moment the new root lands.
--
-- Safe to apply any time, including before the orientation root itself is
-- merged: granting this unlock early is inert until something depends on
-- it, and the insert is idempotent (WHERE NOT EXISTS).

set search_path to public;

insert into player_unlocks (id, profile_id, unlock_id, granted_at, source_module)
select gen_random_uuid(), p.id, 'UNL:NOX:orientation', now(), null
from profiles p
where p.onboarded = true
  and not exists (
    select 1 from player_unlocks pu
    where pu.profile_id = p.id and pu.unlock_id = 'UNL:NOX:orientation'
  );
