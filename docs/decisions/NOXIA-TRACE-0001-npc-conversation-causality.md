# NOXIA-TRACE-0001 · Kausalspur für NPC-Gespräche

**Status:** implementierter erster Messpfad; Client-Aktionsbestätigung und asynchrone Wünsche als Folgearbeit.

## Grundsatz

Ein Gespräch kann drei voneinander abweichende Aussagen liefern:

1. **Modell hat X vorgeschlagen** – `action_proposed/proposed`, niemals als tatsächlich ausgeführt zählen.
2. **Server hat Datenbank-Änderung bestätigt** – `memory_write/succeeded`, `name_knowledge_write/succeeded`, `identity_knowledge_write/succeeded`, `age_knowledge_write/succeeded` oder `testimony_write/succeeded` nach erfolgreichem Datenbank-Response.
3. **Echte Weltaktion ist nachweislich passiert** – erst durch zukünftiges Event mit Bestätigung und `correlation_id` im ausführenden Welt-/Clientsystem; aktuell ausdrücklich noch nicht erfüllt.

## Datenvertrag

Jeder neue NPC-Gesprächszug erhält serverseitig eine UUID `correlation_id` in `npc_conversation_log`. Weitere `npc_conversation_causal_traces` referenzieren sowohl die Gesprächs-ID als auch diese UUID und dokumentieren `stage`, `status`, `detail`, `created_at`. Rohtexte liegen **nicht** in den Kausalspuren; der Dialog bleibt in der Gesprächslogtabelle. Keine vom Spieler übergebene Korrelations-ID wird akzeptiert.

Der Ereignisspeicher hat RLS und ist nur für den serverseitigen `service_role` erreichbar. Die Admin-Diagnoseabfrage hängt Kausalspuren ausschließlich an Gespräche, die durch die bestehende Testbetrieb-Freischaltung (Stichtag + Adminrecht + Zugriffsaudit) bereits zugelassen wurden. Vorher werden weder Texte noch Kausalspuren ausgeliefert.

## Verifikationsregeln

- `observed`: Thema klassifiziert / NPC-Antwort vorhanden; kein impliziter Weltzustand.
- `proposed`: Aktionsmarker vom Modell akzeptiert und Aktion an Client zurückgegeben; Erfolg unbekannt.
- `succeeded`: konkreter serverseitiger Persistenzaufruf lieferte keinen Fehler.
- `failed`: Datenbankoperation meldete Fehler; keine positive Wirkung behaupten.
- `not_confirmed`: z. B. im Hintergrund geplanter Wunsch ohne persistierten Erfolg oder zurückgewiesene Aktion.
- `conversation_logged`: Dialogturn im Log gespeichert. Schreibfehler werden protokolliert, nicht verschwiegen.

## Einschränkungen und Folgearbeiten

1. Rückmeldungen von `visit_place` und `lead_walk` sind klientseitig; als Nächstes einen authentifizierten Aktionsabschluss mit idempotenter Bestätigung einbauen.
2. `after(submitWish)` läuft asynchron. Die Spur erfasst derzeit die Planung, nicht den Ergebnis-Commit. Ein outbox-basiertes Modell oder idempotente spätere Event-Emission ist nötig.
3. Gedächtnis-Updates und Kausalspuren werden derzeit separat geschrieben. Ein Transaktions-/Outbox-Mechanismus sollte später beide atomar verknüpfen. Bei Trace-Schreibfehler ist das Log potenziell ohne vollständige Spur; dies muss überwacht werden.
4. Bestandsdialoge ohne Korrelations-ID erhalten **keine erfundenen** rückwirkenden Schlussfolgerungen.
5. Wenn die Admin-Transkriptansicht aus Datenschutzgründen deaktiviert ist, bleibt sie trotz verfügbarer Kausalspur deaktiviert. Eine zukünftige nur aggregierte, textfreie Diagnose kann unabhängig umgesetzt werden.

## Prüffälle

- Kein Bearer-Token oder Nicht-Admin: 401/403.
- Diagnose-Stichtag nicht gesetzt: keine Texte oder Kausalspuren.
- Nach Stichtag: sichtbare Gesprächs-ID, identische `correlation_id` für alle Phasen.
- Gescheiterter Gedächtnisschreibversuch: `failed`, nie `succeeded`.
- Modellmarker ohne Client-Aktionsnachweis: `proposed`, nie `succeeded`.
- Gleichzeitige Spieler: getrennte, vom Server generierte UUIDs.
- Alt-Daten: `correlation_id IS NULL`, historischer Trace leer.
