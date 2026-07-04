// Aktualisiert: 04.07.2026 — Kanonisches Falsch/Richtig-Beispiel für resource_class, deposits-Feldliste vorskizziert
// Version:      1.2.0

# NOXIA-ECON-0001 — Frontier Principle

Status: **Accepted** · Grundinvariante der NOXIA-Wirtschaft
Bezug: NOXIA GDD (Bausystem, Produktionsketten), Technisches Setup (Basiswerte-Prinzip)

---

## 1. Kernsatz

> Die langfristige Knappheit des Systems entsteht durch Lokalisierung,
> Kapazität, Zugang und Durchsatz — nicht durch die vollständige
> Erschöpfung der Frontier.

Das Universum bleibt offen. Einzelne Lagerstätten dürfen enden. Das System
darf nicht enden.

---

## 2. Drei-Ebenen-Modell

| Ebene | Verteilung | Knappheitstyp | Beispiele |
|---|---|---|---|
| **Ubiquitär** | fast überall verfügbar | Kapazität / Stau / Transport | Eisen, Aluminium, Silizium, Regolith, Standardwasser, Solarenergie |
| **Lokalisiert** | an bestimmte Regionen gebunden | Standort / Zugang / Förderkapazität / Erschöpfung | Wolfram, Lithium, Phosphate, Helium-3, Platinmetalle, Seltene Erden |
| **Einzigartig** | genau eine Instanz im gesamten Universum | Besitz / Zugangsrecht, keine Förderdynamik | Orbitalkorridore, L-Punkte, Haupttransportachsen, einmalige Forschungsobjekte |

Die Ebene ist eine Eigenschaft der **geografischen Verteilung**, nicht des
Materials. Dasselbe Element kann je nach Fundort unterschiedlich eingestuft
sein (Standardwasser = ubiquitär, Eis-Reinvorkommen an einem bestimmten Pol
= lokalisiert).

---

## 3. Testprädikate (pro Ebene unterschiedlich — wichtig!)

Die drei Ebenen unterscheiden sich nicht nur im Beispielkatalog, sondern in
der **Richtung**, in die sich ihre Förderrate über Zeit bewegen darf. Ein
einzelnes Testprädikat für alle drei wäre falsch.

### 3.1 Ubiquitär — Reversibilitäts-Test

```
Gegeben:  10 Förderanlagen auf Vorkommen A (ubiquitär)
Aktion:   9 Anlagen werden entfernt
Erwartet: Förderrate kehrt zum Basiswert zurück

BESTEHT:  Stau-Modell (Rate ist Funktion aktiver Claims)
FÄLLT:    Erschöpfungs-Modell (Rate bleibt dauerhaft niedrig)
```

Ubiquitäre Vorkommen dürfen **niemals** dauerhaft degradieren. Die Förderrate
ist ausschließlich eine Funktion der *aktuell* aktiven Förderer, nicht der
kumulierten Historie.

### 3.2 Lokalisiert — Monotonie-Test

```
Gegeben:  Lagerstätte B (lokalisiert), 100 Jahre Förderung
Aktion:   Förderung wird für 1 Jahr pausiert
Erwartet: Förderrate bleibt auf dem durch kumulierte Förderung
          reduzierten Niveau — sie erholt sich NICHT

BESTEHT:  Erschöpfungs-Modell (Rate ist Funktion kumulierter Förderung)
FÄLLT:    Stau-Modell (Rate würde sich nach Pause erholen)
```

Lokalisierte Vorkommen dürfen sich **nicht erholen**. Steigt die Rate wieder,
darf das ausschließlich durch Investition (Ausbau, Fördertechnik-Upgrade)
geschehen — nie durch Zeitablauf.

### 3.3 Einzigartig — Existenz-Invariante

```
Gegeben:  Weltgenerierung, beliebig viele Durchläufe
Erwartet: Von jedem als "einzigartig" markierten Knoten existiert
          zu jedem Zeitpunkt exakt eine Instanz

BESTEHT:  Weltgenerierung erzeugt Knoten einmalig, referenziert danach
FÄLLT:    Weltgenerierung erzeugt bei Bedarf neue Instanzen
```

Für Einzigartig-Knoten gibt es keine Förderrate und keine
Degradationsfunktion — nur ein Besitz- bzw. Zugangsrecht auf eine fixe
Entität. Die einzige Invariante ist Einmaligkeit.

---

## 4. Architektur-Bindung

Beide dynamischen Ebenen (Ubiquitär, Lokalisiert) folgen dem bestehenden
Grundprinzip aus Migration 003 (Basiswerte-Fix gegen Aufschaukel-Bugs):

```
Wert = f(Basiswert, Event-Log)
```

**niemals** inkrementelle Mutation eines laufenden Zustands
(`rate += bonus` pro Tick). Der Unterschied zwischen den Ebenen liegt
ausschließlich in der Form von `f`:

| Ebene | Form von f | Abhängig von |
|---|---|---|
| Ubiquitär | Erholungsfunktion | Anzahl aktuell offener Förder-Claims (Momentaufnahme) |
| Lokalisiert | Erschöpfungsfunktion | Kumulierte Förderung seit Anlagen-Bau (Historie) |

Die aktuell offenen Förder-Claims lassen sich aus derselben Struktur
ableiten, die für den Claim/Execute-Gap im Tick-Engine (Multiplayer-
Voraussetzung, siehe Backlog) ohnehin benötigt wird — kein separates System.

