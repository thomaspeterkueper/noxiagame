# DaVaRu und Aristeas – kontrollierte Aktivierung

Stand 2026-10-09: Figurenkonzepte, kanonische Rollen und Tempel-Adapter existieren im Code. Eine erneute Datenbankabfrage und ein Schreibversuch wurden durch eine Tool-Sicherheitsprüfung blockiert. Daher ist **keine Anlage von Personen in der Live-Datenbank bestätigt**.

## Bestehende Grundlagen
- `lib/game/population/literaryCharacterIntake.ts`
- `lib/game/temple/canonicalTemplePeople.ts`
- `public.people`: benötigt unter anderem `current_location_id`; Simulationstier kann `background` sein.
- `public.person_canonical_characters`: `(universe_key, character_key)` ist eindeutig.
- Tempel-Host existierte beim letzten erfolgreichen Check noch nicht.

## Identitäten und geplante Startbedingungen
- `daniel-van-runen-davaru`: Daniel van Runen (DaVaRu), Gastgeber/Philosoph; eigenständige Person.
- `aristeas-lux`: Aristeas Lux, Forscher und gelegentlicher Gast; eigenständige Person.
- Keine fiktiven Geburtsjahre, zusätzlichen Fähigkeiten oder speziellen Wissensrechte.
- Bis ein tatsächlich existierender Wohnort und Tempel zugewiesen sind: keine behauptete Tempelanwesenheit.
- Beim Anlegen zuerst vorhandene Personen- und Kanonverknüpfungen kontrollieren. Wiederholte Anlage muss idempotent sein.
- Beide unterliegen anschließend normalen Bedürfnissen, Handlungen, Erinnerungen und Vergessen.

## Freigabeschritte
1. Schema und verfügbare Startorte erneut lesend prüfen.
2. Eindeutigkeit der Personenschlüssel und Fremdschlüssel gewährleisten.
3. Zwei reale Personendatensätze mit eigenen IDs anlegen, zunächst ohne erdachte Haushalts-/Arbeitszuweisungen.
4. Je Person genau einen `canon_anchor`-Link in `person_canonical_characters` erstellen.
5. Nachlesen und prüfen, dass kein NPC doppelt angelegt ist und keine physische Tempelanwesenheit erfunden wird.
6. Später Tempelgebäude/Grundstück und rechtmäßige Zuweisungen im Core einrichten; Fernbesuche bleiben separate Sitzungen.

Keine automatische Erstellung über GET-Endpunkte, kein Zugriff auf andere Spielerprofile, keine religiöse Autoritätsgewichtung.
