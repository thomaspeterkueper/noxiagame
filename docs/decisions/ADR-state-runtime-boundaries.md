# ADR: NOXIA State- und Runtime-Grenzen

**Datum:** 05.09.2026  
**Status:** Accepted  
**Geltung:** Dashboard, Kolonieansicht, Walkable Colony, Innenräume, Reise-/Docking-Runtime

## Entscheidung

NOXIA verwendet genau einen persistenten Simulationszustand. Dieser liegt in Supabase und wird ausschließlich über serverseitige Runtime-/API-Grenzen mutiert. Client-Stores sind Projektionen oder rein ephemere Interaktionszustände und dürfen keine zweite Simulation erzeugen.

## 1. Persistente Simulation Truth

Supabase ist Source of Truth für Zustände, die einen Reload, einen Gerätewechsel oder mehrere Clients überleben müssen. Dazu gehören insbesondere:

- `locations` und `location_resources`
- `tile_entities` und persistente Gebäudebeziehungen
- `player_builds`
- `ships` und `ship_docking_assignments`
- Population-/Resident-Daten
- `simulation_events` und `entity_states`, soweit Runtime-Ereignisse beziehungsweise aktuelle Entity-Zustände persistiert werden
- Handels-, Produktions- und Tick-Zustände

Ein Zustand gehört hierhin, wenn er für Spielregeln relevant ist oder von einem anderen Client später identisch gelesen werden muss.

## 2. Server/API als Mutationsgrenze

Spielzustand wird nicht direkt aus Renderern oder Zustandstores in Tabellen geschrieben. API-Routen beziehungsweise serverseitige Domain-Funktionen übernehmen:

1. Authentifizierung und Autorisierung;
2. Validierung von Spielregeln;
3. atomare beziehungsweise konsistente Persistenz;
4. Erzeugung von Runtime-Ereignissen, wenn eine Zustandsänderung ein Ereignis darstellt;
5. Rückgabe eines neuen Snapshots oder Resultats an den Client.

Renderer dürfen Simulation auslösen, aber nicht selbst Simulation Truth besitzen.

## 3. Client-Projektion: `colonyStateStore`

`lib/store/colonyStateStore.ts` ist ein Snapshot-/Projection-Store. Er bündelt Daten aus `/api/game/build`, `/api/game/world` und `/api/game/population` für die aktuelle Kolonie.

Er darf:

- Welt-, Entity-, Build- und Resident-Daten für die Darstellung cachen;
- Refresh-/Loading-/Error-Zustände verwalten;
- einen konsistenten lokalen Snapshot für Renderer bereitstellen.

Er darf nicht:

- dauerhaft neue Gebäude, Einwohner, Ressourcen oder Schiffe erfinden;
- eine eigene Tick- oder Produktionssimulation als konkurrierende Wahrheit führen;
- persistente Änderungen allein lokal bestätigen, ohne Serverergebnis.

## 4. Ephemere Interaktion: `colonyInteractionStore`

`lib/store/colonyInteractionStore.ts` besitzt absichtlich nicht-persistente Zustände wie:

- aktuelle Spielerposition in der Walkable-Colony-Projektion;
- Auswahl eines Gebäudes, einer Person oder eines Fahrzeugs;
- nächstgelegene Interaktion;
- Sichtbarkeit lokaler UI-Overlays.

Diese Daten dürfen verloren gehen, wenn die Seite neu geladen oder der Standort gewechselt wird. Sie sind keine Simulationswahrheit.

Die frühere Formulierung „kein Mikro-State-Store“ wird deshalb präzisiert: Verboten ist ein **zweiter persistenter Weltzustand**, nicht ein ephemerer UI-/Interaktionsstore.

## 5. Präsentationsmodus: `gameModeStore`

`lib/store/gameModeStore.ts` steuert nur die aktuelle Perspektive:

- `colony`
- `planning`
- `interior`

Der Modus verändert nicht automatisch den persistenten Weltzustand. Ein Wechsel in einen Innenraum erzeugt beispielsweise kein Gebäude und ein Wechsel in die Planungsansicht pausiert die Simulation nicht.

