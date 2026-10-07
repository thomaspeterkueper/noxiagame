# NOXIA-LIVING-0006 – Affektschicht: Emotion, Stimmung, Schmerz

Status: proposed
Date: 2026-10-07
Code: `lib/game/cognition/personAffect.ts`, `lib/game/population/decision.ts`
Test: `npm run test:npc-affect`

## Kontext

NOXIA-Personen haben Bedürfnisse, Erinnerungen mit Valenz, gerichtete Beziehungen und einen Gesundheitszustand. Zwischen Ereignis und Entscheidung fehlt aber ein Zustand: Niemand *ist* gerade ängstlich, erleichtert oder verletzt.

- `memoryFromPopulationEvent` vergibt feste Valenzen je Ereignistyp. Ein Konflikt ist für jede Person −0,65, unabhängig davon, wer ihn auslöst und was auf dem Spiel steht.
- `scoreActions` kennt Bedürfnisse, aber keinen Affekt.
- Eine Verletzung senkt `wellbeing`, verändert aber weder Arbeitsfähigkeit noch Verhalten.
- `CognitiveStimulus.emotionalSalience` wird nur aus der Erinnerungsstärke gespeist.

## Entscheidung

Zwischen Ereignis und Entscheidung tritt eine deterministische Affektschicht. Sie besteht aus reinen Funktionen ohne Zufall, ohne LLM und ohne Schreibzugriff auf Weltwahrheit.

`Ereignis → Bewertung → Affektzustand → Entscheidung / Ausdruck`

### 1. Zustand

Pro Person ein kleiner Zustand (`AffectState`):

| Feld | Bereich | Zeitskala |
|---|---|---|
| `joy`, `fear`, `anger`, `sadness` | 0..1 | Halbwertszeit 6 Ticks (Stunden) |
| `mood` | −1..1 | Halbwertszeit 96 Ticks (Tage) |
| `pain` | 0..1 | Halbwertszeit 24 Ticks |

Gemischte Gefühle sind zulässig. Das Abklingen wird beim Lesen aus `updatedTick` berechnet (`decayAffect`). Eine Person ohne neues Ereignis verursacht also keinen Schreibzugriff.

### 2. Bewertung statt fester Valenz

`appraiseEvent` bewertet ein Ereignis relativ zur Person:

- Ein Ziel wird gefördert: Freude, gewichtet mit dem, was auf dem Spiel steht.
- Künftiger Schaden droht: Angst.
- Jemand schadet absichtlich: Wut. Sie fällt bei einer vertrauten Person stärker aus und wird von Enttäuschung begleitet.
- Ein Verlust ist endgültig: Trauer statt Wut.
- Ein Rückschlag ohne Verursacher: Niedergeschlagenheit und etwas Frustration.

`appraisalFromPopulationEvent` übersetzt die Ereignistypen, die `personSocialMemory` bereits kennt. Unbekannte Ereignisse erzeugen keinen Affekt, wie bei der Erinnerungsprojektion.

### 3. Persönlichkeit

Vier optionale Werte in `people.traits`, Standard jeweils 0,5:

- `affect_reactivity` – wie stark Ereignisse wirken
- `affect_recovery` – wie schnell Emotionen abklingen
- `affect_expressiveness` – wie viel davon gezeigt wird
- `pain_tolerance` – dämpft Schmerz

### 4. Schmerz

Schmerz ist ein Signal, keine bewertete Emotion. Er entsteht nur aus einem expliziten Gesundheitsereignis (`painFromHealthEvent`) und wirkt auf drei Wegen:

1. **Körperlich:** `painEffects` liefert verminderte Arbeitsleistung, erhöhten Ruhedruck und – solange der Schmerz akut ist – einen `pain`-Reiz für das Reflex-Gate (`personReflex.evaluateReflex`).
2. **Emotional:** `applyPain` schickt den Schmerz durch die normale Bewertung. Absichtlich zugefügter Schmerz erzeugt Wut, ein Unfall vor allem Angst.
3. **Gelernt:** `learnPlaceAversion` merkt sich den Ort. `placeSafetyPenalty` senkt dort später das Sicherheitsempfinden und verblasst über Wochen.

