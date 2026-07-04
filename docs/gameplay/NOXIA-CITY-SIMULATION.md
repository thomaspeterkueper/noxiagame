# NOXIA — Stadtentwicklung und Zivilisationssimulation
## Regelwerk der Welt

**Status:** Proposed  
**Erstellt:** 04.07.2026  
**Aktualisiert:** 04.07.2026 — Ressourcen-Invariante: Lokale Endlichkeit + globale Frontier  
**Autor:** Thomas Peter Küper  
**Verhältnis zu anderen Dokumenten:**  
Dieses Dokument beschreibt die Regeln der Welt — nicht Code, nicht Tabellen, nicht UI.  
Es ist die Grundlage für `GDD-BUILDINGS.md`, `GDD-ECONOMY.md` und alle späteren Datenmodell-Entscheidungen.

---

## 1. Die grundlegende Frage: Wem gehört Land?

Dies ist die wichtigste Architekturentscheidung des gesamten Spiels.  
Sie beeinflusst Immobilienmärkte, Expansion, politische Konflikte und die Lebendigkeit von Kolonien.

### Entscheidung: Modell B — Land hat Eigentümer

Land gehört nicht automatisch dem Spieler. Jede Kachel hat einen Eigentümer.

**Mögliche Eigentümer:**
- **Spieler** — hat das Land gekauft oder als Startausstattung erhalten
- **Staat** — öffentliche Infrastruktur, Raumhäfen, Straßen
- **NPC-Firmen** — HeliosCorp, unabhängige Händler, lokale Unternehmen
- **Bürger** — Wohnhäuser, Geschäfte, Handwerksbetriebe
- **Niemand** — unerschlossenes Land (günstig, aber weit vom Zentrum)

**Warum nicht Modell A (alles gehört dem Spieler)?**  
Weil es keinen Immobilienmarkt, keine Expansion, keine politischen Konflikte und keine lebendige Stadt erzeugt.  
SimCity ist mächtig, aber seine Städte sind Kulissen — sie gehören dem Spieler vollständig und reagieren nicht auf ihn.

**Was entsteht automatisch durch Modell B:**
- Bodenwert (Lage × Nutzung × Nachfrage)
- Expansionskonflikte (Nachbarfeld gehört jemand anderem)
- Stadtteile (Industriegebiet, Wohnviertel, Hafenzone entstehen ohne Skript)
- Mieten (Bürger zahlen für Fläche)
- Enteignungen (als politische Entscheidung, nicht als Standard)
- Spekulation (wer kauft jetzt, gewinnt später)

---

## 2. Die drei Eigentums-Kategorien einer Kachel

| Kategorie | Bedeutung |
|-----------|-----------|
| **Grundstück** | Wem gehört dieses Feld? |
| **Gebäude** | Was steht darauf? |
| **Nutzung** | Wofür wird es verwendet? |

Diese Trennung ermöglicht realistische Situationen:
- Ein Spieler besitzt das Land, eine NPC-Firma hat es gepachtet und eine Mine betrieben
- Der Staat besitzt den Raumhafen, aber private Firmen betreiben die Frachthallen
- Bürger besitzen Wohnhäuser auf staatlichem Pachtland

---

## 3. Wer baut Gebäude?

### Entscheidung: Spieler + NPCs (Modell B)

**Spieler** baut aktiv: Minen, Solarfelder, Habitate, Spezialgebäude.

**NPCs bauen passiv** wenn Bedingungen erfüllt sind:
- Bürger errichten Wohnhäuser wenn Bevölkerungsdruck und Boden verfügbar
- NPC-Firmen errichten Läden wenn Kaufkraft und Kundschaft vorhanden
- Der Staat baut Infrastruktur wenn Steuereinnahmen ausreichen und politischer Wille besteht

**Warum ist das wichtig?**  
Weil Kolonien dadurch lebendig wirken. Der Spieler baut nicht die gesamte Stadt — er gestaltet die Rahmenbedingungen, und die Stadt wächst innerhalb dieser Bedingungen.

---

## 4. Was begrenzt Wachstum?

Wachstum ist nie eindimensional. Es gibt sechs Engpassebenen, die gleichzeitig wirken:

