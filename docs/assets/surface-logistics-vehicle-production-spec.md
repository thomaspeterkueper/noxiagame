# NOXIA Surface Logistics – Vehicle Asset Production Spec v1

Status: **verbindliche Produktionsspezifikation für Grafik-Assets**  
Scope: Fahrzeuge, Cargo-Module und Logistik-HUD für Earth/Moon/Mars; erster Vertical Slice: **Moon / Shackleton**.

## 1. Ziel

Dieser Workflow produziert **spielbare Assets**, keine freien Konzeptillustrationen.

Ein Asset gilt erst als fertig, wenn es:

1. zur bestehenden NOXIA-Bildsprache passt,
2. auf der realen Spielkarte bei tatsächlicher Darstellungsgröße lesbar ist,
3. technisch in die bestehende Asset-Pipeline eingebunden ist,
4. transparente, reproduzierbare Zustände besitzt,
5. keine Gameplay- oder Engineering-Fakten erfindet,
6. einen vorhandenen oder vom Core ausdrücklich freigegebenen visuellen Rollenbezeichner verwendet.

Ein schönes Einzelbild ohne Einbaupfad, Maßstabsprüfung und In-Game-Test ist **kein akzeptiertes NOXIA-Asset**.

## 2. Verbindliche Referenzen vor jeder Generierung

Der Grafik-Chat muss vor der ersten Bildgenerierung mindestens diese Dateien lesen und seine Arbeit daran ausrichten:

- `docs/NOXIA-VISUAL-BIBLE.md`
- `public/assets/README.md`
- `lib/assets/catalog.ts`
- `lib/assets/BuildingVisual.tsx`
- `docs/assets/mars-vertical-slice.md`
- `docs/design/moon-surface-logistics.md`
- `lib/game/moonSurfaceLogistics.ts`
- bestehende `public/assets/buildings/*/*/exterior-isometric.webp`

Zusätzlich muss er die aktuelle Karte bzw. den aktuellen Renderer prüfen, in dem das Asset später tatsächlich erscheint.

### Preflight-Protokoll

Vor der ersten Generierung ist kurz zu dokumentieren:

- welche bestehenden Rasterassets als Stil-/Kamerareferenz verwendet wurden,
- welche reale Rendergröße das Asset im aktuellen UI ungefähr besitzt,
- welche Footprint-/Anchor-Konvention der aktuelle Renderer erwartet,
- welcher Weltkörper und welcher Einsatzfall dargestellt werden,
- welche technischen Details **noch offen** sind und deshalb visuell nicht kanonisiert werden dürfen.

Ohne dieses Preflight-Protokoll darf kein Batch erzeugt werden.

## 3. Bildsprache

Verbindlich aus der NOXIA Visual Bible:

- Near-Future statt Fantasy-Sci-Fi,
- funktionale, reparierbare Technik,
- sichtbare Serviceflächen, Paneele, Kabel-/Leitungskanäle, Befestigungspunkte, Wartungszugänge,
- helle technische Materialien mit dunklen Strukturteilen,
- keine militärische Formensprache,
- kein Cyberpunk-Neon,
- keine unnötigen Leuchteffekte,
- keine dekorativen Flügel, Spoiler oder aerodynamischen Karosserien im Vakuum,
- keine überdimensionierten "Monster-Truck"-Räder nur für Dramatik,
- keine Textlabels, Logos oder UI-Texte im Asset.

### Moon / Shackleton

- neutralgrauer Regolith,
- keine atmosphärische Dunstwirkung,
- harte, klare Licht-/Schattenkante,
- Staub und Abrieb nur plausibel an Rädern, Fahrwerk, Unterboden und Ladebereich,
- keine Rostästhetik wie auf der Erde,
- Wärmeschutz, Radiator-/Thermalflächen und exponierte Technik nur dort, wo sie funktional glaubwürdig wirken,
- Fahrzeuge dürfen sichtbar modular und wartbar sein.

## 4. Kamera und Projektion

### Außenassets

- einheitliche NOXIA-3/4-Isometrie,
- keine cinematische Weitwinkelperspektive,
- keine extreme Frosch-/Vogelperspektive,
- Perspektive muss zu den vorhandenen `exterior-isometric`-Gebäudeassets passen,
- transparenter Hintergrund,
- kein Horizont,
- keine Landschaft im Bild,
- kein dekorativer Bodenpatch unter dem Fahrzeug,
- nur ein kleiner, konsistenter Kontakt-/Bodenschatten ist erlaubt.

