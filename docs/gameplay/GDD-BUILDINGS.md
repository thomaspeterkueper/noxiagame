# GDD-BUILDINGS — Gebäudesystem

**Status:** Accepted  
**Erstellt:** 04.07.2026  
**Grundlage:**
- NOXIA-CITY-SIMULATION (F1–F5: Eigentum, Landwert, Eigentümerklassen, Emergenz, Zonierung)
- NOXIA-RESOURCE-0001 (Material / Deposit / Handelsgut / Produkt)
- NOXIA-ECON-0001 (Frontier-Prinzip, Ressourcenklassen, Testprädikate)
- NOXIA-WOLF-0001 (Import-Fallback, Produktionsketten-Rollout)

---

## Grundprinzip

> Gebäude sind Verbraucher und Transformatoren von Ressourcen.  
> Sie sind nicht die Grundlage des Systems.

Ein Gebäude existiert weil es ein Deposit gibt.  
Ein Deposit existiert weil eine Ressource modelliert ist.  
Eine Ressource existiert innerhalb eines Wirtschaftsmodells.

Die Reihenfolge ist nicht umkehrbar.

---

## Drei Gebäudeklassen

### Typ A — Einzelgebäude

**Größe:** 1 Kachel, permanent  
**Skalierung:** durch Qualität und Stufe — nicht durch Fläche  
**Eigentümer:** PLAYER, STATE, NPC, CORPORATION

Typ-A-Gebäude sind Dienstleistungseinrichtungen. Sie wachsen nicht in der Fläche.  
Eine Bank der Stufe 3 ist besser als eine Bank der Stufe 1 — aber sie belegt immer eine Kachel.

**Beispiele:**

| Gebäude | Funktion | Ressourcenbezug |
|---------|---------|-----------------|
| Bank | Kredit, Einlage, Kreditlimit | Kapital als Ressource |
| Schule / Akademie | Wissenstransfer, SSF-Module | Wissen als Ressource |
| Krankenhaus | Gesundheit, Lebensqualität | Bevölkerung stabilisieren |
| Sicherheitszentrum | Katastrophenschutz, Governance | Stabilität als Ressource |
| Gerichtshof | Eigentumsstreitigkeiten | Vertrauen als Ressource |
| Scanner | Exploration, Prospektion | Deposits entdecken |
| Forschungsstation | Technologieentwicklung | Wissen erzeugen |

---

### Typ B — Erweiterbare Gebäude

**Größe:** 1 Kachel → N zusammenhängende Kacheln  
**Wachstum:** durch angrenzende Module mit eigenem Charakter  
**Eigentümer:** primär PLAYER, später NPC / CORPORATION möglich

Typ-B-Gebäude beginnen als Einzelgebäude und wachsen durch Erweiterungsmodule.  
Jedes Modul hat eine eigene Funktion im Ressourcenmodell.  
Der Komplex sieht als Ganzes anders aus als die Summe seiner Teile.

**Beispiel — Wolfram-Produktionskette (aus WOLF-0001):**

```
Mine (1 Kachel)
  → extrahiert Deposit → Wolfram-Erz (Handelsgut, raw)
  
Förderband (1 Kachel, Erweiterung)
  → erhöht Durchsatz, verbindet Mine mit Lager

Schmelze (1–2 Kacheln, Erweiterung)
  → transformiert Wolfram-Erz → Wolfram-Konzentrat (refined)

Raffinerie (2 Kacheln, Erweiterung)
  → transformiert Konzentrat → Raffiniertes Wolfram (processed)

Lager (1 Kachel, Erweiterung)
  → puffert alle Stufen
```

**Vollständiger Komplex:**

```
[Mine][Förderband][Schmelze][Raffinerie]
                            [Lager]
```

**Weitere Typ-B-Beispiele:**

