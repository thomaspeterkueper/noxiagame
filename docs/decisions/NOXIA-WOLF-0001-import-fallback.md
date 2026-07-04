// Aktualisiert: 04.07.2026 — Erstfassung: Import-Fallback-Strategie, 5-Phasen-Rollout
// Version:      1.0.0

# NOXIA-WOLF-0001 — Produktionsketten-Rollout (Wolfram als Pilotfall)

Status: **Accepted**
Voraussetzung: NOXIA-ECON-0001 (Frontier Principle) v1.2.0

---

## 1. Kernentscheidung

> Eine neue Produktionskette und eine neue Ressourcenmechanik werden nie
> im selben Schritt eingeführt. Jeder Schritt einzeln testbar, versionierbar,
> bei Problemen eindeutig eingrenzbar.

Grund: Ketten-Logik und Erschöpfungsfunktion (ECON-0001 §3.2) sind
unabhängig riskant. Ein Fehler in der Erschöpfungsformel (z. B. eine
Aufschaukel-Variante wie beim alten Population-Cron) darf nicht mit einem
Ketten-Bug verwechselbar sein — dafür müssen sie in getrennten Deploys
getestet werden.

---

## 2. Fallback-Modell (Alpha 0.1–0.2)

```
Wolfram = importierbares Handelsgut
```

Kein Vorkommen, keine Geologie, kein `resource_class`-Bezug in dieser Phase.
Wolfram verhält sich wie jedes andere Handelsgut (kaufbar/verkaufbar über
`trade/route.ts`, Standardpreis-Mechanik).

Die Kette wird gegen diesen stabilen Input getestet:

```
Wolfram
  ↓
Wolframkonzentrat
  ↓
Raffiniertes Wolfram
  ↓
Hochtemperaturlegierung
  ↓
Komponente
```

Damit ist bereits in Alpha 0.1–0.2 überprüfbar, ob die Mehrstufen-Ketten-
Logik selbst korrekt läuft (Ressourcenmodell-Migration von festen Spalten
auf Key-Value-Storage, Bauteile als Baukosten-Material) — unabhängig von
allem, was mit `resource_class = LOCALIZED` zu tun hat.

---

## 3. Phase 2 (später, eigener Chat/Migration)

Erst wenn die Kette aus Schritt 2 stabil läuft, kommt `LOCALIZED` als
tatsächliches Deposit hinzu — und wird isoliert getestet:

- Exploration
- Vorkommen (`deposits`-Tabelle, siehe ECON-0001 §5)
- Erschöpfung (Monotonie-Test, ECON-0001 §3.2)
- Förderlogik (Claim/Execute, dieselbe Struktur wie Multiplayer-Tick-Gap)

---

## 4. Rollout-Reihenfolge (5 Schritte, jeder einzeln versioniert & deploybar)

```
1. Handelsgut funktioniert         (Wolfram kaufbar/verkaufbar)
2. Produktionskette funktioniert   (Erz → ... → Komponente, gegen Importbestand)
3. Exploration funktioniert        (neue Vorkommen außerhalb Startkarte)
4. Vorkommen funktionieren         (deposits-Tabelle, geografisches Gating)
5. Erschöpfung funktioniert        (Monotonie-Test bestehen)
```

Jeder Schritt ist ein eigener Deploy mit eigenem Header-Versionsbump.
Kein Schritt beginnt, bevor der vorherige stabil ist (Stabilitätstest:
Cron/Route zweimal hintereinander triggern, Ergebnis muss bei gleichem
Input identisch sein — wie beim Population-Cron-Fix).

---

## 5. Bezug

- ECON-0001 §3.2 (Monotonie-Test) gilt erst ab Schritt 5, nicht früher.
- ECON-0001 §5 (`deposits`-Feldskizze) wird in Schritt 4 real angelegt.
- Bis Schritt 4 bleibt `resource_class` für Wolfram irrelevant — es existiert
  in dieser Phase kein Deposit, gegen das die Klasse geprüft werden könnte.
