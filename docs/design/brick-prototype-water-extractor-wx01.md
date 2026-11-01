# NOXIA Brick Prototype WX-01 · Wasserextraktor Typ M

Status: **Konstruktionsentwurf v0.1 – noch nicht in Studio oder physisch validiert**  
Standard: `docs/design/NOXIA-BRICK-DESIGN-STANDARD.md` v0.1  
Objekt: `OTA-TEC-0034-WEX-M` (`wasserextraktor-mars-typ-m`), Dossier `DOC:OTA:OTA-TEC-0034-2026-DE` v1.1  
Spielobjekt heute: `water_recycler` (siehe `NOXIA-REQ-20261101-typ-m-wasserextraktor-konsistenz.md`)  
Maßstabsklasse: **B2 – Technical Display Scale**  
Zweiter Einsatz: B-Roll für das SSF-Lernvideo „Wasser auf dem Mars“

> Wichtig: Alle Maße in diesem Dokument sind **Modellmaße in Studs/Bricks**. Sie legen keine Durchsatzmengen, Energiewerte, Temperaturen, Eisgehalte oder anderen Engineering-Werte fest. Diese bleiben bei OTA-TEC-0034 und im KG (`PHY-WASSER-VAKUUM-0001`).

## 1. Testziel

WX-01 ist der erste **stationäre** Prototyp nach dem Brick-Standard. CR-01 hat Fahrzeuge geprüft; WX-01 prüft, ob der Standard auch Gebäudemodule trägt.

Fragen an das Modell:

- Ist der Prozess ohne Beschriftung lesbar: Regolith rein → heizen → Dampf → Kälte → Wasser raus, Abraum raus?
- Funktioniert das 4SIU-Raster für eine Anlage auf einer Grundplatte statt auf einem Chassis?
- Kann CR-01 an WX-01 andocken, sodass zwei Brick-Modelle eine **Prozesskette** bilden?
- Lässt sich der Reaktor öffnen, ohne die Anlage zu zerlegen (Wartung und Kamera)?
- Ist eine spätere Gen-2-Variante (Mikrowelle) als Modultausch ableitbar?

## 2. Verfahren, das sichtbar werden muss

Nur qualitativ, aus OTA-TEC-0034 und dem Audit `RES-20260829-TEC0034A`:

1. **Aufgabe:** eishaltiger Regolith wird angeliefert (Gen 1: Aushub, also per Rover).
2. **Geschlossener, beheizter Reaktor:** Eis wird erwärmt und sublimiert. Der Reaktor ist geschlossen, weil der Mars-Bodendruck nahe am Tripelpunkt liegt und der Dampf sonst entweicht.
3. **Dampfleitung:** Dampf wird aktiv abgesaugt.
4. **Kühlfalle:** Dampf resublimiert zu Frost; Kälte aus der Marsnacht hilft (Tag/Nacht-Zyklus).
5. **Aufbereitung:** Perchlorate werden abgetrennt.
6. **Tank:** Produktwasser.
7. **Abraum:** trockener Regolith verlässt die Anlage.

Diese sieben Stationen sind die Module des Modells. Jede soll von außen als eigene Baugruppe erkennbar sein.

## 3. Silhouette

Eine niedrige, breite Industrieanlage mit **einem hohen Element** (Tankturm) und **einer liegenden Trommel** (Reaktor) als Blickfang. Rohre verbinden die Stationen sichtbar in Prozessreihenfolge. Die Kühlfalle hat nach oben offene Radiatorflächen.

Visuelle Prioritäten:

1. Prozessfluss von einer Ecke zur gegenüberliegenden lesbar,
2. dunkler Tragrahmen bleibt zwischen den Modulen sichtbar,
3. Reaktor als größtes, geschlossenes Volumen,
4. Tank als vertikaler Kontrast,
5. Wartungsgang in Gelb zwischen Reaktor und Kühlfalle,
6. Aufgabebunker an der Plattenkante, damit ein Rover andocken kann,
7. keine Kuppeln, keine Glasflächen, nichts Wohnliches – Typ M ist eine Maschine, kein Habitat.

## 4. Modellhülle