| Kern | Erweiterungen | Ressourcenbezug |
|------|--------------|-----------------|
| Mine | Förderband, Lager, Schmelze, Raffinerie | LOCALIZED Deposit → Produktionskette |
| Solarfeld | Batteriespeicher, Verteilerstation | UBIQUITOUS Energie → Kapazität |
| Habitat | Gewächshaus, Medstation, Erholungszone | Bevölkerung → Lebensqualität |
| Wasserrecycler | Aufbereitungsstufe, Reservetank | Wasser → Effizienz |

---

### Typ C — Komplexe

**Größe:** 2×2 Kacheln → 8×8 oder größer  
**Wachstum:** als erkennbare Stadtteile durch Tier-Erweiterung  
**Eigentümer:** PLAYER, STATE, CORPORATION — nie einzelne NPC

Typ-C-Gebäude sind modulare Komplexe. Sie wachsen nicht durch eine Erweiterung, sondern durch eine neue Konfiguration. Jeder Tier-Schritt ist eine erkennbare Transformation des Stadtbilds.

**Beispiel — Raumhafen:**

```
Tier 1:  [T]                      — Terminal + 1 Pad (1×3)
Tier 2:  [P][T][P]                — 2 Pads (1×3)
Tier 3:  [P][T][P]                — Fracht + Kontrollzentrum (2×3)
         [F][C][F]
Tier 4:  [P][P][T][P][P]          — Vollbetrieb (2×5)
         [F][F][C][F][F]
Tier 5:  + Orbitalaufzug-Anbindung — eigenständiger Großkomplex
```

**Beispiel — Universität:**

```
Tier 1:  [UNI]
Tier 2:  [UNI][LAB]
         [LIB][OBS]
Tier 3:  [UNI][LAB][LAB]
         [LIB][OBS][PARK]
         [DORM][DORM][CAF]
```

**Beispiel — Werft:**

```
Tier 1:  [WERFT]
Tier 2:  [WERFT][DOCK]
Tier 3:  [WERFT][DOCK][DOCK]
         [KRAN ][HALLE][HALLE]
Tier 4:  Orbitaldock (eigener Großkomplex)
```

**Weitere Typ-C-Beispiele:**

| Komplex | Tier 1 | Spät |
|---------|--------|------|
| Raumhafen | Terminal + 1 Pad | Orbitalaufzug |
| Universität | Lehrgebäude | Campus mit Forschungsreaktor |
| Werft | Bauhalle | Orbitaldock |
| Militärbasis* | Sicherheitszentrum | Orbitalverteidigung |
| Handelszone | Marktplatz | Interplanetare Börse |

*nur bei entsprechender Regierungsform verfügbar (CITY-SIMULATION §7)

---

## Gebäude und Eigentümerklassen

Aus CITY-SIMULATION F3:

| Klasse | Darf bauen | Darf besitzen |
|--------|-----------|--------------|
| PLAYER | Typ A, B, C | Typ A, B, C |
| STATE | Typ A, C (Infrastruktur) | Raumhäfen, Straßen, Governance |
| NPC | Typ A (Wohnen, Läden) | Typ A auf freiem Land |
| CORPORATION | Typ B, C (strategisch) | Typ B, C + Deposits |

**HeliosCorp-Konsequenz (CITY-SIMULATION F4):**  
CORPORATION-Gebäude existieren von Spielbeginn an — subtil, nicht explizit.  
Eine Werft die HeliosCorp gehört sieht identisch aus wie eine Spielerwerft.  
Der Unterschied ist im `owner_id`-Feld — entdeckbar durch Beobachtung.

---

## Gebäude und Ressourcenmodell

Aus RESOURCE-0001:

| Gebäude | RESOURCE-0001-Rolle |
|---------|---------------------|
| Mine | Extraktion: Deposit → Handelsgut (raw) |
| Schmelze | Transformation: raw → refined |
| Raffinerie | Transformation: refined → processed |
| Fabrik | Transformation: processed → manufactured |
| Lager | Puffer: alle Handelsgut-Stufen |
| Scanner | Exploration: Deposits entdecken |
| Raumhafen | Transport: Handelsgüter zwischen Knoten |
| Reaktor | Produktion: Energie (UBIQUITOUS) |
| Gewächshaus | Produktion: Nahrung aus Inputs |

