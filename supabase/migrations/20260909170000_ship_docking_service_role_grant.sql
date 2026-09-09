-- Server-side travel reserves and releases concrete docking pads through the
-- Supabase Data API. Newer explicit-grant defaults require the service role to
-- be granted the table privileges it actually uses.
grant select, insert, update, delete
on table public.ship_docking_assignments
to service_role;
