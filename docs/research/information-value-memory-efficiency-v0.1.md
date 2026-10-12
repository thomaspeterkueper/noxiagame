# Informationswert, Vorhersagegewinn und Ressourcenaufwand — Forschungsrahmen v0.1

**Stand:** 2026-10-12  
**Status:** PROPOSED / testable hypothesis; no new physical principle established

## Forschungsfrage

Wann verbessert gespeicherte Information die zukünftige Vorhersage und Handlung eines Agenten, und wann übersteigen ihre Kosten den zusätzlichen Nutzen?

## Unbedingt getrennte Größen

- **Menge** I_store: gespeicherte Bytes bzw. semantische Ereignisse.
- **Vorhersagewert** V_pred: Änderung einer vorregistrierten Out-of-sample-Verlustfunktion gegenüber einem identischen Agenten ohne die betreffende Information.
- **Handlungswert** V_act: Änderung eines extern definierten, überprüfbaren Aufgabenmaßes; keine nachträgliche Umdefinition des Ziels.
- **Ressourcen** C: persistente Bytes, CPU-Zeit, Token, Laufzeit, gegebenenfalls gemessene elektrische Energie. Serverkosten sind kein Ersatz für thermodynamische Arbeit.
- **Risiken**: falsche Erinnerungen, Datenschutz, langfristige Inkonsistenz, seltene Ereignisse und irreversibler Informationsverlust.

## Hypothesen

H0: Vollständiges, verdichtetes und selektives Gedächtnis unterscheiden sich bei gleichen Ressourcen-/Testbedingungen nicht systematisch in der prädiktiven Leistung.

H1: Selektive Speicherung verbessert das Verhältnis V_pred/C in mindestens einer vorab definierten Aufgabenklasse.

H2: Informationswert hängt von der Zeitskala ab; seltene, handlungsrelevante Ereignisse können trotz geringer Häufigkeit hohe Bedeutung besitzen.

H3: Optimierung allein auf kurzfristigen Vorhersagegewinn kann Biografie, Vertrauen und langfristige Konsistenz beschädigen.

## Experimentdesign

Drei Gedächtnisregime bei gleichen NPC-Ausgangszuständen, Ereignisfolgen, Modellen und Testaufgaben:

1. FULL: alle zulässigen Ereignisse bleiben gespeichert.
2. COMPRESSED: periodische semantische Verdichtung mit Quellen-/Zeitreferenzen.
3. SELECTIVE: Speicherung anhand eines vorab festgelegten prädiktiven und handlungsbezogenen Nutzens, plus geschützter Langzeitanker.

Aufgabenklassen: Alltagsroutine, verzögerte Konsequenz, seltenes kritisches Ereignis, Beziehungskontinuität, Ortswissen, adversariale Fehlinformation. Mindestens zwei getrennte Zeitskalen und mehrere deterministische Seeds. Die Bewertungsdaten dürfen nicht zugleich die Auswahlregel trainieren.

## Kennzahlen und Entscheidung

- Vorhersage: Brier Score oder Log-Loss für probabilistische Ereignisse; Accuracy nur ergänzend.
- Verhalten: vorregistrierte Zielerreichung, Regelverletzungen, Konsistenz.
- Kosten: Bytes, Tokens, CPU-ms, Latenz, soweit verfügbar Wh.
- Verhältnis: Pareto-Front statt einer willkürlichen gemeinsamen Punktzahl.
- Sicherheit: Zahl und Schwere verlorener kritischer Erinnerungen; Verletzung geschützter biografischer Anker ist ein Fail unabhängig vom Mittelwert.

Ein Gewinn gilt nur als belastbar, wenn er über Seeds, Aufgabenklassen und Zeitskalen repliziert und gegenüber einem einfachen regelbasierten Baseline-Verfahren ausgewiesen ist.

## Wissenschaftliche Abgrenzung

Die Arbeit zur Informationsthermodynamik von Agenten motiviert die Frage, belegt aber **nicht**, dass weniger NPC-Tokens oder Server-Bytes unmittelbar thermodynamische Arbeit minimieren. Das muss als eigenständige technische Messung behandelt werden.

AVI: Dies ist ein Test von Rekonstruktions-/Informationsvollständigkeit, kein Test neuer Physik. Vergessene Information kann als fehlender Standardträger oder als Rekonstruktionsunsicherheit wirken; niemals automatisch Z.

Knowledge Graph: Jeder Befund erhält Quelle, Datum, Experiment-ID, Modell-/Codeversion, Datensatz, Metrik, Unsicherheit, Gegenbeispiele und Revisionsdatum.

## Ausführungsreihenfolge

1. NOXIA-Gedächtnis-Persistenz und vorhandene Messpunkte lesend auditieren.
2. Minimalen reproduzierbaren Benchmark ohne produktive Datenänderung erstellen.
3. Drei Regime unter identischen Ereignisfolgen ausführen.
4. Pareto-Auswertung und Failure Cases dokumentieren.
5. Erst danach entscheiden, ob adaptive Gedächtnisregeln in die Laufzeit gehören.

**Gate:** Keine automatische Umstellung produktiver NPC-Gedächtnisse aufgrund dieses Vorschlags.
