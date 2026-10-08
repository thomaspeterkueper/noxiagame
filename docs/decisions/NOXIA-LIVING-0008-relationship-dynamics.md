# NOXIA-LIVING-0008 – Beziehungen: Sättigung, wenige tiefe Bindungen, Verblassen

Status: accepted
Date: 2026-10-08
Code: `lib/game/population/relationshipDynamics.ts`, `lib/game/personSocialMemory.ts`, `lib/game/cognition/personAffect.ts`
Test: `npm run test:relationship-dynamics`

## Kontext

Der Forschungslauf (NOXIA-TIME-0001) hat gezeigt, dass die Kolonie nach gut zwei Monaten stillsteht. Jede neutrale Begegnung erhöhte Bekanntheit, Vertrauen und Zuneigung um einen festen Betrag. Alle Paare, die sich regelmäßig trafen, landeten auf dem Höchstwert, und nichts verblasste je.

## Entscheidung

### 1. Abnehmender Ertrag als exponentielle Annäherung

Ein positives Erlebnis schließt einen Anteil der Lücke bis zu einer Obergrenze. Die erste Begegnung bringt am meisten, die hundertste fast nichts mehr.

Negative Erlebnisse werden nicht gedämpft. Ein Konflikt trifft eine gefestigte Beziehung mit voller Wucht.

### 2. Obergrenze nach Stufe

| Stufe | Obergrenze Vertrauen und Zuneigung | Wer |
|---|---|---|
| Bekanntschaft | 0,55 | alle übrigen |
| Enge Bindung | 0,85 | die vier stärksten Bindungen einer Person |
| Paar | 1,0 | `relationship_type = 'partner'` |

Die Grenze für Bekanntschaften liegt bewusst unter den Freundschaftsschwellen aus `socialLife.ts` (0,56 und 0,58). Freund oder Paar kann nur werden, wer einen der wenigen engen Plätze hält.

Die engen Plätze gehen an die stärksten Bindungen einer Person. Die Stufe ist gerichtet: A kann B zu seinen Engsten zählen, ohne dass B das erwidert. Ein Paar belegt keinen der vier Plätze. Verliert eine Bindung ihren Platz, sinkt sie binnen Wochen auf die Bekanntschaftsgrenze.

### 3. Verträglichkeit

`pairCompatibility` ist ein fester, gegenseitiger Wert je Paar. Er bestimmt, wie schnell Zuneigung wächst, und entscheidet bei sonst gleichen Bindungen, wer einen engen Platz bekommt. Dadurch entstehen aus denselben Begegnungen verschiedene Beziehungen.

### 4. Verblassen ohne Kontakt

Vertrauen und Zuneigung kehren ohne Kontakt zum neutralen Wert 0,5 zurück, auch Groll. Halbwertszeiten in Spielzeit:

| Stufe | Halbwertszeit |
|---|---|
| Bekanntschaft | 30 Tage |
| Enge Bindung | 120 Tage |
| Paar | 360 Tage |
| Bekanntheit (alle Stufen) | 180 Tage |

Gespeichert wird nur bei Kontakt. Leser rechnen den aktuellen Stand mit `fadeRelationships` aus, so wie beim Affekt. Die Engine übergibt der Entscheidung bereits den verblassten Stand.

### 5. Routine bringt wenig Freude

Die Freude aus einer Begegnung richtet sich danach, was sie bedeutet: ein neues Gesicht oder eine enge Bindung viel, das tägliche Treffen mit einem gut bekannten Kollegen wenig.

## Wirkung im Forschungslauf

31 Personen in einer Siedlung, drei Spieljahre:

| Größe | vorher | jetzt |
|---|---|---|
| Vertrauen im Mittel | 1,0 | 0,62 |
| Enge Bindungen je Person | alle 14 bis 16 Bekannten | genau 4 |
| Bekanntschaften | 1,0 | rund 0,54 |
| Enge Bindungen | 1,0 | rund 0,83 |
| Freude im Mittel | 0,54 dauerhaft | 0,54 am ersten Tag, 0,18 ab dem ersten Monat |

Trennung im Szenario: Zieht jemand an einen anderen Arbeits- und Wohnort, verblassen die alten Bindungen auf beiden Seiten.

## Grenzen

- Die Kolonie erreicht weiterhin nach etwa zwei Monaten ein Gleichgewicht. Es liegt jetzt niedriger und ist ungleich verteilt, aber im Alltag entsteht noch keine Veränderung. Dafür fehlen Reibung und Bewegung im Netz.
- `socialLife.ts` stuft eine einmal erreichte Freundschaft nicht zurück, auch wenn die Werte gefallen sind.
- Bestehende Beziehungen in der Datenbank stehen großteils bei 1,0. Sie sinken mit der Zeit auf ihre Obergrenze.
