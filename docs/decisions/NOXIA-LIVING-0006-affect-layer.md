# NOXIA-LIVING-0006 – Affektschicht: Emotion, Stimmung, Schmerz

Status: proposed
Date: 2026-10-07
Code: `lib/game/cognition/personAffect.ts`, `lib/game/population/affectRuntime.ts`, `lib/game/population/decision.ts`, `lib/game/population/engine.ts`
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

## Umsetzungsstand

**Schritt 1 – reine Funktionen:** `personAffect.ts`, Anbindung an `decision.ts`, Tests.

**Schritt 2 – Persistenz und Engine:**

- Migration `20261007130000_person_affect.sql` mit `person_affect` (eine Zeile je Person) und `person_place_aversions`.
- `population/affectRuntime.ts` als Persistenzadapter.
- `population/engine.ts` lädt den Affekt je Tick gebündelt, übergibt ihn abgeklungen an die Entscheidung und senkt das Sicherheitsempfinden an Orten mit Aversion. Neu persistierte Begegnungen werden bewertet und fortgeschrieben.
- `population/healthRuntime.ts` schreibt bei jedem Gesundheitsereignis Schmerz, emotionales Echo und Ortsaversion.

Affekt ist nie tragend. Fehlt die Tabelle oder schlägt ein Zugriff fehl, läuft der Tick ohne Affekt weiter (`affectAvailable: false` im Tick-Ergebnis). Die Reihenfolge von Deployment und Migration ist deshalb unkritisch.

Wiederholungen sind abgesichert: `person_affect.source_event_id` hält das zuletzt eingerechnete Ereignis fest, dasselbe Ereignis wird nicht zweimal gezählt.

## Abgrenzung zum Körpermodell

`cognition/personBody.ts` ist die Quelle des Schmerzsignals. Die Affektschicht macht daraus, was die Person empfindet.

| Schicht | Zuständig für |
|---|---|
| Körper (`personBody.ts`) | Gewebeschaden, Entzündung, Heilung, Nozizeption, systemische Belastung, Reflex-Reiz |
| Affekt (`personAffect.ts`) | Schmerztoleranz, emotionales Echo, Ortsaversion, gezeigter Schmerz, Wirkung auf Entscheidungen |

- `syncBodyAffect` setzt den empfundenen Schmerz aus der Nozizeption, in beide Richtungen. Wie lange es wehtut, entscheidet die Heilung des Körpers, nicht die Halbwertszeit der Affektschicht.
- Nur ein merklicher Anstieg des Schmerzes wird als neues emotionales Ereignis bewertet. Gleichbleibender oder abklingender Schmerz erzeugt keine frische Angst.
- Systemische Belastung (Sauerstoffmangel, Hitze, Dehydrierung) ist kein Schmerz. Sie hebt die Angst auf einen Mindestwert, statt sie bei jedem Abgleich zu addieren.
- `population/bodyHealthBridge.ts` übersetzt Gesundheitsereignisse in den Körper: Arbeitsunfall → mechanische Verletzung an einer aus der Ereignis-ID abgeleiteten Region, Erschöpfung → `fatigue`, Umwelteinwirkung → `coreTemperatureStress`.
- `painFromHealthEvent`, das eigene Abklingen von `pain` und der Reflex-Reiz aus `painEffects` bleiben als Rückfall für Personen ohne gespeicherten Körper.

Der Körper wird noch nicht persistiert. Bis dahin läuft in der Engine der Rückfall.

## Offene Schritte

1. **Benannte Personen:** `personBrain.ts` entscheidet nach Rollenschwellen (NOXIA-LIVING-0005). Ihr Affekt wird bereits fortgeschrieben, wirkt aber noch nicht auf ihre Entscheidungen. Offen ist, ob sie in die Utility-Entscheidung wandern oder einen eigenen Affekt-Modifikator bekommen.
2. **Weitere Ereignisse:** Bisher erzeugen nur Begegnungen und Gesundheitsereignisse Affekt. Konflikt, Hilfe, Krise und Verlust werden bewertet, sobald die Engine solche Ereignisse erzeugt.
3. **Erinnerung:** Die Valenz in `person_memories` aus der Bewertung ableiten statt aus den Standardwerten je Ereignistyp.
4. **Wahrnehmung:** Den gezeigten Affekt über `npcPerceptionFilter` für andere Personen beobachtbar machen (Ansteckung, Fehleinschätzung).
5. **Dialog:** `npc-conversation` erhält den gezeigten Affekt als Tonparameter.
6. **Kognition:** `affectSalience` speist `emotionalSalience` im Personen-Tick.
7. **Körper-Persistenz:** `PersonBodyState` speichern, je Tick heilen lassen und `healthRuntime.ts` von `applyHealthEventAffect` auf `applyHealthEventToBody` + `syncBodyAffect` umstellen.
8. **Schmerzwirkung:** `painEffects` (Arbeitsleistung, Reflex-Reiz) an Arbeitsertrag und Reflex-Gate anbinden.

## Verworfene Alternativen

- **Kontinuierlicher PAD-Raum (Lust, Erregung, Dominanz):** kompakter, aber im Decision Trace schwerer lesbar und schwerer zu balancieren als benannte Emotionen.
- **Mehr als vier Emotionen:** Der Unterschied ist für Spieler kaum sichtbar, das Balancing wird teurer. Erweiterung bleibt möglich.
- **Affekt durch ein Sprachmodell führen:** widerspricht Determinismus, Auditierbarkeit und dem Kostenprinzip.
