# NOXIA-LIVING-0007 – Tagesrhythmus, Schlaf und Begegnungs-Abklingzeit

Status: accepted
Date: 2026-10-08
Code: `lib/game/population/circadian.ts`, `decision.ts`, `presence.ts`, `encounters.ts`, `engine.ts`, `lib/game/personBrain.ts`
Test: `npm run test:circadian`

## Kontext

Ein Tick ist eine Stunde. Bis jetzt gab es keinen Tag:

- Die Arbeitspflicht folgte einem Vier-Tick-Zyklus (`tick % 4`).
- Ruhe entstand nur aus dem Ruhebedürfnis, in einzelnen verstreuten Ticks. Niemand schlief eine Nacht durch, das Ruhebedürfnis lag dauerhaft bei 0,35 bis 0,55.
- Benannte Personen arbeiteten durchgehend, ihr Ruhebedürfnis stand bei 0,25.
- Eine Begegnung entsteht, wenn ein Paar am selben Ort neu zusammentrifft. Jede Mahlzeit und jede kurze Pause unterbrach das Zusammensein, und bei der Rückkehr entstand mit jedem Kollegen eine neue Begegnung samt Erinnerung und Freude.

## Entscheidung

### Tagesrhythmus

Jede Person hat ein stabiles Schlaffenster von acht Stunden. Die Einschlafzeit liegt je nach Chronotyp zwischen 21:00 und 01:00 Uhr und wird aus der Personen-ID abgeleitet. Optionale `traits`:

- `chronotype` 0 (früh) bis 1 (spät)
- `sleep_need_hours` 6 bis 9
- `work_shift: 'night'` verschiebt den ganzen Rhythmus um zwölf Stunden

Nach dem Aufwachen folgen eine Stunde Anlauf, acht Stunden Schicht (Arbeitspflicht 0,85) und danach Freizeit (0,2). Im Schlaffenster ist die Arbeitspflicht 0.

Alle Siedlungen teilen vorerst dieselbe Kolonie-Zeit (`tick mod 24`). `circadianState` nimmt bereits einen Stundenversatz je Ort an. Ein Mars-Sol von 24,66 Stunden ist nicht abgebildet.

### Schlaf in der Entscheidung

`PopulationDecisionContext.sleepDrive` zieht zur Ruhe und weg von Arbeit, Wegen, Inspektion, Meldung und Kontakt. Geweckt wird nur im Notfall: Hungerdruck ab 0,75 oder Sicherheitsdruck ab 0,5. Die Faktoren `sleepDrive`, `wakeEmergency` und `asleep` stehen im Decision Trace.

Schlaf ist kein neuer `activity_state`. Die Person ist `resting` mit `last_action = 'sleep'`, benannte Personen mit `sleep_and_consolidate`.

### Benannte Personen

`namedPersonSleeps` lässt benannte Personen in ihrem Schlaffenster schlafen. Ein Kolonie-Druck ab 0,7 am Ort oder starker Hunger hält sie wach.

### Schlafende begegnen niemandem

`resolvedPresenceCandidate` liefert für Schlafende keinen Kandidaten.

### Abklingzeit für Begegnungen

Ein Wiedersehen desselben Paars innerhalb von 12 Ticks ist eine Fortsetzung und keine neue Begegnung (`isFreshEncounter`). Die Engine prüft das vor jedem Schreiben. Es entsteht dann weder Ereignis noch Erinnerung noch Affekt.

## Wirkung

Simulierte Woche mit acht Personen an einem Arbeits- und einem Wohnort:

| Stand | Begegnungen pro Woche |
|---|---|
| vorher | 532 |
| mit Schlaf | 470 |
| mit Schlaf und Abklingzeit | 274 |

Jede Person schläft acht Stunden am Stück. Der Schlaf allein senkt die Begegnungen nur um etwa 12 %, den größeren Teil trägt die Abklingzeit.

## Offen

- Ortszeit je Siedlung und Mars-Sol.
- Schichtpläne aus dem Arbeitgeber statt aus dem Chronotyp.
- Schlafentzug als Zustand (Ruhebedürfnis wirkt bisher nur über die Handlungswahl).