| Ebene | Engpass | Beispiel |
|-------|---------|---------|
| **Physisch** | Fläche, Energie, Wasser | Mine ohne Strom fördert nicht |
| **Sozial** | Arbeitskräfte, Fachkräfte | Raumhafen ohne qualifizierte Techniker läuft auf 40% |
| **Wirtschaftlich** | Kapital, Kredit, Liquidität | Zu viel Kredit bricht Expansion ab |
| **Wissen** | Technologie, Ausbildung | Fortgeschrittene Gebäude brauchen SSF-Zertifikate |
| **Politisch** | Stabilität, Legitimität, Vertrauen | Enteignungen kosten politisches Kapital |
| **Ökologisch** | Strahlung, Staub, Atmosphäre | Marskolonien haben andere Bedingungen als Mondkolonien |

**Konsequenz für das Design:**  
Jede dieser Ebenen ist ein möglicher Engpass. Das Spiel wird interessant wenn mehrere gleichzeitig wirken und der Spieler priorisieren muss.

---

## 5. Was ist Fortschritt?

### Entscheidung: Viergliedrig

```
Wissen          — SSF-Zertifikate, Forschung, Bildungsniveau
Bevölkerung     — Zahl, Qualität, Zufriedenheit, Gesundheit
Resonanz        — Zusammenhalt, Vertrauen, Kooperation
Lebensqualität  — Versorgung, Komfort, Sicherheit, Kultur
```

Kein eindimensionaler Score. Eine Kolonie kann hohe Bevölkerung aber niedrige Lebensqualität haben (Slums). Hohe Lebensqualität aber niedrige Bevölkerung (Luxusstation). Hohes Wissen aber niedrige Resonanz (Elitekolonie ohne Zusammenhalt).

**Spielmechanisch:**  
Der Spieler sieht Spannungen zwischen diesen vier Dimensionen und entscheidet, welche er priorisiert.

---

## 6. Gebäudeklassen

### Typ A — Einzelgebäude (1 Kachel, permanent)

Skalieren durch Qualität, nicht Fläche.

Beispiele: Bank, Schule, Krankenhaus, Forschungsstation, Sicherheitszentrum

### Typ B — Erweiterbare Gebäude (1 → N Kacheln)

Beginnen als Einzelgebäude, können durch angrenzende Module wachsen.

```
Mine (1 Kachel)
  + Förderband (1 Kachel)
  + Lager (1 Kachel)
  + Aufbereitungsanlage (2 Kacheln)
```

Jedes Modul hat eigenen Charakter und eigene Funktion.  
Der Komplex sieht als Ganzes anders aus als die Summe seiner Teile.

### Typ C — Komplexe (2×2 → 8×8 oder größer)

Wachsen als erkennbare Stadtteile.

**Beispiel Raumhafen:**
```
Tier 1:  [T]                     — Terminal + 1 Pad
Tier 2:  [P][T][P]               — 3 Kacheln
Tier 3:  [P][T][P]               — 6 Kacheln
         [F][C][F]
Tier 5:  Orbitalaufzug-Anbindung — eigenständiger Großkomplex
```

**Beispiel Universität:**
```
Start:   [UNI]
Mitte:   [UNI][LAB]
         [LIB][OBS]
Spät:    [UNI][LAB][LAB]
         [LIB][OBS][PARK]
         [DORM][DORM][CAF]
```

**Regel:**  
Große Einrichtungen sind modulare Komplexe.  
Nur einfache Einrichtungen bleiben Einzelgebäude.

---

## 7. Konfliktmodell

### Entscheidung: Governance & Security statt Militär

**Konflikte auf dem Mars sind real — aber sie haben andere Ursachen als auf der Erde:**

- Ressourcenknappheit
- Grundstücksstreitigkeiten
- Ungleichheit zwischen Kolonien
- Unabhängigkeitsbestrebungen
- Unternehmensinteressen (HeliosCorp)
- Technologiezugang

**Die größten physischen Gefahren einer Marskolonie:**
- Druckverlust
- Staubstürme
- Strahlung
- Meteoriteneinschläge
- Versorgungsausfälle

Keine davon wird durch Panzer gelöst.

### Governance-Gebäude (Standard)