Der aktuelle Standardanker für isometrische Außenassets ist `[0.5, 0.82]`. Abweichungen für Fahrzeuge sind nur erlaubt, wenn sie im Asset-Katalog explizit dokumentiert und im Renderer getestet werden.

### Maßstab

Der Maßstab darf nicht aus der Bildästhetik entstehen. Er muss relativ zu bestehenden Spielobjekten überprüft werden.

Vor Freigabe eines Fahrzeugassets ist mindestens ein Vergleich zu zeigen:

- Fahrzeug neben einem vorhandenen Habitat-/Industrieasset,
- Fahrzeug auf dem aktuellen Kartenraster / der aktuellen World-Map,
- Cargo-Modul auf oder neben dem dazugehörigen Fahrzeug.

Wenn die tatsächlichen Engineering-Abmessungen noch offen sind, wird nur die **Rollenrelation** kanonisiert:

- `cargo-rover` sichtbar kleiner und flexibler,
- `heavy-hauler` deutlich größer, schwerer und industrieller,
- keine exakte Meterangabe als Kanon erfinden.

## 5. Asset-Rollen des ersten Vertical Slice

Der erste Moon-Slice verwendet ausschließlich die bereits von Moon/Core definierten Gameplay-Rollen:

### A. Cargo Rover

Gameplay-Funktion:

- flexible lokale Frachtverteilung,
- Mine ↔ Verarbeitung ↔ Lager ↔ Logistik-Hub,
- häufiger Offroad-/Prepared-Track-Betrieb,
- schnelle Be-/Entladung,
- wiederholbarer autonomer Betrieb.

Visuelle Anforderungen:

- kompakte, modulare Silhouette,
- klarer Ladebereich,
- sichtbare standardisierte Befestigungs-/Dockpunkte,
- geringe Überhänge,
- Fahrwerk für raues Terrain glaubwürdig,
- eher Utility-/Industriefahrzeug als Crew-Rover,
- kein Zwang zu Druckkabine oder großer Frontscheibe.

### B. Heavy Hauler

Gameplay-Funktion:

- hohe Frachtmenge,
- wiederkehrende industrielle Korridore,
- bevorzugt Prepared Track / Hardened Road,
- hoher Durchsatz bei geringerer Flexibilität.

Visuelle Anforderungen:

- deutlich längere/breitere industrielle Silhouette als Cargo Rover,
- mehrere Achsen bzw. sichtbar lastorientiertes Fahrwerk,
- niedriger Schwerpunkt,
- großer modularer Ladebereich oder Erzbehälter,
- robuste Kupplungs-/Bergungspunkte,
- keine militärische Panzerästhetik.

### C. Loader / Umschlaggerät

Gameplay-Funktion:

- Mine-/Lager-Umschlag,
- Cargo-Modul aufnehmen/absetzen,
- Erzbehälter oder Paletten bewegen.

Visuelle Anforderungen:

- kompakt,
- Arbeitsmechanik klar lesbar,
- kein universeller Fantasiekran,
- Werkzeug/Manipulator so angeordnet, dass der vorgesehene Cargo-Typ tatsächlich erreichbar ist.

### D. Cargo-Module

Mindestens:

- offener Bulk-/Erzbehälter für Metall/Regolith,
- geschlossener Standard-Frachtcontainer,
- Flatbed-/Palettenladung als modulare Variante.

Die Module müssen visuell auf die Ladeflächen passen. Ein Container darf nicht größer erscheinen als das Fahrzeug, das ihn tragen soll, wenn das nicht explizit als Anhänger-/Schwerlastfall gedacht ist.

## 6. Zustandsvarianten

Nicht für jedes Fahrzeug ein völlig neues Bild malen. Zustände sollen aus konsistenten Varianten derselben Formfamilie entstehen.

Für den ersten Slice werden benötigt:

- `empty` – Ladefläche leer,
- `partial` – erkennbare Teilbeladung,
- `full` – klar voller Ladezustand,
- optional `disabled` – kein Totalschadenbild, sondern technisch plausibel stillgesetzt / Warnstatus.

