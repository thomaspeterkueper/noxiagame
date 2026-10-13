# REQ-NOXIA-20261013 – Sundern mit Sportflächen neu importieren

Status: open  
Repository: noxiagame  
Scope: Earth / Prototyp „eine Welt“ (`docs/workstreams/world-map.md`, Aufgabe 8)  
Priority: Normal  
Type: Internal Request  
Für: Thomas (braucht Zugang zu Overpass; die Claude-Umgebung erreicht Overpass nicht)

## Ausgangslage

Das Röhrtalstadion fehlte in `/world-lab`: Der Import übernahm keine Sportflächen. Gebaut ist (Commit „feat(world-lab): Sportflächen“):

- `lib/world/spatial/earthPlaceMaterializer.server.ts`: fragt `leisure=pitch|stadium|track|sports_centre` ab (Golf ausgenommen) und speichert sie als `feature_type = 'sport'`, `visual_class` = Wert von `leisure`. Importprofil `EARTH_GEOGRAPHY_IMPORT_VERSION` von 3 auf 4.
- `lib/worldlab/simplify.ts`, `blocks.ts`, `app/world-lab/worldEngine.ts`: drei neue Flächenarten – Sportanlage (Stadion, Sportzentrum), Laufbahn (rotbraun), Spielfeld (Rasen mit heller Randlinie).

Die bestehende begehbare Erdszene und die Regionsvorschau zeichnen `sport` nicht; sie ignorieren die neue Art.

## Was zu tun ist

1. Nach dem Deployment im Spiel die Erdkarte auf Sundern öffnen. Weil das Importprofil jetzt 4 ist, meldet die Region „veraltet“ und wird im Hintergrund neu aus OpenStreetMap aufgebaut (`/api/earth/materialize`). Schlägt das fehl, bleiben die alten Daten stehen.
2. Prüfen, ob es geklappt hat – zum Beispiel im Supabase-SQL-Editor:
   ```sql
   select r.slug, f.properties->>'visual_class' as art, count(*)
   from region_features f join celestial_regions r on r.id = f.region_id
   where f.feature_type = 'sport' group by 1, 2;
   ```
   Für Sundern sollte mindestens ein `pitch` (Röhrtalstadion) erscheinen.
3. `/world-lab` an der Halle des Metallwerks öffnen. Achtung: Die Kacheln dürfen am Vercel-Rand bis zu einem Tag zwischengespeichert werden. Zeigt die Karte das Stadion noch nicht, ein erneutes Deployment auslösen (leert den Zwischenspeicher) oder bis morgen warten.

## Erledigt, wenn

Das Röhrtalstadion in `/world-lab` als grünes Feld mit heller Randlinie vor dem Metallwerk liegt. Dann diese Datei nach `internal-tasks/done/` verschieben und Aufgabe 8 in `docs/workstreams/world-map.md` abhaken.
