# noχ¹ᐃ · Projekt-Arbeitsbereiche

Dieses Dokument legt die dauerhafte Aufteilung der Entwicklungsarbeit für **noχ¹ᐃ** fest. Die Bereiche entsprechen den bevorzugten Projekt-Chats/Tabs und sollen verhindern, dass weltkörperspezifische Arbeit und gemeinsame Systeme doppelt entwickelt werden.

## Grundregel

Weltkörper definieren ihre **Umwelt, Geodäsie, Karten- und Geländedaten sowie ortsspezifische Regeln**. Gemeinsame Systeme definieren dagegen **Spielmechanik und wiederverwendbare Infrastruktur**.

```text
Weltkörper / räumliche Domänen
Erde | Mond | Mars | Orbit / Raumstationen
                │
                │ verwenden
                ▼
gemeinsame Systeme
Core | Gebäude & Innenräume | Fahrzeuge & Raumschiffe | Grafik / Assets
```

Ein Mondrover ist daher kein eigenes Mond-System: Der Mond liefert Gelände, Gravitation und Umweltbedingungen; das Fahrzeugsystem liefert Fahrzeugzustand, Bewegung, Energie, Fracht und Wartung. Entsprechend bestimmt der Mond den Standort eines Habitats, während das Gebäude-/Innenraumsystem dessen Räume und Funktionen definiert.

## 1. noχ¹ᐃ · Core / Architektur / Backend

Verantwortlich für alle systemweiten Grundlagen:

- persistierter Weltzustand
- Supabase-Schema und APIs
- Tick- und Zeitsystem
- Eigentum, Wirtschaft und Handel
- Build-System und Baufortschritt
- globale Objektidentitäten
- Reisen, Transfers und Zustandsübergänge
- gemeinsame Koordinaten- und Projektionsabstraktionen

Änderungen gehören hierher, wenn sie mehrere Weltkörper oder Gameplay-Domänen betreffen.

## 2. noχ¹ᐃ · Erde

Verantwortlich für die reale Erde als globalen WGS84-Koordinatenraum:

- globale Erdkarte und Ortssuche
- OSM- und Terrain-Daten
- Landschaft, Straßen und reale Gebäude
- Buildability und reale Bauflächen
- Selmecke
- SSF-Hauptsitz Bogenstraße 15, Sundern
- einzigartige kanonische Earth-Orte
- spätere aus Büchern bekannte reale oder fiktional erweiterte Orte

Regionen wie Sauerland oder Namibia sind Ansichten beziehungsweise Daten-/Gameplay-Bereiche innerhalb derselben Erde und keine getrennten Welten.

## 3. noχ¹ᐃ · Mond

Verantwortlich für den Mond als eigenen globalen Himmelskörper-Koordinatenraum:

- echte globale Mondkarte
- selenografische Breite/Länge
- globales Höhenmodell
- Krater, Mare und benannte Oberflächenstrukturen
- Geologie und Ressourcen
- Bauzonen und lokale Geländeeignung
- Mondbasen und Landepunkte
- Mond-spezifische Umweltparameter

### Startentscheidung Mond

Der Mond wird **nicht** als künstliche 32×24-Karte neu aufgebaut. Von Beginn an gilt:

```text
Mondkugel
  → globale selenografische Position
  → reales Höhen-/Geländemodell
  → lokale metrische Projektion für Interaktion und Bauen
  → persistierter globaler Standort
```

Dabei sollen dieselben allgemeinen Schnittstellen wie bei der Erde verwendet werden, ohne Erd-spezifische Geodäsie auf den Mond zu übertragen.

## 4. noχ¹ᐃ · Mars

Verantwortlich für Mars-spezifische Oberflächen- und Geodäsiearbeit:

- globale Marskarte
- Mars-Koordinatensystem
- MOLA-/Höhendaten
- reale Topographie und benannte Regionen
- Tharsis und weitere kanonische Spielräume
- Ressourcen und Geologie
- Mars-spezifische Bauphysik und Umweltbedingungen
- Siedlungs- und Routennetz