Bei Bulk-Fracht darf sich die sichtbare Füllhöhe ändern. Bei Containerfracht ändert sich die Anzahl/Belegung der Module.

Die Grundkarosserie, Kamera, Lichtführung und Proportionen müssen zwischen den Varianten identisch bleiben.

## 7. Richtungs- und Bewegungsdarstellung

Keine acht frei generierten Einzelbilder ohne Konsistenzkontrolle.

### Phase 1

Zuerst wird **eine einzige kanonische isometrische Außenansicht** pro Rolle erstellt und im Spiel integriert. Damit werden Stil, Maßstab, Lesbarkeit und Pipeline geprüft.

### Phase 2

Erst nach erfolgreichem In-Game-Test werden Bewegungsrichtungen ergänzt.

Bevorzugt:

- kontrollierter 4- oder 8-Richtungs-Sprite-Satz,
- identische Geometrie/Proportionen je Richtung,
- keine wechselnden Radzahlen, Aufbauten oder Cargo-Positionen,
- kein bloßes 2D-Rotieren eines isometrischen Fahrzeugs, wenn dadurch die Perspektive sichtbar falsch wird.

Animationen werden nur als Sprite-Strip/WebP oder APNG umgesetzt, wenn der Renderer sie tatsächlich nutzt. Kein GIF als Primärformat.

## 8. Dateiformate und Ablage

### Präsentationsassets

Bevorzugt:

- WebP mit Alpha für Rasterassets,
- SVG nur für einfache UI-/Kartenicons,
- sRGB,
- sauberer transparenter Rand ohne Farbsäume,
- keine eingebettete UI.

### Vorgeschlagene Pfade

Fahrzeuge:

```text
public/assets/vehicles/<role>/<world>/exterior-isometric.webp
public/assets/vehicles/<role>/<world>/exterior-detail.webp
```

Zustandsvarianten, falls separate Rasterdateien nötig sind:

```text
public/assets/vehicles/<role>/<world>/load-empty.webp
public/assets/vehicles/<role>/<world>/load-partial.webp
public/assets/vehicles/<role>/<world>/load-full.webp
```

Cargo:

```text
public/assets/cargo/<cargo-role>/<world>/exterior-isometric.webp
```

UI:

```text
public/assets/ui/logistics/vehicle.svg
public/assets/ui/logistics/transport-job.svg
public/assets/ui/logistics/load.svg
public/assets/ui/logistics/unload.svg
public/assets/ui/logistics/route-blocked.svg
```

Falls die vorhandene Assetstruktur vor Integration eine andere Konvention verlangt, wird sie **nicht parallel dupliziert**. Stattdessen wird die bestehende `lib/assets/catalog.ts`-Pipeline sauber erweitert.

## 9. Asset-Katalog und Fallback

Die bestehende Regel bleibt verbindlich:

- Spielidentität/Simulation bleiben im Game Model,
- Rasterbilder sind Präsentationsassets,
- fehlende Rasterassets dürfen das Spiel nicht brechen,
- es muss weiterhin einen funktionalen SVG-/procedural Fallback geben.

Vor Integration eines Fahrzeugs ist `lib/assets/catalog.ts` um einen geeigneten Vehicle-Asset-Typ zu erweitern oder die bestehende Pipeline kontrolliert zu generalisieren.

Nicht zulässig:

- Hardcoding von Bildpfaden direkt in mehrere Komponenten,
- neue Gameplay-IDs nur wegen eines Bildes,
- Entfernen eines funktionalen Fallbacks,
- direkte Kopplung von Bilddateinamen an Datenbank-Primary-Keys.

## 10. UI-/Kartenicons

Icons müssen bei kleiner HUD-Größe funktionieren.

Anforderungen:

- klare Silhouette,
- monochrom bzw. farbneutral nutzbar,
- keine Mini-Illustrationen mit Details, die bei 16–24 px verschwinden,
- logisch unterscheidbar zwischen Fahrzeug, Auftrag, Laden, Entladen, Route blockiert,
- keine Emoji-Ästhetik,
- kein Text im Icon.

## 11. Negativliste – ausdrücklich nicht erzeugen

Nicht akzeptiert werden:

- Cinematic Concept Art,
- Wallpaper / Key Art,
- Fahrzeuge in Landschaftsszenen mit Himmel/Horizont,
- bunte Sci-Fi-Racer,
- militärische APC-/Panzeroptik,
- neonleuchtende Cyberpunk-Fahrzeuge,
- zufällige Mars-/Mondlogos oder Schriftzüge,
- Fahrerportraits oder Personen als fester Bestandteil des Fahrzeugassets,
- inkonsistente Bildwinkel zwischen Ladezuständen,
- Bilder ohne transparente Freistellung,
- Assets, deren Schatten/Untergrund nicht zur aktuellen Kartenprojektion passen,
- technische Spezifikationen, Nutzlasten oder Abmessungen, die Engineering noch nicht geliefert hat.

## 12. Produktionsworkflow

### Gate 0 – Repo-/Renderer-Analyse

Vor Bildgenerierung:

1. Visual Bible lesen.
2. Asset-Katalog lesen.
3. vorhandene `exterior-isometric`-Assets untersuchen.
4. aktuellen Moon-Renderer / tatsächliche Einsatzgröße bestimmen.
5. Preflight-Protokoll schreiben.

### Gate 1 – Silhouette / Reference Sheet

Nur Cargo Rover und Heavy Hauler zunächst als technische Vergleichsansicht entwickeln.

Ergebnis muss zeigen:

- beide Rollen nebeneinander,
- identische Kamera,
- relative Größenordnung,
- leerer Ladezustand,
- Cargo-Modul als Größenreferenz.

Noch keine große Assetserie.

### Gate 2 – erster Game-Ready Prototyp

Nur **Cargo Rover / Moon / exterior-isometric** finalisieren:

- transparentes WebP,
- in Asset-Pipeline registrieren,
- Fallback erhalten,
- auf Shackleton-Karte einbauen,
- tatsächliche In-Game-Darstellung prüfen.

Erst wenn dieser Prototyp funktioniert, folgt Batch-Produktion.

### Gate 3 – Moon Vertical Slice

Danach:

- Heavy Hauler,
- Loader,
- Cargo-Module,
- Ladezustände,
- HUD-/Map-Icons.

### Gate 4 – Directional / Animation

Nur wenn Core/UI die Bewegung tatsächlich rendert.

### Gate 5 – Earth/Mars Adaptation

Keine neuen Fantasie-Fahrzeugfamilien. Dieselbe funktionale Grundfamilie wird umweltabhängig adaptiert:

- Earth: zivil/institutionell, etablierte Infrastruktur,
- Mars: Staub/oxidrote Patina, andere Umweltabschirmung,
- Moon: Vakuum, grauer Staub, harte Schatten.

## 13. In-Game-Abnahmetest

Jedes Fahrzeug muss vor `done` mindestens diese Prüfungen bestehen:

1. **Silhouette-Test:** Rolle bei normaler Kartenzoomstufe erkennbar.
2. **Scale-Test:** Größenrelation zu Gebäude/Cargo wirkt plausibel.
3. **Alpha-Test:** kein Hintergrundrechteck / Halo.
4. **Contrast-Test:** auf hellem und dunklem Mondterrain lesbar.
5. **Anchor-Test:** Fahrzeug steht optisch auf dem Boden und schwebt nicht.
6. **Cargo-Test:** leer/teil/voll klar unterscheidbar.
7. **Consistency-Test:** gleiche Kamera, Materialfamilie und Lichtführung über alle Varianten.
8. **Fallback-Test:** fehlendes Rasterasset bricht die Karte nicht.
9. **Repo-Test:** Dateipfade und Katalogeintrag stimmen; kein unreferenziertes Assetdumping.
10. **Gameplay-Neutralität:** Bild fügt keine neuen Regeln/Entitäten/technischen Fakten hinzu.

## 14. Definition of Done

Ein Assetpaket ist erst fertig, wenn der Grafik-Chat zurückmeldet:

- erzeugte Dateien und Pfade,
- zugehörige visuelle Rollen/Worlds,
- neue/angepasste Katalogeinträge,
- In-Game-Teststatus,
- bekannte offene Punkte,
- welche technischen Details absichtlich noch nicht kanonisiert wurden,
- Link/Commit/PR der Integration.

`done` bedeutet **im Spiel eingebaut und geprüft**, nicht nur „Bild erzeugt“.
