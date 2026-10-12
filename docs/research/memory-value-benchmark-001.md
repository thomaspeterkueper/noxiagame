# MEMORY-VALUE-001 — isolierter synthetischer Benchmark

**Status:** IMPLEMENTED / execution NOT VERIFIED (2026-10-12).

## Lesender Audit (begrenzt)
Im Repository überprüft: `lib/research/avi/acce003.ts`, `acce004.ts` und `package.json`. ACCE-003 verwendet bestehende Reflexprofile und Adaption aus `lib/game/cognition/personReflex`. ACCE-004 importiert `personAffect` und `personReflex` und modelliert einen `MemoryCarrier` aus Salienz und Unsicherheit. Dies bestätigt vorhandene Affekt-/Reflex-Schnittstellen, **nicht** das tatsächliche Persistenzschema, alle Gedächtnispfade oder Produktionsmesspunkte. Ein vollständiger Persistenz-Audit steht aus.

## Implementierung
`lib/research/memory/valueBenchmark.ts` enthält einen deterministischen, vollständig synthetischen Vergleich der Strategien FULL, COMPRESSED, SELECTIVE. Keine Datenbankzugriffe, keine Netzwerkanfragen, keine Änderungen an NPCs. `valueBenchmark.test.ts` enthält Vitest-Assertions.

Vier Prüfungen: letzte Routeninformation, Wetter, geschützter Beziehungsanker und kritisches Ereignis. Die Kompression speichert den letzten Eintrag je Thema und bewahrt die Ereignis-ID. Die naive Selektion speichert geschützte Anker und hohe Werte, verwirft aber unter Umständen wichtige niedrig bewertete Informationen.

Messwerte: JSON-UTF8-Bytes als reproduzierbarer Proxy, Mean Absolute Error, Recall kritischer Ereignisse und Anker. Keine Behauptung über Tokens, CPU, elektrische Energie oder Produktionskosten.

## Ausführung
`npx vitest run lib/research/memory/valueBenchmark.test.ts`

## Einschränkungen
Kleiner künstlicher Datensatz; nur eine Zeitskala, keine Seeds/Unsicherheitsintervalle, keine echte NPC-Simulation, keine kausale Verallgemeinerung. Nächste Schritte: Persistenzpfade vollständig auditieren, mehrere Seeds und Zeitskalen, echte unabhängige Vorhersageziele, reale Messpunkte. Keine Produktionsintegration ohne Gate.
