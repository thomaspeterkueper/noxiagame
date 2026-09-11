# noχ¹ᐃ · Moon Surface Logistics · Shackleton

Status: **Moon-Gameplay-Policy**  
Source of Truth: `noxiagame` für Gameplay/Runtime; technische Fahrzeugauslegung bleibt KUEPER Engineering.

## Ziel

Die Shackleton-Kolonie erhält eine physische, aber automatisierbare Oberflächen-Logistikkette. Gefördertes Material springt nicht direkt von einer Mine in ein globales Lager.

```text
Mine
  ↓
Minenpuffer
  ↓
Cargo Rover / Heavy Hauler
  ↓
Verarbeitung / Zwischenpuffer (optional)
  ↓
Warenhaus / Logistik-Hub
  ↓
Shuttle-Port-Lager
  ↓
Transfer-Shuttle
  ↓
Lunar Orbital Interface
```

Die letzte Strecke **Shuttle-Port ↔ Lunar Orbital Interface** gehört nicht mehr zum Surface-Logistics-Routing. Sie folgt der bestehenden Trennung aus `lib/game/logisticsNodes.ts` und `lib/game/transportDomains.ts`.

## Zuständigkeitsgrenzen

### Moon-Domain

Der Mond bestimmt:

- welche Oberfläche vorliegt,
- welches reale/abgeleitete Höhenprofil eine Route besitzt,
- welche Steigung und Rauigkeit daraus folgen,
- welche Trassenklasse vor Ort existiert,
- ob ein Routensegment für eine gegebene Fahrzeug-Mobilitätshülle passierbar ist.

### Core

Core besitzt weiterhin:

- Objektinventare,
- Fahrzeugfracht,
- Transportaufträge,
- Tick-/Job-Ausführung,
- Reservierung von Quelle/Ziel/Fracht,
- Persistenz und Zustandsübergänge.

### KUEPER Engineering

Engineering besitzt:

- Fahrzeugmasse und Nutzlast,
- Fahrwerk/Räder,
- reale Traktions- und Steigungsgrenzen,
- Geschwindigkeit und Energiebedarf,
- thermische und mechanische Grenzen,
- Wartung und technische Infrastrukturfolgen.

Dafür wurde der Request `EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS` im Engineering-Repository angelegt.

## Oberflächenknoten

### Minenpuffer

Eine Mine benötigt einen lokalen Ausgangspuffer. Produktion schreibt zunächst in diesen Puffer. Ein Transportjob entnimmt daraus reale Frachtmengen. Damit bleiben Förderung und Fahrzeugtakt voneinander entkoppelt.

### Verarbeitungs-/Zwischenpuffer

Schmelze oder Fabrik können einen eigenen Ein-/Ausgangspuffer besitzen. Dieser Knoten ist optional; er wird nur verwendet, wenn ein Produktionsschritt tatsächlich zwischen Mine und Endlager liegt.

### Warenhaus / Logistik-Hub

Der Hub ist der lokale Verteilknoten der Kolonie. Er bündelt Fracht, Fahrzeugzuweisung und Weiterleitung. Er ist kein Ersatz für das gemeinsame Core-Inventarmodell, sondern eine physische Rolle eines bestehenden Weltobjekts.

### Shuttle-Port-Lager

Dieser Knoten ist die Oberflächengrenze. Fracht, die hier eintrifft, kann von einem Transfer-Shuttle übernommen werden. Intersolare Schiffe landen hier nicht direkt.

## Fahrzeugrollen

### Cargo Rover

Gameplay-Rolle:

- mittlere, flexible Frachtmengen,
- wechselnde Quellen/Ziele,
- lokale Verteilung,
- häufiger Offroad-/Prepared-Track-Anteil,
- hohe Flexibilität bei geringerem Durchsatz.

### Heavy Hauler

Gameplay-Rolle:

- hohe Frachtmenge,
- wiederkehrende industrielle Korridore,
- bevorzugt vorbereitete oder befestigte Schwerlastrouten,
- höherer Durchsatz,
- geringere Routenflexibilität und größere Bedeutung von Depot/Bergung.

NOXIA setzt bis zur Engineering-Antwort keine technischen Nutzlast-, Steigungs- oder kWh-Werte als Kanon.

## Terrain- und LOLA-Routing

Die bestehende renderer-unabhängige LOLA-/Terrain-Sampling-Grenze bleibt verbindlich. Routing konsumiert daraus ein Höhenprofil; es liest keine Renderer-Pixel und erzeugt kein zweites Terrainmodell.

Aus einem Profil werden mindestens abgeleitet:

- Routendistanz,
- kumulierter Anstieg,
- kumulierter Abstieg,
- mittlere absolute Längsneigung,
- maximale absolute Längsneigung.