**Stabilitätstest (wie bei Population-Cron):** Tick zweimal hintereinander
triggern. Ubiquitär-Rate muss bei gleicher Claim-Zahl identisch sein.
Lokalisiert-Rate muss bei gleicher kumulierter Förderung identisch sein.
Weicht sie ab, wurde mutiert statt abgeleitet.

---

## 5. Alpha-Scope (entschieden, 04.07.2026)

**Alpha 0.1/0.2: endliche Kartenmenge, Architektur bereits exploration-fähig.**

```
Lokalisierte Vorkommen sind innerhalb der aktuellen Karte endlich.
Systemoffenheit entsteht NICHT durch Erholung (das wäre §3.1, falsch für
Lokalisiert), sondern später durch Exploration/Neuentdeckung außerhalb
der Startkarte. Bis Exploration existiert, ist diese Offenheit eine
architektonische Bereitschaft, kein aktives Feature.
```

Schema-Vorbereitung: `resource_class` (`UBIQUITOUS | LOCALIZED | UNIQUE`)
wird bereits jetzt persistiert, auch ohne aktives Exploration-Feature.

**Granularität — wichtig für die nächste Migration:** `resource_class` ist
eine Eigenschaft der **Instanz** (Ort × Vorkommen), nicht des Materialtyps.

```
Falsch:
  Water → UBIQUITOUS

Richtig:
  Deposit #471   Material: Water   Class: UBIQUITOUS
  Deposit #815   Material: Water   Class: LOCALIZED
```

Dadurch können mehrere Klassen desselben Materials gleichzeitig existieren,
ohne Sonderlogik:

| Material                        | Klasse       |
|----------------------------------|--------------|
| Wasser (Bodenfeuchte)            | UBIQUITOUS   |
| Wasser (Polareis)                | LOCALIZED    |
| Wasser (einziger Tiefenaquifer)  | UNIQUE       |

Auf heutigem Schema (eine Zeile pro Ort+Ressource in `location_resources`)
ist das noch abbildbar. Sobald mehrere geografisch getrennte Adern desselben
Materials am selben Ort nötig werden (mehrere Wolfram-Adern in einer
Kolonie), reicht das nicht mehr — dann wird eine eigene `deposits`-Tabelle
nötig. Feldskizze (noch nicht implementiert, nur vorgemerkt):

```
deposits
  deposit_id
  resource_type
  resource_class      -- UBIQUITOUS | LOCALIZED | UNIQUE
  tile_row, tile_col
  quality
  remaining_amount     -- nur relevant für LOCALIZED, aus Event-Log abgeleitet

  -- später, mit Exploration/Multiplayer:
  discovered_at
  owner_id
  claim_id
```

Das jetzt schon einplanen, sonst zweite Migration in Kürze.

**Produktionsketten dürfen in Alpha nicht hart von unbegrenzter
Lokalisiert-Verfügbarkeit ausgehen.** Zwei Optionen standen zur Wahl:

- Kleine Testmenge pro Vorkommen
- Import/Handel als Fallback (Wolfram vorerst kaufbar wie ein normales
  Handelsgut)

**Empfehlung: Import-Fallback für die erste Wolfram-Kette.** Testmenge
koppelt zwei unabhängig riskante Systeme in einem Deploy — die Ketten-Logik
(Erz → Konzentrat → Refined → Bauteile) und die Erschöpfungsfunktion aus
§3.2 müssten beide beim ersten Versuch schon korrekt sein. Ein Fehler in der
Erschöpfungsformel (z. B. eine Aufschaukel-Variante wie beim alten
Population-Cron) wäre dann nicht von einem Ketten-Bug zu unterscheiden.
Import entkoppelt: Kette zuerst gegen stabilen Bestand testen, Lokalisiert-
Erschöpfung als zweiten, isolierten Schritt nachziehen, sobald die Kette
steht.

---

## 6. Bezug zu bestehenden Systemen

- **`tile_level`** trennt Oberflächen- und Bergrechte bereits im Schema
  (Ebene 0 vs. −2 etc.) — löst den Land-vs-Rohstoff-Konflikt zwischen
  Ebene "Land" und Ebene "Lokalisiert", ohne neue Tabellen.
- **Produktionsketten (Wolfram → Konzentrat → Refined → Bauteile):**
  Wolfram ist Lokalisiert, nicht Ubiquitär — geografisches Gating ist damit
  keine separate Design-Entscheidung, sondern eine direkte Folge dieser
  Invariante.
- **HeliosCorp-Markteinfluss:** entsteht plausibel aus Kontrolle über
  Lokalisiert- und Einzigartig-Knoten (Standorte, Korridore), nicht aus
  Ubiquitär-Rohstoffen — konsistent mit "soll entdeckbar, nie explizit
  ausgestellt sein".
- **Reputation** bleibt getrennter Kanal (Zugangsgate), Spillover/Diversität
  von Handelsflüssen bleibt getrennter Kanal (Innovationsrate) — keine
  Vermischung mit dieser Invariante.

---

## 7. Zusammenfassung für schnelles Nachschlagen

```
Ubiquitär    → Stau, reversibel, Kapazität ist der Flaschenhals
Lokalisiert  → Erschöpfung, monoton, Standort ist der Flaschenhals
Einzigartig  → fix, Besitz/Zugang ist der Flaschenhals

Das System bleibt offen. Einzelne Knoten dürfen enden.
```