```
Sicherheitszentrum      — Katastrophenschutz, Rettung, Strahlenwarnung
Notfallkommando         — Krisenreaktion, Versorgungsausfälle
Verwaltung              — Steuern, Gesetze, Bürgerzufriedenheit
Gerichtshof             — Eigentumsstreitigkeiten, Vertragsrecht
Diplomatiezentrum       — Beziehungen zu anderen Kolonien und zur Erde
Orbitalüberwachung      — Asteroidenwarnung, Frachtverkehr, Sicherheit
```

**Militär = optionale politische Entscheidung**

Nur verfügbar wenn eine Kolonie politisch in Richtung Autoritarismus entwickelt wird.  
Nie Standard. Nie kostenlos. Immer mit Konsequenzen für Lebensqualität und Resonanz.

---

## 8. Das Resonanzmodell

Konflikte existieren — aber die zentrale Spielfrage lautet:

> **Wie gut gelingt Zusammenarbeit?**

Probleme entstehen durch:
- Ungleichheit zwischen Kolonien
- Ressourcenknappheit
- schlechte politische Entscheidungen
- Vertrauensverlust
- Umweltzerstörung

Nicht primär durch Feinde.

**HeliosCorp** ist kein Bösewicht — sie ist ein Unternehmen mit eigenen Interessen, das manchmal mit dem Spieler kooperiert und manchmal konkurriert. Der Spieler kann ihr beitreten, sie bekämpfen oder ignorieren.

---

## 9. Bodenwert als emergentes System

Bodenwert entsteht aus drei Faktoren:

```
Lage      × Nutzung × Nachfrage = Bodenwert
```

**Lage:** Nähe zu Raumhafen, Zentrum, Ressourcen  
**Nutzung:** Wohngebiet, Industriegebiet, Gemischte Nutzung  
**Nachfrage:** Bevölkerungswachstum, wirtschaftliche Aktivität

**Konsequenz:**  
Ein Feld neben dem Raumhafen ist in einer Millionenkolonie extrem wertvoll.  
Dasselbe Feld in einer Pionierkolonie ist fast wertlos.

---

## 10. Offene Entscheidungen

Diese Fragen müssen beantwortet werden bevor `GDD-BUILDINGS.md` geschrieben wird.

---

### F1 — Kann Land verpachtet werden?
**Status: Accepted**

Landbesitz und Landnutzung werden getrennt. Ein Tile hat drei Eigentums-Felder:

```
owner_id      // wem gehört das Grundstück
occupant_id   // wer nutzt oder bebaut es aktuell
lease_id      // optionaler Pachtvertrag (nullable)
```

**Alpha 0.1/0.2:** Eigentum und Nutzung existieren im Datenmodell. Pachtmechanik inaktiv. Standardfall: `owner_id = occupant_id`.

**Alpha 0.3+:** Pachtverträge, Laufzeiten, Gebühren, Kündigungsrechte, NPC-Pacht, HeliosCorp-Landstrategie über langfristige Pacht.

---

### F2 — Gibt es Grundsteuer?
**Status: Offen**

| Option | Beschreibung | Konsequenz |
|--------|-------------|------------|
| Ja, immer | Alle Landbesitzer zahlen | Staatsfinanzierung, Anreiz gegen Spekulation |
| Ja, optional | Abhängig von Regierungsform | Politische Entscheidung, Emergenz |
| Nein | Kein Steuersystem | Einfacher, weniger Tiefe |

---

### F3 — Können Bürger Land besitzen ohne Spieleraktion?
**Status: Offen**

| Option | Beschreibung | Konsequenz |
|--------|-------------|------------|
| Ja, vollständig | NPCs kaufen/bauen autonom | Maximale Lebendigkeit, hohe Komplexität |
| Ja, begrenzt | NPCs nutzen unbebautes Land | Mittlere Komplexität |
| Nein | Nur Spieler + Staat | Einfach, wenig emergent |

---

### F4 — Wie präsent ist HeliosCorp von Anfang an?
**Status: Offen**

| Option | Beschreibung | Konsequenz |
|--------|-------------|------------|
| Stark präsent | Gebäude sichtbar, Einfluss spürbar | Frühe Konflikte, klare Antagonistin |
| Subtil präsent | Im Hintergrund, entdeckbar | Realistischer, mehr Entdeckungsmoment |
| Abwesend bis Tier 2 | Erst bei Wachstum sichtbar | Einstieg einfacher |

---

### F5 — Gibt es Zonierung?
**Status: Offen**