- Grundplatte: **32 × 32 Studs** (eine Standard-Grundplatte, 8 × 8 Zellen à 4SIU). Entspricht dem 2×2-Footprint im Spiel.
- Tragrahmen: dunkle Plattform, 1 Plate hoch über der Grundplatte, mit Lücken als Kabelkanäle.
- Höhe der Anlage ohne Turm: **6–8 Bricks**.
- Tankturm: **12–14 Bricks**, plus Antenne/Entlüftung.
- Andockkante für CR-01: eine Plattenkante frei, Bunkeröffnung auf Höhe der CR-01-Ladefläche.

## 5. Modulplan

Draufsicht, 1 Zeichen ≈ 4 Studs (4SIU). Vorne = Andockkante (Y=0).

```text
          VORNE · Andockkante für CR-01
     0   4   8  12  16  20  24  28  32
  0  ┌───────┬───────────────┬───────┐
     │  M1   │  Förder-      │  M6   │
  4  │Aufgabe│  schnecke ──► │Energie│
     │       │               │Steuer.│
  8  ├───────┼───────────────┼───────┤
     │       │               │       │
 12  │  M7   │      M2       │  M5   │
     │Abraum │   REAKTOR     │ TANK  │
 16  │ ◄──── │   (liegend)   │(Turm) │
     │       │               │       │
 20  ├───────┴───────────────┤       │
     │▒▒▒▒▒ Wartungsgang ▒▒▒▒│       │
 24  ├───────────────┬───────┼───────┤
     │      M3       │  M4   │ frei/ │
 28  │  KÜHLFALLE    │Aufber.│Erweit.│
     │ (Radiatoren↑) │       │       │
 32  └───────────────┴───────┴───────┘
          HINTEN
```

Prozessweg: M1 → Schnecke → M2 → Dampfleitung → M3 → M4 → M5; Abraum M2 → M7.

Die Dampfleitung läuft **über** den Wartungsgang (Rohrbrücke), damit der Gang frei bleibt.

### M1 – Aufgabebunker
Footprint **8 × 8**. Trichter (umgedrehte Slopes) mit Oberkante auf CR-01-Ladeflächenhöhe, an der Plattenkante. Gelbe Kantenmarkierung als Abwurfzone. Darunter der Einzug der Förderschnecke.

### Förderschnecke
Zone **16 × 8** zwischen M1 und M6; die Rinne selbst ist 4 Studs breit und führt von M1 schräg auf den Einlass von M2. Darstellung als geschlossene Rinne oder Rohr mit Technic-Achse im Inneren; eine Inspektionsklappe zeigt die Schnecke. Wenn sich die Achse drehen lässt, gut – Pflicht ist es nicht.

### M2 – Reaktor
Footprint **16 × 12**, Zentrum der Anlage. Liegende Trommel (gerundete Bricks oder Halbzylinder) auf dunklen Sätteln. Weiß/hellgrau, weil thermisch kontrolliert. Muss:

- als Ganzes abnehmbar sein (S1, 4 Punkte),
- eine aufklappbare Hälfte haben (Scharnier), die Heizstäbe im Inneren zeigt (orange/transparent-orange Stäbe als Heizer-Lesart),
- zwei Abgänge haben: oben Dampf (zu M3), unten Abraum (zu M7).

### M3 – Kühlfalle
Footprint **16 × 8**. Kastenförmiger Kondensator mit nach oben gerichteten Radiatorflächen (Grille-Tiles, Lamellen). Hell, weil Wärme abgegeben wird. Eine abnehmbare Deckplatte zeigt die Frostfläche im Inneren (nur Display-Variante, siehe 9).

### M4 – Aufbereitung
Footprint **8 × 8**. Zwei bis drei kleine, verschieden große Behälter (Filterstufen) mit Rohrbündel. Ein rotes Element als Sperre/Probe-Entnahme – sparsam, weil Perchlorat ein Gefahrstoff ist.

### M5 – Tankturm
Footprint **8 × 16**. Hoher weißer Zylinder (gestapelte Rundsteine 4×4 oder 2×2) mit Leiter, Füllstandsstreifen und Zapfstelle auf Bodenhöhe. Der Turm ist das Wiedererkennungszeichen der Anlage aus der Ferne.