## 6. Abgeleitete Runtime

NPC-Positionen, sichtbare Routinen, Interaktionsnähe, Kamera, Fokus und andere darstellungsnahe Zustände dürfen deterministisch aus persistenter Truth plus aktueller Zeit/Sicht berechnet werden.

Für solche Ableitungen gilt:

- keine konkurrierende Persistenz;
- reproduzierbare Ableitung, soweit gameplayrelevant;
- sichtbare Objekte brauchen eine nachvollziehbare persistente oder ausdrücklich simulierte Quelle;
- dekorative Animation darf existieren, darf aber keine Spielregel implizieren.

## 7. Event- und Entity-State-Grenze

Legacy `events` bleibt ein bestehendes historisches/legacy System. Neue generalisierte Runtime-Ereignisse gehören ausschließlich in `simulation_events`.

`entity_states` hält persistente Runtime-Zustände, wenn ein Entity-Zustand nicht sinnvoll allein aus Stammdaten rekonstruiert werden kann. Ein Event ist eine Zustandsänderung oder Beobachtung; `entity_states` ist der daraus resultierende aktuelle Zustand. Beide sind NOXIA-Runtime und nicht automatisch OTA-/KG-Kanon.

## 8. Renderer

Renderer sind Projektionen des Weltzustands. Sie dürfen keine eigene persistente Geometrie oder Wirtschaft erfinden.

Die Walkable Colony darf gegenüber der strategischen Darstellung eine eigene lokale Darstellungsgeometrie haben. Diese Geometrie ist jedoch eine Projektion beziehungsweise Ableitung aus der NOXIA-Welt und nicht automatisch ein neues kanonisches Weltkoordinatensystem.

## 9. Entscheidung zu PR #62 / kontinuierlichem Spatial Model

PR #62 wird nicht als Ganzes übernommen.

Übernommen wird das Architekturprinzip:

- Weltgeometrie darf langfristig metrische lokale Koordinaten verwenden;
- Observed, Derived und Simulated sollen getrennte Datenschichten bleiben;
- Renderer sind Projektionen und keine Source of Truth;
- bestehende `parent_id + slot`-Beziehungen bleiben die kanonische Erweiterungsrelation.

Nicht übernommen wird derzeit:

- die sofortige Ablösung des 32×24-Layouts als persistente Hauptreferenz;
- ein paralleler `/api/game/spatial-build`-Pfad neben der bestehenden Build-API;
- neue `build_sites`-/Spatial-Tabellen ohne einen konkreten Gameplay-Consumer;
- ein pauschaler Legacy-Backfill `tile_* × 100 m` als physikalische Wahrheit.

Grund: Der aktuelle spielbare Host, Build-Pfad und die Walkable-Colony-Projektion funktionieren noch auf der bestehenden Weltstruktur. Ein zweiter Build-Stack würde genau die doppelte Runtime erzeugen, die dieses ADR vermeiden soll.

## 10. Migrationsregel für ein späteres Spatial Model

Ein metrisches Spatial Model wird erst eingeführt, wenn mindestens ein produktiver Consumer es benötigt. Dann gilt:

1. bestehende Build-API erweitern statt einen konkurrierenden Build-Endpunkt einzuführen;
2. Koordinaten additiv einführen und Legacy-Daten zunächst kompatibel halten;
3. keinen beliebigen Metermaßstab aus Tiles als physikalischen Kanon festschreiben;
4. Renderer und Placement-Logik in einem kontrollierten Slice migrieren;
5. erst nach erfolgreicher Migration `tile_row`/`tile_col` zu reiner Kompatibilität degradieren.

## Invariante

Für jeden gameplayrelevanten Zustand muss eindeutig beantwortbar sein:

> Wo liegt die persistente Wahrheit, wer darf sie mutieren und welche Client-Daten sind nur Projektion?

Wenn darauf mehr als eine persistente Antwort existiert, ist die Architekturgrenze verletzt.
