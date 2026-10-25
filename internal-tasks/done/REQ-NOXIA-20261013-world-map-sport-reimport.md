# REQ-NOXIA-20261013 – Sundern mit Sportflächen neu importieren

Status: done  
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

1. Nach dem Deployment `/world-lab` öffnen. Die Seite ruft beim Start `/api/world-lab/refresh` auf; das erneuert die Region Sauerland (Importprofil 4) und holt Ortsdetail um die Figur. Unten im Feld steht, was geklappt hat. Alternativ an der gewünschten Stelle „Kartendaten hier nachladen“ drücken. Der Neuaufbau einer Region kann bis zu zwei Minuten dauern.
2. Prüfen, ob es geklappt hat – zum Beispiel im Supabase-SQL-Editor:
   ```sql
   select r.slug, f.properties->>'visual_class' as art, count(*)
   from region_features f join celestial_regions r on r.id = f.region_id
   where f.feature_type = 'sport' group by 1, 2;
   ```
   Für Sundern sollte mindestens ein `pitch` (Röhrtalstadion) erscheinen.
3. Zum Stadion laufen (vor dem Metallwerk). Nach dem Nachladen holt die Seite die Kacheln ohne Zwischenspeicher neu.

## Erledigt, wenn

Das Röhrtalstadion in `/world-lab` als grünes Feld mit heller Randlinie vor dem Metallwerk liegt. Dann diese Datei nach `internal-tasks/done/` verschieben und Aufgabe 8 in `docs/workstreams/world-map.md` abhaken.

## Erledigt (25.10.2026)

Datenbank geprüft: Die Region Sauerland (`earth-sauerland`, zuletzt erneuert am 25.10.2026) enthält 24 Sportflächen, darunter „Röhrtalstadion“ (`sports_centre`), „Sportplatz Sundern“ (Fußball), ein `stadium`, Tennis-, Reit- und Schießanlagen. Ob das Stadion in der Karte richtig liegt, prüft Thomas beim nächsten Gang durch Sundern.
