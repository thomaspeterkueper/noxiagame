-- Der Server-Rolle fehlten die Rechte an place_activity_slots (Fehler 42501) –
-- der Tick um 03:00 und 04:00 UTC am 29.10.2026 brach dadurch ab.
grant select, insert, update, delete on public.place_activity_slots to service_role;
