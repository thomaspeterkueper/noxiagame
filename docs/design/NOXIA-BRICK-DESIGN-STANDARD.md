# NOXIA Brick Design Standard

Status: **Prototype Design Standard v0.1**  
Scope: physische/digitale Klemmbaustein-Modelle als Design-, Engineering- und Worldbuilding-Prototypen.  
Compatibility target: markenoffenes LEGO-kompatibles System-/Technic-Raster; konkrete Teile dürfen von LEGO, BlueBrixx/Part Packs, CaDA, Cobi, Mould King oder anderen kompatiblen Herstellern stammen.

## 1. Zweck

NOXIA-Klemmbausteinmodelle sind keine eigenständige Parallelwelt. Sie dienen dazu, kanonische NOXIA-Objekte räumlich, konstruktiv und modular zu prüfen.

Ein Brick-Modell soll mindestens eine dieser Fragen beantworten:

- Ist die Formensprache konsistent?
- Ist die technische Gliederung verständlich?
- Sind Module, Wartungsräume und Schnittstellen räumlich plausibel?
- Lassen sich verwandte Fahrzeuge/Gebäude aus gemeinsamen Baugruppen ableiten?
- Kann das Modell als Referenz für Game-Assets, Illustrationen oder spätere physische Modelle dienen?

Der Brick-Standard erzeugt keine neuen kanonischen Leistungsdaten. Masse, Nutzlast, Energie, Traktion, thermische Grenzen oder andere Engineering-Werte bleiben bei den dafür zuständigen NOXIA/KUEPER-Quellen.

## 2. Gestaltungsprinzipien

Der Standard übernimmt die NOXIA Visual Bible:

- Near-Future statt Fantasy-Sci-Fi.
- Funktional und reparierbar.
- Helle technische Außenflächen mit dunklen Strukturteilen.
- Sichtbare Wartungs- und Servicepunkte.
- Paneele, Tanks, Rohrleitungen, Kabelkanäle, Antennen, Schleusen und robuste Anschlusspunkte dürfen die Form mitbestimmen.
- Umgebungsspuren und Patina werden erst in Render-/Displayvarianten ergänzt; der Strukturprototyp bleibt zunächst lesbar und neutral.

Form follows function gilt stärker als dekorative Symmetrie.

## 3. Maßstabssystem

NOXIA verwendet drei Brick-Maßstabsklassen.

### B1 — System / Character Scale

Zweck:

- Innenräume
- Crew-Arbeitsplätze
- begehbare Fahrzeugkabinen
- Schleusen
- Werkstätten
- kleine Habitatabschnitte

Referenz: klassische Minifig-/Character-nahe Konstruktion. Keine harte reale Skalenzahl; entscheidend ist die räumliche Nutzbarkeit.

### B2 — Technical Display Scale

**Default für technische Prototypen.**

Zweck:

- Rover
- Landefahrzeuge
- Shuttles
- Triebwerke
- Bohrgeräte
- Maschinen
- Gebäudemodule

Regel: genügend groß, um Struktur, Systeme und austauschbare Module sichtbar zu machen, aber klein genug für reale Tischmodelle.

### B3 — Micro / Infrastructure Scale

Zweck:

- Raumstationen
- große Schiffe
- Kolonieübersichten
- Spaceports
- Minenkomplexe
- Flotten

Details werden abstrahiert; Schnittstellen und Silhouette haben Vorrang.

Ein Objekt kann in mehreren Maßstäben existieren. Diese Varianten müssen dieselbe Design-DNA behalten.

## 4. Raster und Primärstruktur

### 4.1 System-Raster

Das horizontale Noppenraster ist die Basiseinheit für Hüllen, Plattformen und Raumaufteilung.

### 4.2 Technic-Raster

Technic-Lochabstände bilden das bevorzugte Raster für:

- tragende Chassis
- Achs-/Radaufnahmen
- Gelenke
- Kräne
- Fahrwerke
- schwenkbare Sensoren
- austauschbare Maschinenmodule

### 4.3 Mischbauweise

NOXIA-B2-Modelle sollen bevorzugt einen Technic-Kern mit System-Verkleidung verwenden:

```text
System panels / hull
        ↓
interface brackets / SNOT
        ↓
Technic structural frame
        ↓
functional module interfaces
```

Das erlaubt robuste Modelle und gleichzeitig eine präzise Formensprache.

## 5. NOXIA-Modulraster

Für B2 wird als erste Testnorm ein **4-Stud Interface Unit (4SIU)** eingeführt.

Eine funktionale Baugruppe soll bevorzugt Breiten/Längen in Vielfachen von 4 Noppen verwenden. 2-Noppen-Unterteilungen sind für Detail- und Adapterbereiche erlaubt.

