# NOXIA-RESOURCE-0001 — Ressourcenontologie

**Status:** Accepted  
**Erstellt:** 04.07.2026  
**Implements:** NOXIA-CITY-SIMULATION (F1–F5), NOXIA-ECON-0001 (geplant)  
**Verwendet von:** GDD-BUILDINGS (folgt), Produktionsketten (folgt)

---

## Ziel

Dieses Dokument definiert die kanonische Ressourcenontologie von NOXIA.

Nicht: Preise, UI, Gebäude.  
Sondern: **die Bedeutung der Objekte.**

Wenn dieses Dokument sauber steht, beantworten sich folgende Fragen automatisch:

- Was fördert eine Mine?
- Wem gehört ein Vorkommen?
- Was kann HeliosCorp kaufen?
- Was wird gehandelt?
- Was erschöpft sich?
- Was bleibt durch die Frontier offen?

---

## Schichtenmodell

```
Material
  ↓
Deposit
  ↓
Handelsgut
  ↓
Produkt
```

Diese vier Ebenen sind strikt getrennt. Wolfram ist nicht dasselbe wie ein Wolfram-Vorkommen, nicht dasselbe wie Wolfram-Erz als Handelsgut, nicht dasselbe wie Raffiniertes Wolfram als Produkt.

---

## Ebene 1 — Material

Ein Material ist eine physikalische Substanz mit definierten Eigenschaften.  
Es existiert unabhängig davon ob es gefunden, abgebaut oder gehandelt wird.

**Schema:**

```
material_id         // kanonische ID: "tungsten", "water", "iron"
name                // Anzeigename: "Wolfram"
category            // mineral | fluid | gas | energy | biological | exotic
physical_state      // solid | liquid | gas | plasma
density_kg_m3       // physikalische Eigenschaft
melting_point_k     // physikalische Eigenschaft (optional)
notes               // freitextlich, z.B. "höchster Schmelzpunkt aller Elemente"
```

**Beispiele:**

| ID | Name | Kategorie | Kategorie |
|----|------|-----------|-----------|
| `tungsten` | Wolfram | mineral | Höchster Schmelzpunkt aller Elemente |
| `water` | Wasser | fluid | Lebenserhaltend, 6× teurer auf Mars |
| `iron` | Eisen | mineral | Häufigste Marsressource |
| `silicon` | Silizium | mineral | Solarpanels, Elektronik |
| `lithium` | Lithium | mineral | Batterien, Energiespeicher |
| `helium3` | Helium-3 | gas | Fusionsbrenner, Mond-exklusiv |
| `phosphate` | Phosphat | mineral | Dünger, Lebenserhaltung |
| `platinum_group` | Platinmetalle | mineral | Katalysatoren, Elektronik |

---

## Ebene 2 — Deposit

Ein Deposit ist ein lokalisiertes, endliches Vorkommen eines Materials.  
Es hat eine Position, eine Menge, eine Qualität und eine Ressourcenklasse.

**Schema:**

```
deposit_id          // "olympus-tungsten-17"
material_id         // Referenz auf Material
resource_class      // UBIQUITOUS | LOCALIZED | UNIQUE (siehe unten)
location_id         // auf welchem Planeten/Mond/Asteroiden
tile_row            // Position im Grid (wenn erschlossen)
tile_col            // Position im Grid (wenn erschlossen)
amount_units        // Gesamtmenge (endlich)
amount_remaining    // aktueller Bestand
quality_pct         // 0–100%, beeinflusst Aufbereitungsaufwand
depth_m             // Tiefe, beeinflusst Abbaukosten
discovered          // bool — kann existieren ohne entdeckt zu sein
owner_id            // nullable — wer besitzt das Förderrecht (F3: PLAYER/STATE/NPC/CORPORATION)
notes               // z.B. "Begleitstoff: Rhenium"
```

**Wichtig:** `owner_id` bezieht sich auf das **Förderrecht**, nicht auf das Material selbst.  
Material ist Natur. Das Förderrecht ist Eigentum.

---

## Ebene 3 — Handelsgut

Ein Handelsgut ist das marktfähige Ergebnis der Extraktion.  
Es hat einen Preis, ein Lagervolumen und eine Qualitätsangabe.

**Schema:**

```
tradable_id         // "tungsten_ore", "refined_tungsten", "water"
material_id         // Basis-Material
processing_stage    // raw | refined | processed | manufactured
unit                // t (Tonnen) | kWh | Stück
price_current       // aktueller Marktpreis
price_base          // Basispreis ohne Markteinflüsse
quality             // optional, bei Rohstoffen aus Deposit.quality abgeleitet
```

**Beispiele:**

| ID | Name | Stage | Einheit |
|----|------|-------|---------|
| `tungsten_ore` | Wolfram-Erz | raw | t |
| `tungsten_concentrate` | Wolfram-Konzentrat | refined | t |
| `refined_tungsten` | Raffiniertes Wolfram | processed | t |
| `tungsten_parts` | Wolfram-Bauteile | manufactured | Stück |
| `water` | Wasser | raw | t |
| `purified_water` | Gereinigtes Wasser | refined | t |

---

## Ebene 4 — Produkt

Ein Produkt entsteht durch Transformation von Handelsgütern.  
Es hat ein Rezept, Inputs und Outputs.

**Schema:**

