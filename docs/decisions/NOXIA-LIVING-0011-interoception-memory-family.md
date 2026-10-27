# NOXIA-LIVING-0011 — Interozeption, Gedächtnis und Familienentstehung

Status: implemented baseline
Date: 2026-10-27

## Ziel

Familien, Partnerschaften und körperlich-affektive Zustände dürfen nicht als
voneinander getrennte Minispiele entstehen.

Die aktuelle Kette lautet:

`Begegnung → Erinnerung → Beziehung → Affekt → interozeptive Regulation → Entscheidung → Partnerschaft/Familienintention`

Keine Stufe darf fehlende Weltwahrheit erfinden.

## Familienentstehung

Die bereits vorhandene Familienlogik bleibt autoritativ:

- Partnerschaften entstehen ausschließlich aus gegenseitig gewachsenen Beziehungen.
- Wiederholte Begegnung muss durch persistierte Erinnerungen/Encounter-Evidenz belegt sein.
- Ein individueller `family_desire` ist Voraussetzung für Familienintention.
- Partnerschaft, Kinderwunsch und Geburt sind verschiedene zeitliche Stufen.
- Versorgung und Siedlungskapazität bleiben reale Randbedingungen.

Am 27.10.2026 wurde ein Projektionsfehler repariert: Der zentrale Encounter-Pfad
aktualisierte Familiarität, Vertrauen und Affinität, verlor aber
`encounter_count_total` und `recent_encounter_score`. Dadurch konnten trotz
dutzender persistierter Begegnungen keine Partnerschaften qualifizieren.

Der Backfill rekonstruiert ausschließlich aus bestehenden `person_memories`.
Er erzeugt keine synthetischen Begegnungen und setzt keine Partnerschaft manuell.

## Interozeptive / neuroendokrine Regulation

`person_regulation_state` enthält vier dimensionslose Kontrollsignale:

- `stress_axis`
- `social_bonding_tone`
- `reward_drive`
- `arousal`

Diese Werte sind **keine Blutkonzentrationen** und keine Behauptung, dass ein
einzelnes Hormon direkt eine Emotion oder Handlung erzeugt.

Sie bilden eine grobe Auflösungsebene oberhalb konkreter Systeme wie HPA/Cortisol,
Oxytocin/Vasopressin und dopaminerger Belohnungsverarbeitung.

Die Ableitung verwendet ausschließlich vorhandene Zustände:

- Bedürfnisse, insbesondere Ruhe, Sicherheit, soziale Einbindung, Zweck und Abwechslung;
- persistierten Affekt;
- stärkste belegte Beziehung mit Vertrauen, Affinität, Familiarität und Encounter-Recency.

Damit folgt die Schicht Adaptive Detail Resolution: Eine feinere endokrine Simulation
kann später darunterliegen, ohne das heutige Verhalten neu definieren zu müssen.

## Wirkung auf Familie

Regulation darf `family_desire` nur leicht modulieren:

- soziale Sicherheit und Bindung können vorhandene Bereitschaft geringfügig unterstützen;
- hoher Stress kann sie verzögern;
- Regulation kann keinen Familienwunsch aus Null erzeugen;
- Regulation kann keine Partnerschaft erzeugen;
- ein Hormon-/Regulationswert ist niemals Beweis für Liebe, Zustimmung oder Elternwunsch.

## Gedächtnis und Bewusstsein

Persönliche Kontinuität entsteht aus persistierter Erfahrung, nicht aus einem
allwissenden Charakterprofil. Die Familienlogik nutzt deshalb Begegnungsevidenz aus
demselben Memory-System, das auch Beziehungen und Gespräche trägt.

Für Kinder existieren bereits experimentelle Entwicklungsmodelle für:

- sensorische Kodierung,
- Gedächtnisretention,
- soziales Lernen,
- Schlafzyklen,
- frühe Regulation,
- spätere symbolische und kreative Entwicklung.

Eine tatsächliche Geburt soll diese vorhandenen Entwicklungsmodelle später schrittweise
in die persistente Living Population überführen; sie werden nicht bereits bei der Geburt
als vollständige Erwachsenen-Kognition materialisiert.

## Invarianten

1. Kein LLM setzt Partnerschaften, Familienwunsch, Hormone oder Körperzustand.
2. Begegnungsevidenz ist replay-sicher und stammt aus autoritativen Ereignissen/Erinnerungen.
3. Hormonsignale sind kontextabhängige Regulationsproxies, keine Ein-Hormon-Erklärungen.
4. Familienbildung bleibt langsam genug, dass Beziehungsgeschichte beobachtbar ist.
5. Kinder beginnen mit altersgerechter epistemischer und kognitiver Tiefe.
6. Simulations- und epistemische Tiefe bleiben getrennt.