### 5. Empfunden und gezeigt

`expressedAffect` berechnet, was ein Beobachter wahrnehmen kann. Es hängt von der Ausdrucksstärke der Person und vom Vertrauen zum Gegenüber ab. Schmerz lässt sich nie ganz verbergen.

Andere Personen und der Dialog verwenden ausschließlich den gezeigten Affekt. Das setzt die bestehende Trennung von `ground_truth` und Beobachtung fort.

### 6. Wirkung auf Entscheidungen

`PopulationDecisionContext` erhält das optionale Feld `affect`. `affectActionModifiers` liefert begrenzte additive Verschiebungen (höchstens ±0,6) je Handlung:

- Angst zieht nach Hause und weg von Inspektionen.
- Trauer dämpft Arbeit und erhöht Ruhe und Kontakt.
- Wut senkt die Kontaktbereitschaft und erhöht die Meldebereitschaft.
- Schmerz senkt Arbeit und erhöht Ruhe und medizinische Versorgung.

Der Modifikator steht als `affectModifier` in den `factors` und damit im Decision Trace. Affekt verschiebt nur verfügbare Handlungen. Eine mit −1 gesperrte Handlung bleibt gesperrt.

## Invarianten

- Gleiches Ereignis und gleicher Zustand ergeben gleichen Affekt.
- Ohne kausales Ereignis entsteht weder Gefühl noch Schmerz.
- Ohne `affect` im Kontext bleibt jede bestehende Entscheidung unverändert.
- Ein LLM darf den gezeigten Affekt als Tonparameter lesen, aber keinen Affekt setzen.
- Affekt wird nur für `active` und `background` geführt. `aggregate` erhält höchstens einen Stimmungsmittelwert je Kohorte.

## Umfang dieses Schritts

Enthalten sind die reinen Funktionen, die Anbindung an `decision.ts` und die Tests. Am Laufzeitverhalten ändert sich nichts, solange kein `affect` übergeben wird.

## Offene Schritte

1. **Persistenz:** Tabelle `person_affect` (eine Zeile je Person, Spalten wie `AffectState`) und `person_place_aversions`. Die Migration ist bewusst nicht Teil dieses Schritts.
2. **Engine:** In `population/engine.ts` den Affekt beim Persistieren von `population_events` fortschreiben und in den Entscheidungskontext laden. `healthRuntime.ts` ruft `applyPain` auf.
3. **Benannte Personen:** `personBrain.ts` entscheidet nach Rollenschwellen (NOXIA-LIVING-0005). Offen ist, ob benannte Personen in die Utility-Entscheidung wandern oder einen eigenen Affekt-Modifikator bekommen.
4. **Erinnerung:** Die Valenz in `person_memories` aus der Bewertung ableiten statt aus den Standardwerten je Ereignistyp.
5. **Wahrnehmung:** Den gezeigten Affekt über `npcPerceptionFilter` für andere Personen beobachtbar machen (Ansteckung, Fehleinschätzung).
6. **Dialog:** `npc-conversation` erhält den gezeigten Affekt als Tonparameter.
7. **Kognition:** `affectSalience` speist `emotionalSalience` im Personen-Tick.

## Verworfene Alternativen

- **Kontinuierlicher PAD-Raum (Lust, Erregung, Dominanz):** kompakter, aber im Decision Trace schwerer lesbar und schwerer zu balancieren als benannte Emotionen.
- **Mehr als vier Emotionen:** Der Unterschied ist für Spieler kaum sichtbar, das Balancing wird teurer. Erweiterung bleibt möglich.
- **Affekt durch ein Sprachmodell führen:** widerspricht Determinismus, Auditierbarkeit und dem Kostenprinzip.