Das allgemeine Build-, Gebäude- und Fahrzeugsystem bleibt außerhalb dieses Bereichs.

## 5. noχ¹ᐃ · Orbit / Raumstationen

Verantwortlich für räumliche Domänen ohne feste planetare Oberfläche:

- Erd-, Mond- und Marsorbit
- Lagrange-Punkte
- Raumstationen
- Docking- und Anflugräume
- Stationsmodule und Außenstruktur
- orbitales Bauen
- räumliche Beziehungen und Transfers zwischen Orbitalobjekten

Innenräume von Stationsmodulen nutzen das gemeinsame Gebäude-/Innenraumsystem.

## 6. noχ¹ᐃ · Gebäude & Innenräume

Weltkörperübergreifender Bereich für betretbare Infrastruktur:

- Gebäudezustände und Funktionen
- Räume, Türen und Ebenen
- Innenraum-Navigation
- Personal und Bewohnerbezug
- Produktions-, Forschungs-, Verwaltungs- und Wohnfunktionen
- Erweiterungen und Module
- Makro-/Mikro-Konsistenz desselben Gebäudes

Ein Mondlabor und ein Marslabor sollen dieselbe technische Grundlage verwenden und nur durch Umwelt, Zustand, Ausstattung und Standort variieren.

## 7. noχ¹ᐃ · Fahrzeuge & Raumschiffe

Weltkörperübergreifender Bereich für mobile Objekte:

- Rover und Bodenfahrzeuge
- LKW und Transportfahrzeuge
- Züge und andere planetare Verkehrsmittel
- Flugzeuge, sofern relevant
- Raumschiffe
- Besatzung und Plätze
- Energie, Treibstoff und Reichweite
- Fracht
- Wartung und Zustand
- Navigation und Bewegung

Weltkörper liefern Untergrund, Gravitation, Atmosphäre und lokale Restriktionen; das Fahrzeugmodell bleibt gemeinsam.

## 8. noχ¹ᐃ · Grafik / Assets

Verantwortlich für die Darstellung, nicht für den Gameplay-Weltzustand:

- Gebäude-Tiles und Gebäudeansichten
- Terrain- und Landschaftsassets
- Fahrzeuge und Raumschiffe
- Cockpit-Elemente
- Kartenvisualisierung
- Innenraumgrafik
- Icons und UI-nahe Spielgrafik

Grafik muss den persistierten Zustand darstellen und darf keinen parallelen Spielzustand erzeugen.

## Optionaler Arbeitsbereich: noχ¹ᐃ · Release / QA / Testspieler

Für den laufenden produktiven Zustand kann ein eigener QA-Chat geführt werden:

- aktueller Production-Stand
- Regressionen und sichtbare Fehler
- Testspieler-Blocker
- Deployment-/Build-Status
- nächste testbare Funktion

Dieser Bereich besitzt keine eigene fachliche Source of Truth; Fehler werden anschließend in den verantwortlichen Bereich zurückgeführt.

## Wann weiter unterteilen?

Ein Bereich wird erst aufgeteilt, wenn er dauerhaft zu groß oder fachlich unabhängig wird. Beispiel Mond:

```text
noχ¹ᐃ · Mond
├─ Karte & Geodäsie
├─ Geologie & Ressourcen
├─ Siedlungen & Infrastruktur
└─ Missionen / Gameplay
```

Diese feinere Aufteilung ist derzeit ausdrücklich **nicht** nötig. Zunächst bleibt der Mond ein gemeinsamer Arbeitsbereich.

## Cross-Repository-Regel

Diese Arbeitsbereiche sind Zuständigkeiten innerhalb des `noxiagame`-Repositories. Wenn eine notwendige Änderung zu einem anderen Repository gehört, wird sie dort **nicht direkt umgesetzt**. Stattdessen wird im Ziel-Repository unter `external-tasks/open/` eine Markdown-Anforderung angelegt. Jedes Repository bleibt Source of Truth nur für seinen eigenen Zuständigkeitsbereich.