### M6 – Energie/Steuerung
Footprint **8 × 8**. Geschlossener Kasten mit Service-Paneel, externem Stromanschluss (S2) zu einer Solar- oder Reaktorleitung außerhalb der Platte, kleinem Antennen-/Sensormast (blau sparsam = Daten).

### M7 – Abraum
Footprint **8 × 12**. Rutsche aus M2 nach außen, kleiner Haufen trockener Regolith (rot-braune Plates) an der Plattenkante. Zeigt: Der Rest ist trocken, das Wasser ist raus.

### Wartungsgang
Footprint **24 × 4**, gelbe Bodenplatten, Geländer, Zugang zu M2-Klappe und M3. Erfüllt Abnahmekriterium „Wartungszugänge sichtbar“.

## 6. Schnittstellen

### S1 Structural
- M2 Reaktor: 4-Punkt-Befestigung auf Technic-Sätteln, abnehmbar ohne Rohre zu zerstören (Rohre stecken nur, Clip/Bar).
- M5 Tank: 2-Punkt-Befestigung, abnehmbar.
- Alle anderen Module: auf Tragrahmen gepinnt, je mindestens 2 Punkte.

### S2 Service
Sichtbar mindestens:
- Dampfleitung M2 → M3 (dick, hell),
- Wasserleitung M3 → M4 → M5 (dünn, blau-grau),
- Stromtrasse M6 → M2 (Heizung) und M6 → M3 (Kühlung), in den Kabelkanälen des Rahmens,
- externer Stromanschluss an M6.

### S3 Payload
- **Neu: S3-Andockpunkt für CR-01.** Bunkeroberkante und eine Anschlagleiste an der Plattenkante passen zur Höhe und Breite des CR-01-Cargomoduls (8 × 12). CR-01 fährt rückwärts oder seitlich an; eine Kippmulde als CR-01-Cargo-Variante ist der passende Gegenpart (siehe 11).

### S4 Crew/Pressure
Nicht vorhanden. WX-01 ist unbemannt und wird aus dem Habitat oder im Anzug gewartet. Bewusst keine Schleuse, damit die Anlage nicht als Wohnmodul gelesen wird.

## 7. Farblogik

- Tragrahmen, Sättel, Rinne: schwarz/dunkelgrau
- Reaktor, Tank, Kühlfalle, Steuerkasten: weiß/hellgrau
- Rohre, Pumpen, Ventile: mittelgrau/metallic
- Wartungsgang, Abwurfzone, Leitern, Griffe: gelb/orange
- Perchlorat-Sperre: rot, ein Element
- Datenmast: ein blaues/cyanes Element
- Heizstäbe im Reaktorinneren: orange oder trans-orange
- Regolith/Abraum: rotbraun/dark orange
- Inspektionsfenster: trans-clear

## 8. Teilefamilien

Markenoffen, wie CR-01:

- Grundplatte 32 × 32, Plates 1×N/2×N/4×N/6×N
- Technic-Liftarms 5L–15L und Pins für Rahmen und Sättel
- Rundsteine 2×2 und 4×4, Rundplatten und Rundtiles für Tank und Rohrenden
- gebogene Slopes/Halbbögen oder Zylinderhälften für die Reaktortrommel
- Scharnierplatten für Reaktorklappe und Kühlfallendeckel
- Grille-Tiles für Radiatoren
- Bars, Clips, Schläuche, Hoses für Rohrleitungen
- umgedrehte Slopes für den Trichter
- Leitern, Geländer, Zäune für Wartungsgang und Turm
- wenige transparente Elemente für Fenster und Heizstäbe

Konkrete Teilenummern und BOM folgen erst in einer Build-Datei nach dem ersten Studio-Bau, wie bei CR-01.

## 9. B-Roll-Konfiguration (SSF-Lernvideo)

Für die Kamera gibt es eine **Display-Variante**, die vom Strukturprototyp abweicht:

- Reaktorklappe offen: Heizstäbe in trans-orange sichtbar.
- Kühlfallendeckel ab: Innenfläche mit weißen 1×1-Rundplatten als Frost.
- Dampfleitung: ein trans-clear-Abschnitt als „Schauglas“.
- Abraumhaufen etwas größer, Grundplatte mit rotbraunem Regolith-Rand.
- CR-01 am Bunker angedockt.

Empfohlene Einstellungen:

1. **Totale 3/4 von vorne links:** Bunker, Reaktor und Turm in einer Diagonale – zeigt den Prozessweg.
2. **Fahrt entlang der Dampfleitung** von M2 nach M3 – passt zur Stelle im Skript, an der der Dampf „eingefangen“ wird.
3. **Nahaufnahme Reaktor offen** – Heizstäbe.
4. **Nahaufnahme Kühlfalle** – Frost, als Bild für „Dampf wird wieder zu Eis“.
5. **Tiefe Kamera am Abraum, Turm im Hintergrund** – „trockener Rest, Wasser im Tank“.
6. **Rover dockt an** – Übergang zum Spiel, falls das Outro den Hinweis „Im Spiel erlebbar“ bekommt.

Hinweis fürs Skript: Das Modell zeigt Gen 1 (Aushub + geschlossener Reaktor). Die Mikrowellen-Variante ist laut Dossier erst Gen 2; das Video sollte sie nicht mit diesem Modell bebildern.

## 10. Bauabfolge

### Stufe 1 – Rahmen und Raster
Grundplatte, Tragrahmen, Kabelkanäle, Pin-Punkte für alle Module.  
Test: Trägt das 4SIU-Raster eine Anlage? Bleiben Kanäle sichtbar?

### Stufe 2 – Reaktor
M2 auf Sätteln, abnehmbar, mit Klappe.  
Test: Lässt sich die Klappe öffnen, ohne dass Rohre abfallen?

### Stufe 3 – Prozesskette
M1, Schnecke, M3, M4, M5, M7 als Rohbau; Rohre stecken.  
Test: Ist der Prozessweg ohne Beschriftung lesbar?

### Stufe 4 – Energie, Wartung, Andockkante
M6, Wartungsgang, S3-Andockpunkt.  
Test: Passt CR-01 an den Bunker, ohne dass das Modell kippt oder der Rover angehoben werden muss?

### Stufe 5 – Haut und Display
Paneele nur, wo sie nichts Wichtiges verdecken; dann Display-Teile aus Abschnitt 9.

## 11. Abnahme (nach Standard §10)

- [ ] Funktion ohne Beschriftung erkennbar (Prozessweg sichtbar)
- [ ] Tragrahmen und Verkleidung getrennt lesbar
- [ ] Reaktor M2 zerstörungsarm abnehmbar
- [ ] Wartungsgang und Reaktorklappe sichtbar zugänglich
- [ ] Modell stabil, auch beim Anheben an der Grundplatte
- [ ] Silhouette industriell, kein Habitat-Eindruck
- [ ] kein Engineering-Wert erfunden
- [ ] CR-01 dockt am Bunker an
- [ ] mindestens eine Erkenntnis an Game-Asset oder Request zurückgemeldet

## 12. Erwartete Erkenntnisse

1. Ob 4SIU auf Grundplatten genauso gut funktioniert wie auf Chassis.
2. Ob 32 × 32 für einen 2×2-Spiel-Footprint der richtige Modellmaßstab ist.
3. Ob ein gemeinsamer S3-Standard für Fahrzeug-Gebäude-Kopplung nötig ist (Höhe, Breite, Anschlag).
4. Ob die liegende Reaktortrommel als Formensprache für weitere ISRU-Anlagen taugt.
5. Ob das Sprite `water_recycler-machine` (Tanks, Turm, Leitungen, Wartungsbereich) mit dem Modell übereinstimmt oder angepasst werden sollte.

## 13. Folgemodelle

- **CR-01-D Kipp-Variante:** CR-01 mit Kippmulde statt Cargo-Deck, als Lieferfahrzeug für WX-01. Testet, ob der Standard Fahrzeug und Gebäude zu einer Familie macht.
- **WX-02 Gen 2 (Mikrowelle):** M1 und Schnecke entfallen, an ihre Stelle tritt ein Emitter-Ausleger über einer Bodenhaube. M3–M7 bleiben gleich. Testet, ob Generationen als Modultausch abbildbar sind.

## Änderungslog

- v0.1 (2026-11-01): Erstentwurf auf Basis Brick-Standard v0.1, CR-01 und OTA-TEC-0034; ergänzt um B-Roll-Konfiguration für das SSF-Lernvideo.