```
product_id          // "tungsten_parts"
name                // "Wolfram-Bauteile"
recipe_id           // Referenz auf Produktionsrezept
inputs              // [ { tradable_id, amount }, ... ]
outputs             // [ { tradable_id, amount }, ... ]
building_required   // welches Gebäude wird benötigt
energy_per_unit     // Energieverbrauch pro Produktionszyklus
time_ticks          // Produktionszeit in Ticks
```

**Beispiel — Wolfram-Produktionskette:**

```
Wolfram-Erz (raw)
  ↓  [Schmelze]
Wolfram-Konzentrat (refined)
  ↓  [Raffinerie]
Raffiniertes Wolfram (processed)
  ↓  [Fabrik]
Wolfram-Bauteile (manufactured)
```

**Beispiel — Dünger:**

```
Phosphat-Erz + Stickstoff + Kalium
  ↓  [Chemische Anlage]
Düngemittel
  ↓  [Gewächshaus]
Nahrung
```

---

## Ressourcenklassen

Jedes Deposit gehört einer von drei Klassen. Die Klasse bestimmt das wirtschaftliche Verhalten.

### UBIQUITOUS

Praktisch überall verfügbar. Lokal endlich, systemweit reproduzierbar.

**Testprädikat:** Reversibilität  
Wenn eine UBIQUITOUS-Ressource an Ort A erschöpft ist, kann sie an Ort B erschlossen werden ohne nennenswerten strategischen Verlust.

**Beispiele:** Sonnenenergie, Eis auf Eiswelten, Basaltgestein

**Wirtschaftliche Wirkung:** Kein dauerhafter Engpass. Transport und Infrastruktur sind die Limits.

---

### LOCALIZED

Auf bestimmte geologische Kontexte beschränkt. Endlich und nicht beliebig ersetzbar.

**Testprädikat:** Monotonie  
Wenn ein LOCALIZED-Deposit erschöpft ist, sinkt die Gesamtverfügbarkeit im System — bis ein neues Deposit entdeckt oder eine neue Frontier erschlossen wird.

**Beispiele:** Wolfram-Adern, Lithium-Solen, Phosphat-Lagerstätten, Helium-3 auf dem Mond

**Wirtschaftliche Wirkung:** Erzeugt echte Knappheit. Exploration wird wertvoll. Eigentum an Deposits ist strategisch.

---

### UNIQUE

Einmalig. Wenn erschöpft, ersatzlos verloren.

**Testprädikat:** Einzigartigkeit  
Kein anderes Deposit kann diese Ressource ersetzen — weder lokal noch durch Frontier-Expansion.

**Beispiele:** Exotische Materialien, bestimmte geologische Anomalien, vorplanetare Substanzen

**Wirtschaftliche Wirkung:** Extremer strategischer Wert. Kann Monopole erzeugen. Seltene Spielereignisse.

---

## Die Frontier-Invariante

> **Ressourcenvorkommen sind endlich. Die Frontier ist es nicht.**

Lokale Endlichkeit erzeugt Knappheit.  
Globale Frontier verhindert Nullsummenspiele im Endgame.

```
Frühes Spiel:    Eisenerz, Wassereis          → lokal lösbar
Mittleres Spiel: Phosphat, Lithium, Wolfram   → interkolonial
Spätes Spiel:    Helium-3, Platinmetalle       → interplanetarisch
```

---

## Eigentum an Ressourcen

Aus NOXIA-CITY-SIMULATION F3 folgt:

| Was | Wer kann Eigentümer sein |
|-----|--------------------------|
| Material | Niemand — Natur |
| Deposit | PLAYER, STATE, NPC, CORPORATION |
| Förderrecht | PLAYER, STATE, NPC, CORPORATION |
| Handelsgut | Jeder der es gekauft/produziert hat |
| Produkt | Jeder der es hergestellt hat |

**HeliosCorp-Konsequenz (F4):**  
HeliosCorp darf Deposits besitzen — aber Macht entsteht erst durch Kontrolle aller drei: Deposit + Aufbereitung + Transport. Ein Deposit allein ist ein Aktivposten. Die Kombination ist ein Monopol.

---

## Gebäude als Transformatoren

Gebäude sind Verbraucher und Transformatoren von Ressourcen.  
Sie sind **nicht** die Grundlage des Systems.

| Gebäude | Funktion im Ressourcenmodell |
|---------|------------------------------|
| Mine | Extrahiert Deposit → Handelsgut (raw) |
| Schmelze | Transformiert raw → refined |
| Raffinerie | Transformiert refined → processed |
| Fabrik | Transformiert processed → manufactured |
| Raumhafen | Transportiert Handelsgüter zwischen Knoten |
| Scanner | Entdeckt Deposits (Exploration) |
| Lager | Puffert Handelsgüter |

---

## Beziehung zu ECON-0001 (geplant)

RESOURCE-0001 definiert **was** Ressourcen sind.  
ECON-0001 definiert **wie** sie bewertet, gehandelt und bilanziert werden.

```
RESOURCE-0001  →  ECON-0001
(Ontologie)        (Ökonomie)
```

RESOURCE-0001 ist eine Voraussetzung für ECON-0001.

---

## Nächste Dokumente

```
NOXIA-RESOURCE-0001 (dieses Dokument)
  ↓
NOXIA-ECON-0001   — Wirtschaftsmodell, Märkte, Preisbildung
  ↓
GDD-BUILDINGS     — Gebäude als Transformatoren (Typ A/B/C, Komplexe)
  ↓
Produktionsketten — konkrete Rezepte (Wolfram, Dünger, Batterien)
  ↓
Datenmodell       — tile_entities erweitern: deposit_id, owner_class, land_value
```
