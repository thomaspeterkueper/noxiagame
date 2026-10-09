# NOXIA-TEMPLE-0001: Ein Tempel, mehrere Zugänge
Status: Architektur und isolierter Zugangskontrakt (2026-10-09). **Noch kein live gebauter Tempel und kein Auth- oder Raumwechsel-Endpunkt.**

## Entscheidung
Ein einziger kanonischer DaVaRu-Tempel als wiedererkennbarer sozialer Ort. Zugänglich über Weltkarte/physische Anreise, ENDIA und einen späteren Abenteuerpark. Alle Kanäle verwenden denselben `destinationKey = davaru-temple`, nicht mehrere Weltkopien. Unterschied zwischen `physical` und `remote` ist zwingend: Virtueller Eintritt gibt Zugang zu Gesprächen und Veranstaltungen, aber teleportiert weder NPC noch Spieler und umgeht keine Raumfahrt- und Reisewirtschaft.

Die Runtime verwaltet eine gemeinsame Tempelidentität und gemeinsame öffentliche Artefakte/Traditionen; gleichzeitig müssen physische Präsenz, Avatare, Beobachtbarkeit, Einwilligung und Zugriffsrechte getrennt bleiben. Alle Kontakte erzeugen Erinnerungen nur durch tatsächlich bestätigte Interaktionen. Der Zugangskontrakt prüft explizit bereits autorisierte Rechte, er gewährt selbst keine.

## Vorhandene Domänen verwenden
- `lib/game/buildings/interiors/instances.ts`: kanonische Innenrauminstanz statt Duplikaten
- `lib/game/buildings/interiors/access.ts`: autorisierte Portale
- `lib/game/population/interiorPresence.ts`: physische Anwesenheit
- `lib/game/population/travelState.ts`: kein kostenloses Sofortreisen
- `lib/game/population/canonicalCharacter.ts`: eigenständige Aristeas-Lux- und Daniel-van-Runen-Identitäten
- `lib/game/knowledge/`: subjektive Erinnerung und Wissenstransfer

## Etappen
1. Isolierten, deaktivierten Shared-Destination-Vertrag und Tests festhalten (vorhanden in `lib/game/temple/sharedTempleAccess.ts`).
2. Persistierte Destination/Host-Instanz und authentifizierte Web-Einstiege prüfen und integrieren. Vorher keine Route öffentlich ausrollen.
3. Kleine Tempelversion mit öffentlichem Raum, Gesprächsort, Bibliothek und Garten; echte Zugriffs- und Sichtbarkeitsregeln.
4. ENDIA- und Abenteuerpark-Zugänge als Remote-Sessions zur *gleichen* Instanz mit aktiver Besuchergrenze und zeitbegrenzter Sitzung.
5. Gemeinsame Veranstaltung und Wissenstransfer im Mehrspieler-/NPC-Test validieren; Last- und Kostenmessung vor Öffnung.

## Design
DaVaRu vermittelt den Weg, ohne Besucher zu bekehren. Aristeas Lux kann dort als Forscher und diskussionsfreudiger Gast auftreten; beide sind eigene Personen. Der Tempel ist kein privilegiertes Wahrheitszentrum oder dogmatisches Pflichtsystem.

## Kosten/Sicherheit
Eventgetriebene Besucherpräsenz, keine Neuanlage je Eintritt, keine per-Tick-LLM-Gespräche, idempotente Session-IDs, begrenzte Archivspeicherung, Schutz privater weltanschaulicher Inhalte. Authentifizierung am Eingang tatsächlich serverseitig prüfen; Eingabefelder wie `authenticated` sind im reinen Domänenvertrag nur bereits autorisierte Fakten und dürfen nicht direkt vom Browser vertraut werden.