| Option | Beschreibung | Konsequenz |
|--------|-------------|------------|
| Explizit (SimCity) | Spieler weist Zonen zu | Stadtplanung als aktive Mechanik |
| Emergent (Anno) | Zonen entstehen aus Nutzung | Natürlicherer Stadtbau |
| Keine | Alles gemischt | Einfach, wenig Tiefe |

---

## 11. Ressourcen-Invariante

### Entscheidung: Lokale Endlichkeit — globale Frontier

> **Ressourcenvorkommen sind endlich. Die Frontier ist es nicht.**

Das sind zwei völlig verschiedene Aussagen:

```
Lokale Ebene:    Vorkommen erschöpfbar
System-Ebene:    Neue Vorkommen erschließbar
```

**Was das bedeutet:**  
Wenn ein Marsfeld leergebaut ist, gibt es keine Ressourcen mehr — aber es gibt weitere Vorkommen auf anderen Asteroiden, Monden, Planeten.  
Knappheit entsteht durch Exploration, Transport, Infrastruktur, Zugang und Wissen — nicht durch ein endliches Universum.

---

### Ebene A — Geologische Vorkommen (endlich)

Jedes Vorkommen besitzt:

| Eigenschaft | Bedeutung |
|-------------|-----------|
| Menge | Wie viel ist vorhanden |
| Reinheit | Aufbereitungsaufwand |
| Tiefe | Abbaukosten |
| Begleitstoffe | Nebenprodukte / Komplikationen |
| Erschöpfungszustand | 0–100% |

**Beispiele nach Planetenklasse:**

| Planet | Typische Vorkommen |
|--------|--------------------|
| Mond | Wassereis, Ilmenit, Helium-3, Titanerz |
| Mars | Hämatit, Magnetit, Phosphate, Schwefel, Olivin |
| Asteroiden | Platinmetalle, Nickel-Eisen, Seltene Erden, Lithium |
| Tiefer Raum | Thorium, Uran, exotische Materialien |

---

### Ebene B — Produktionsketten (erschließbar)

Wenn Vorkommen bekannt und erschlossen sind, entstehen Ketten:

**Dünger:**
```
Phosphat + Stickstoff + Kalium → Düngemittel
```

**Batterien:**
```
Lithium + Nickel + Graphit + Kupfer → Energiespeicher
```

**Solarpanels:**
```
Silizium + Silber + Aluminium → Photovoltaik
```

Spieler lernen dabei Chemie, Geologie und Materialwissenschaft — direkt aus dem Spielverlauf.  
Das ist der Brückenpunkt zwischen NOXIA und SSF.

---

### Entwicklungsbogen

| Phase | Ressourcen | Transportproblem |
|-------|-----------|-----------------|
| Frühes Spiel | Eisenerz, Wassereis, Energie | lokal lösbar |
| Mittleres Spiel | Phosphat, Lithium, Seltene Erden | Interkolonial |
| Spätes Spiel | Helium-3, Platinmetalle, Exotika | Interplanetarisch |

Je später die Phase, desto wichtiger wird Transport, Infrastruktur und Logistik.  
Das letzte große Phosphatvorkommen 800 Millionen Kilometer entfernt erzeugt keinen Krieg — es erzeugt ein Logistikproblem.  
Und genau dort wird NOXIA interessant.

---

### Auswirkungen auf bestehende Systeme

**Scanner-Gebäude:**  
Nicht nur Anomalie-Detektor — primär Prospektionsinstrument.  
Findet versteckte Vorkommen, bestimmt Tiefe und Reinheit, schätzt Abbaukosten.

**Grundbesitz:**  
Ein Feld mit bekanntem Lithiumvorkommen ist fundamental anders wert als ein leeres Feld.  
Bodenwert = Lage × Nutzung × Nachfrage **× Ressourcenpotenzial**.

**Kolonien sterben:**  
Wenn alle erschließbaren Vorkommen einer Kolonie erschöpft sind und keine neue Frontier erreichbar ist, schrumpft die Kolonie.  
Das ist realistisch — und spielmechanisch interessant, weil es Expansion erzwingt.


---

## Nächster Schritt

> `docs/gameplay/GDD-BUILDINGS.md`  
> Abgeleitet aus diesem Dokument.  
> Beschreibt Typ A, B und C konkret mit Modulen, Kosten, Voraussetzungen.


