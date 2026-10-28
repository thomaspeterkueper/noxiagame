-- Fix: Die neuen Tabellen der Testphase hatten keine Rechte für service_role.
-- In diesem Projekt vergeben die Standardrechte sie nicht von selbst; Einfügen
-- über die Server-Routen scheiterte mit 42501 (Verhaltensaufzeichnung,
-- Gesprächsprotokoll, Wissen der Figuren, Akademie-Ergebnisse).

set search_path to public;

grant select, insert, update, delete on
  public.npc_conversation_log,
  public.npc_conversation_reviews,
  public.player_activity_log,
  public.venue_price_overrides,
  public.venue_services,
  public.building_staff_roles,
  public.npc_player_knowledge,
  public.npc_player_favors,
  public.academy_task_results
to service_role;

grant usage, select on all sequences in schema public to service_role;

grant select on
  public.npc_conversation_daily,
  public.npc_conversation_top_questions,
  public.npc_conversation_loops,
  public.npc_conversation_topics_daily,
  public.npc_conversation_real_world,
  public.npc_social_daily,
  public.npc_conversation_followups,
  public.player_sessions,
  public.player_friction,
  public.player_errors,
  public.player_clicks,
  public.player_paths
to service_role;