Der 4SIU ist zunächst **Prototypstandard**, kein In-Universe-Maß. Er darf nach den ersten Modellen angepasst werden.

Beispiele:

- 4 Stud: kleine Geräte-/Sensorbaugruppe
- 8 Stud: Standard-Nutzlast- oder Energieblock
- 12 Stud: größeres Fahrzeug-/Maschinenmodul
- 16 Stud: Kabinen- oder Habitatquerschnitt

## 6. Schnittstellen

Physische Brick-Schnittstellen sollen reale NOXIA-Schnittstellen sichtbar machen, ohne sie 1:1 vorzugeben.

### S1 — Structural Interface

Robuste mechanische Verbindung; bevorzugt Technic Pins/Axles oder mehrpunktige System-Verzahnung.

### S2 — Service Interface

Visuelle Kennzeichnung von Energie, Daten, Fluid oder Wartungszugang. Im Modell durch Clips, Bars, Hoses, Round Plates, Tiles oder farbliche Marker darstellbar.

### S3 — Payload Interface

Werkzeuglos oder mit wenigen Verbindungen lösbares Nutzlastmodul.

### S4 — Crew/Pressure Interface

Für Kabinen, Luftschleusen und druckbeaufschlagte Module. Muss geometrisch von offenen Cargo-/Serviceinterfaces unterscheidbar bleiben.

## 7. Farblogik

Die Farbe dient primär der Lesbarkeit des Systems.

- Weiß / sehr hellgrau: Außenhaut, druckbeaufschlagte oder thermisch kontrollierte Bereiche
- Dunkelgrau / schwarz: Primärstruktur, Fahrwerk, robuste Mechanik
- Mittelgrau / metallic: Maschinen, Leitungen, ungeschützte technische Baugruppen
- Gelb / orange: Wartung, Handhabung, industrielle Gefahren-/Servicebereiche
- Rot: Notfall, Sperre, Rettung; sparsam
- Blau / cyan: Forschung, Sensorik oder Daten; sparsam und nicht dekorativ
- Transparent: Fenster, Linsen, Leuchten, optische Sensorik

Die genaue Teilefarbe darf wegen realer Teileverfügbarkeit abweichen. Funktionale Farblogik ist wichtiger als Farbpurismus.

## 8. Formensprache

NOXIA-Fahrzeuge und Maschinen sollen folgende Merkmale bevorzugen:

1. klar lesbarer tragender Kern,
2. aufgesetzte oder eingehängte Funktionsmodule,
3. wenig rein dekorative Verkleidung,
4. erreichbare Wartungsbereiche,
5. asymmetrische Details sind erlaubt, wenn sie funktional begründet sind,
6. Sensoren, Kühler, Tanks, Batterien und Cargo dürfen als eigene Baugruppen erkennbar sein,
7. Räder/Fahrwerke wirken belastbar und austauschbar,
8. keine übermäßige Verwendung klassischer Space-Fighter-Silhouetten.

## 9. Modell-Dokumentation

Jedes kanonisierungsfähige Brick-Modell erhält:

- Objektname
- Brick-Modell-ID
- zugehörige NOXIA-Entity oder Rolle
- Maßstabsklasse B1/B2/B3
- Außenmaße in Studs
- verwendetes Modulraster
- Schnittstellen S1–S4
- Funktionsmodule
- bewegliche/funktionale Elemente
- Teilezahl (sobald Modell digital gebaut ist)
- Teileliste/BOM (sobald stabil)
- Ansichten: front, rear, left/right, top, 3/4
- Änderungslog
- Liste der durch das Modell entdeckten Designprobleme

## 10. Abnahmekriterien

Ein B2-Prototyp gilt als erfolgreich, wenn:

1. seine Funktion ohne Beschriftung weitgehend erkennbar ist,
2. Primärstruktur und Verkleidung getrennt lesbar sind,
3. mindestens ein Funktionsmodul zerstörungsarm austauschbar ist,
4. Wartungszugänge sichtbar sind,
5. das Modell physisch stabil baubar ist,
6. die Silhouette zur NOXIA Visual Bible passt,
7. keine neuen technischen Kanonwerte durch das Modell erfunden wurden,
8. mindestens eine Erkenntnis zurück in Game-/Asset-/Engineering-Design überführt werden kann.

## 11. Ersttest

Der erste Referenztest ist ein **NOXIA Cargo Rover in B2 Technical Display Scale**.

Er prüft gleichzeitig:

- 4SIU-Modulraster,
- Technic-Kern + System-Hülle,
- Fahrwerksmodularität,
- Cargo-Schnittstelle,
- Energie-/Serviceblock,
- Sensorik,
- Wartungszugänge,
- Ableitbarkeit weiterer Rovervarianten.

Nach dem Rover wird v0.1 bewertet. Erst danach wird der Standard als v0.2 erweitert oder korrigiert.