Die reine Gameplay-Policy steht in `lib/game/moonSurfaceLogistics.ts`.

### Routentypen

`offroad`
: unbearbeitetes Terrain; höchste Rauigkeits-/Energiebelastung, niedrigste Fahrgeschwindigkeit und konservativste nutzbare Steigung.

`prepared-track`
: geräumte, planierte oder verdichtete Trasse; geringere Rauigkeit und reproduzierbarere Fahrbedingungen.

`hardened-road`
: dauerhaft stabilisierte/gesinterte Schwerlastfahrbahn; höchste planbare Geschwindigkeit und beste energetische/operative Effizienz innerhalb des Oberflächenmodells.

Die derzeitigen Faktoren sind **dimensionlose, provisorische Gameplay-Koeffizienten**. Sie bilden nur die korrekte Ordnung der drei Klassen ab. Absolute technische Werte kommen aus Engineering.

## Routing-Kosten

Für jedes Kandidatensegment gilt konzeptionell:

```text
LOLA-/Terrain-Profil
  → Steigungsmetriken
  → vorhandene Route-Klasse
  → technische Mobilitätshülle des aktuellen Fahrzeugs
  → passierbar / nicht passierbar
  → relative Geschwindigkeit
  → relativer Energieaufwand
  → Pfadkosten
```

Eine kürzere Strecke kann daher schlechter sein als ein längerer Umweg, wenn sie steiler oder deutlich rauer ist. Das ist für Shackleton ausdrücklich erwünscht.

Unaufgelöste Terrainzellen dürfen nicht stillschweigend als flach interpretiert werden. Wenn keine belastbare Terrainprobe vorliegt, bleibt das Segment unbekannt beziehungsweise benötigt eine bewusst definierte Fallback-Policy.

## Automatische Transportaufträge

Der Spieler soll **Logistikbeziehungen** konfigurieren, nicht jede einzelne Roverfahrt fahren müssen.

Empfohlene Bedienlogik:

1. Quelle auswählen, z. B. Mine A.
2. Ziel auswählen, z. B. Logistik-Hub oder Shuttle-Port.
3. Ressource/Frachtklasse festlegen.
4. Mindestreserve am Quellknoten und Zielbestand/Zielquote definieren.
5. zugelassene Fahrzeugrolle(n) festlegen.
6. Route automatisch berechnen oder manuell priorisieren.
7. Core erzeugt bei Bedarf wiederholbare Transportjobs.

Im UI sichtbar:

- Fracht im Quellpuffer,
- freie Zielkapazität,
- zugewiesene Fahrzeuge,
- wartende/aktive Transporte,
- ETA,
- erwarteter Durchsatz,
- Route-Klasse,
- Terrain-/Steigungswarnungen,
- Engpassstatus.

Manuelle Fahrten bleiben für Exploration, Störungen, Bergung oder besondere Missionen möglich, sind aber nicht der Normalbetrieb industrieller Logistik.

## Progression

### Frühe Shackleton-Phase

- kurze Strecken,
- wenige Cargo Rover,
- viel Offroad,
- kleine lokale Puffer,
- einzelne vorbereitete Trassen nur an kritischen Stellen.

### Wachstumsphase

- feste Mine-Hub-Korridore,
- Heavy Hauler ergänzen Cargo Rover,
- größere Puffer,
- `prepared-track` wird Standard auf wiederkehrenden Routen,
- Wartungs-/Bergungspunkte werden relevant.

### Industriephase

- hohe Durchsätze,
- dedizierte Schwerlastkorridore,
- `hardened-road` dort, wo Lebenszyklus und Frachtvolumen den Bau rechtfertigen,
- mehrere parallele/alternative Routen für Resilienz,
- Shuttle-Port als klarer Export-Engpass.

## Akzeptanz für den ersten spielbaren Slice

Der erste vollständige Slice ist erreicht, wenn:

1. eine Mine Metall in einen lokalen Puffer produziert,
2. ein Core-Transportjob eine reale Frachtmenge reserviert,
3. ein Cargo Rover oder Heavy Hauler eine terrainabhängige Route erhält,
4. Steigung/Route-Klasse ETA und Energiebedarf beeinflussen,
5. die Fracht nach Ankunft im Zielinventar liegt,
6. der Shuttle-Port die Fracht als separate Surface-to-Orbit-Übergabe übernimmt,
7. keine direkte Mine→Global-Lager-Teleportation mehr nötig ist.

## Offene Abhängigkeit

Die technischen Fahrzeugkennfelder sind bewusst offen, bis KUEPER Engineering den Request `EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS` beantwortet. Bis dahin dürfen provisorische NOXIA-Koeffizienten nur als Gameplay-Policy, nicht als physikalische Fahrzeugdaten behandelt werden.
