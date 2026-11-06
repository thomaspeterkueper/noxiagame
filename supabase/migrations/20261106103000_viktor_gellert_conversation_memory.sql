-- 06.11.2026 — Viktor Gellert (früher Victor Chen): Gesprächsgedächtnis an den Namen anpassen.
-- In npc_player_conversation_memory.recent_exchanges stellte er sich noch als „Victor Chen“ vor;
-- mit dem alten Verlauf hätte er sich weiter so genannt. Nur seine eigenen Zeilen (drei Spieler),
-- nur der Name; das Gesprächsprotokoll npc_conversation_log bleibt unverändert.
update public.npc_player_conversation_memory
set recent_exchanges = regexp_replace(
      regexp_replace(recent_exchanges::text, 'Victor Chen', 'Viktor Gellert', 'g'),
      '\mVictor\M', 'Viktor', 'g')::jsonb,
    updated_at = now()
where npc_person_id = 'cc21a023-c43f-46d3-8f8f-612f0334c598'
  and recent_exchanges::text ~ '\mVictor\M';