---

## Farbcode nach Kategorie

Aus NOXIA Architecture Style Guide:

| Farbe | Kategorie | Gebäudetypen |
|-------|-----------|-------------|
| Gold | Wirtschaft | Bank, Markt, Handelszone |
| Blau | Wissenschaft | Akademie, Labor, Observatorium |
| Orange | Industrie | Mine, Fabrik, Werft |
| Gelb | Energie | Solarfeld, Reaktor, Speicher |
| Grün | Bevölkerung | Habitat, Krankenhaus, Park |
| Türkis | Raumfahrt | Raumhafen, Orbitaldock |
| Rot | Sicherheit / Governance | Sicherheitszentrum, Orbitalüberwachung |

---

## Entwicklungsstufen (Tiers)

| Tier | Bezeichnung | Charakteristik |
|------|-------------|----------------|
| 1 | Pionier | Container, Solarplatten, kleine Schleusen |
| 2 | Kolonie | Dauerhafte Gebäude, erste Infrastruktur |
| 3 | Planetare Gesellschaft | Komplexe, Transportnetz |
| 4 | Interplanetare Gesellschaft | Megastrukturen, Orbitalsysteme |
| 5 | Postplanetare Gesellschaft | Ringhabitate, Raumaufzüge |

Tier bestimmt Aussehen, Kapazität und Voraussetzungen — nicht Funktionstyp.  
Eine Tier-1-Mine und eine Tier-4-Mine fördern beide Wolfram — aber unterschiedlich effizient, mit unterschiedlichen Nebeneffekten und unterschiedlichem Stadtbild.

---

## Silhouettenregel

Jedes Gebäude hat ein dominantes Merkmal das ohne Tooltip erkennbar ist.

| Gebäude | Silhouette |
|---------|-----------|
| Mine | Bohrturm |
| Bank | Tempelfront / Cr-Symbol |
| Akademie | Kuppel |
| Observatorium | Teleskop |
| Werft | Kran |
| Raumhafen | Landepad |
| Reaktor | Kühlturm |
| Scanner | Radarschüssel |
| Habitat | Wohnkuppel |

> Ein Gebäude darf niemals nur ein Kasten sein.

---

## Animationsregel

Gebäude bewegen sich wenig. Die Umgebung bewegt sich.

| Gebäude | Animation |
|---------|-----------|
| Mine | Förderband, rotierende Bohrkrone |
| Solarfeld | Pulsierendes Panel (Energiefluss) |
| Werft | Kran, aufsteigende Schweißfunken |
| Akademie | Pulsierendes Hologramm |
| Bank | Atemdes Cr-Symbol, leuchtende Fenster |
| Raumhafen | Landelichter, Abgasfahnen |
| Scanner | Rotierende Radarschüssel |
| Reaktor | Glühende Kerne, Dampfwolken |

---

## Alpha-Scope

**Alpha 0.1/0.2 (jetzt):**
- Typ A: Bank, Akademie, Scanner, Sicherheitszentrum
- Typ B: Mine, Solarfeld, Habitat, Eisbohrung, Wasserrecycler (Erweiterungen noch nicht aktiv)
- Typ C: Werft (Tier 1), Raumhafen (Tier 1)

**Alpha 0.3:**
- Typ B: erste Erweiterungen aktiv (Mine + Förderband + Schmelze)
- Erste Produktionskette: Wolfram (aus WOLF-0001)
- Typ C: Raumhafen Tier 2

**Alpha 0.4+:**
- NPC-Gebäude (STATE und NPC-Klasse bauen autonom auf freiem Land)
- CORPORATION-Strategie (HeliosCorp kauft strategische Deposits)
- Typ C: Universität, Handelszone

---

## Nächster Schritt

> Styleguide: Gebäude-Assets und SVG-Sprites  
> Erst wenn GDD-BUILDINGS steht, werden Assets gezeichnet —  
> weil die Silhouette aus der Funktion folgt, nicht umgekehrt.
