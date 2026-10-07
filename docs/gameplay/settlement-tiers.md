# Ortsstufen und Standardausstattung (Entwurf)

Status: Entwurf – Schwellenwerte sind Platzhalter, bitte vor dem Bau bestätigen.

## 1. Leitgedanke

Ein Ort ist mehr als eine Ansammlung von Gebäuden. Menschen bleiben, wenn sie nicht nur Arbeit finden, sondern eine lebenswerte Umgebung. Wo Menschen bleiben, kommen weitere dazu. Als Motiv dient der Roman „Eine Stadt wie Alice" (Nevil Shute): Eine Siedlung wächst, weil man dort gern lebt (aus der Erinnerung, nicht aus dem Text abgeleitet).

Konsequenz: Jeder Ort bekommt je nach Größe eine **Standardausstattung**. Fehlt sie, bremst das Wachstum; ist sie da, verstärkt sie es.

## 2. Ist-Stand

- `admin` (Verwaltung): in `lib/game/buildings/index.ts` baubar, aber nur auf `earth` erlaubt („Earth-Testgebäude"). `found-location` legt für Kolonie/Außenposten bereits eine Gründer-eigene `admin` an.
- `bar`: im Katalog definiert, aber `planned: true` (Hinweis „Zufriedenheit – Alpha 0.4"), also nicht baubar.
- Q1 hat handgebaut ein staatliches Modul `q1_everyday_life` (Lernraum, Kantine, Freizeit, Maker, Garten).
- `found-location` legt STATE-eigene Landeplatz und Docking-Bay an.
- Inkonsistenz: `docs/Spec-gebaeude-katalog.md` nennt die Verwaltung „staatlich, nicht kaufbar", im Code ist sie baubar.
- Prinzip aus dem Katalog: Ein Gebäude wird erst baubar, wenn es eine echte Funktion hat – keine leeren Hüllen.
- Noch zu prüfen: Wie die neue Affect-Schicht (Population-Tick) Zufriedenheit liefert und wo sich ein Standort-Zufriedenheitswert einhängen lässt.

## 3. Stufen

| Stufe | Beispiel | Standardausstattung (zusätzlich zur Vorstufe) | Schwelle (Platzhalter) |
|---|---|---|---|
| 0 Außenposten | Gründung | Landeplatz/Docking-Bay, Verwaltung | ab Gründung |
| 1 Siedlung | kleine Kolonie | Café/Bar | ≥ 20 Einwohner |
| 2 Ort | wachsende Kolonie | Markt, Akademie, Krankenstation | ≥ 100 Einwohner |
| 3 Stadt | große Kolonie | Lebensqualität: Park, Schwimmbad/Freizeit | ≥ 500 Einwohner |

Regeln:
- Die Stufe wird aus der **tatsächlichen Einwohnerzahl** abgeleitet, nicht manuell gesetzt.
- Standardgebäude ab Stufe 1 werden **automatisch** gebaut und gehören dem STATE, damit niemand ihretwegen blockiert wird.
- Hysterese (z. B. Abstieg erst bei 80 % der Schwelle), damit Orte nicht flackern.
- Bestehende Sonderfälle (Q1) zählen als Erfüllung der Stufe und werden nicht dupliziert.

## 4. Rolle der Bar/des Cafés

1. **Zufriedenheit und Wachstum**: Die Bar wirkt über die Affect-Schicht auf Einwohner (Stimmung, Bleibewahrscheinlichkeit, Zuzug).
2. **Sozialer Treffpunkt und Einstieg für neue Spieler**:
   - Neue Spieler erscheinen am Heimatort in der Bar (Spawn-Punkt).
   - Ein NPC-Wirt/Stammgäste führen das Gespräch („Was willst du hier werden?") über die bestehende Pipeline `npc-conversation`.
   - Gespräche geben diegetisch Orientierung: Handel von der Erde aus, Passagier, Co-Pilot, eigenes Schiff. Sie ersetzen eine Typ-Auswahl im Onboarding.
   - Gerüchte, Aufträge und Hinweise auf Akademie/Verwaltung.

Namensfrage: Café (Siedlung) und Bar (ab Ort) können dieselbe Gebäudedefinition mit anderem Namen sein – offen.

## 5. Spielerschicht

- Spieler können **zusätzliche** Einrichtungen bauen (Restaurants, Bars, Freizeit) und Einnahmen daraus beziehen.
- Wer den Ort durch solche Investitionen wachsen lässt, entwickelt sich zum „Stadtentwickler" (spätere Spielrolle, Zusammenhang mit Verwaltung/Gouverneur).
- Verwaltung: Heimatort-Registrierung (bereits gebaut), später Verwaltungsaufgaben für Stadtentwickler.

## 6. Abgrenzung

- **Q1**: handgebauter Spezialfall bleibt, soll aber die Stufenregeln erfüllen statt eigene Logik zu haben.
- **Erde-Orte-Umbau** (andere Session): Stufe leitet sich aus realer Bevölkerung ab; Platzierung der Gebäude gehört dorthin – vor dem Bau abstimmen.

## 7. Offene Fragen

1. Schwellenwerte je Stufe (Einwohner? Gebäudezahl? beides?).
2. Café vs. Bar vs. Q1-Kantine: ein Typ oder getrennt?
3. Hysterese ja/nein, wie groß.
4. Spawn in der Bar des Heimatorts: auch für Orte ohne Bar (Fallback)?
5. Hook für Zufriedenheit: Wie genau wirkt die Bar auf die Affect-Schicht?
6. Verwaltung: Bleibt sie baubar (Code) oder staatlich/nicht kaufbar (Katalog)? Bitte vereinheitlichen.
7. „Keine leeren Hüllen": Erste Version der Bar braucht mindestens NPC-Gespräch + Spawn.
