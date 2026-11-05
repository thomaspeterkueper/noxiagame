# NOXIA-FORSCHUNG-0001 · Biologische Mehrfachrhythmik der NPC-Bedürfnisse

**Status:** Forschungsprototyp / keine automatische Balancing-Änderung  
**Stand:** 2026-11-05  
**Arbeitsbereich:** Bevölkerung, Kognition, Physiologie und Zeitmodelle

## Forschungsfrage

Ein einzelner momentaner Bedürfniswert erklärt weder die erwartete Entwicklung noch die Wahrscheinlichkeit, dass ein NPC auf einen Reiz reagiert. Wir untersuchen stattdessen gekoppelte, individuell phasenverschobene Zeitreihen mit unterschiedlichen Zeitskalen:

1. **Homöostase:** Defizit akkumuliert (z. B. Schlafdruck, Flüssigkeit), Handlungen reduzieren es.
2. **Zirkadian:** Tagesphasen modulieren Wachheit, Appetit, Aktivität und ihre jeweiligen Empfindlichkeiten.
3. **Ultradian:** Kürzere Pulse, insbesondere bei endokriner Regulation; kein universeller starrer Zyklus.
4. **Ereignis-/Kontextdynamik:** Bewegung, Krankheit, Interaktion, Stress, Schichtarbeit, Licht und Ernährung verändern Sollwerte und Phasen.
5. **Soziale Regulation:** Kontaktbedürfnis und Verbundenheit hängen von individuellen Beziehungen und jüngsten Erlebnissen ab; keine pauschale biologische Frequenz.

Die Begriffe „Biorhythmus“ und „Frequenz“ sind hier **nicht** die populären, wissenschaftlich unbelegten 23/28/33-Tage-Biorhythmuskurven. Die Forschung rechtfertigt **keine** festen Perioden für alle Bedürfnisse.

## Evidenzbasis

- Borbély-Zweiprozessmodell: homöostatischer Schlafdruck S plus zirkadiane Komponente C; NIH/NCBI: https://www.ncbi.nlm.nih.gov/books/NBK19956/
- Lightman & Conway-Campbell (2024), *Circadian and ultradian rhythms: Clinical implications*, J Intern Med, DOI 10.1111/joim.13795 — pulsatile HPA- und Glukokortikoidregulation, unterschiedliche Zeitskalen.
- McHill & Butler (2024), *Eating Around the Clock*, Annual Review of Nutrition, DOI 10.1146/annurev-nutr-062122-014528 — circadianes Timing von Essen und Metabolismus.
- *Sleep and circadian rhythmicity as entangled processes serving homeostasis* (2023), PMID 38040815 — Prozesse sind gekoppelt, einfache eindimensionale Modelle reichen nicht.
- NIMH RDoC Circadian Rhythms: https://www.nimh.nih.gov/research/research-funded-by-nimh/rdoc/constructs/circadian-rhythms

## Mathematischer Forschungsansatz

Pro NPC i, Bedürfnis k, Simulationszeit t:

```text
D_ik(t + Δt) = clamp(D_ik(t) + accumulation_ik(context,Δt) - relief_ik(action,Δt), 0, 1)
C_ik(t) = Σ_j a_ijk sin(2π(t - φ_ijk)/T_ijk)
U_ik(t) = clamp(D_ik(t) + C_ik(t) + contextImpact_ik(t) + interaction_ik(t), 0, 1)
```

D = Defizit; C = rhythmische Modulation; U = wahrgenommene Dringlichkeit. **Eine Sinusschwingung ist nur eine testbare Approximation**, nicht als biologische Wahrheit anzunehmen. Für Schlaf sollten die empirisch motivierten unterschiedlichen Aufbau-/Erholungsraten modelliert werden. Perioden und Phasen sind individuelle, kalibrierbare Parameter; alternative Pulsformen/gekoppelte Oszillatoren werden verglichen.

**Wichtig:** Der bestehende `person_needs.satisfaction`-Wert bleibt bis zu einer kontrollierten Migration die einzige persistierte Gameplay-Größe. Das Forschungsmodul führt einen *abgeleiteten* Dringlichkeitskanal ein, ohne derzeit echte NPC-Entscheidungen zu beeinflussen.

## Mess- und Validierungsplan

- Tage, Wochen und Monate simulieren; einen Lebenslauf ab Geburt mit altersspezifischen Parametern testen.
- Baseline A: nur statischer Bedürfniswert. B: Akkumulation/Erholung. C: B plus circadiane Phasen. D: C plus mehrskalige Pulse und Ereigniskopplung.
- Ablationstests (Rhythmik aus, Lichtreiz aus, Schichtarbeit an, soziale Isolation, Krankheit, Schlafentzug, Refeeding).
- Metriken: extreme Zustände, Autokorrelation und Spektrum je Bedürfnis, Tagesphasenkonsistenz, Handlungsplausibilität, Adaptivität nach Störungen, Erholungszeit, Zufallsseed-Stabilität.
- Simulationszeit getrennt von Wall-Clock-Zeit verwenden; identische Seeds deterministisch reproduzieren.
- Nie Pulsation, Hormonkonzentration oder Diagnosen als gemessene Biologie ausgeben, wenn lediglich synthetische Modellwerte vorliegen.

## Forschungsgrenze

Wir legen zunächst einen reinen berechenbaren Prototyp mit Tests an. Übernahme in Produktionslogik erst nach Replay-/Regressionstests und wissenschaftlicher Gegenprüfung. Insbesondere Nähe, Liebe und soziale Bindung werden nicht auf einen einzigen periodischen Hormonzähler reduziert.

## Datennutzung und Gesprächsanalytik

Für das Lernen ist eine dreistufige Spur erforderlich: **(1) vollständige Eingabe/Antwort, (2) extrahierte Signale und Hypothesen mit Provenienz und Unsicherheit, (3) tatsächlich persistierte Änderungen / Entscheidungen inklusive Fehlern und Seiteneffekten**. Der vorhandene `npc_conversation_log` speichert bereits `player_text`, `npc_reply`, `topic`, `outcome`, `world_action`, `wish_kind` und weitere Metadaten. Dies ist noch keine lückenlose kausale Entscheidungsprovenienz.

Originaldialoge von realen Spielern sind personenbezogen. Zugriff auf wörtliche Transkripte setzt eine geprüfte Rechtsgrundlage, transparente Vorabinformation der Testspieler und angemessene Aufbewahrung/Löschung voraus. Ein zusätzlicher individueller Opt-in-Klick ist im Konzept **nicht** vorgesehen: Ziel ist unverfälschtes Verhalten im ausdrücklich angekündigten Testbetrieb. Ob Art. 6 Abs. 1 lit. f DSGVO als Rechtsgrundlage tragfähig ist, erfordert eine dokumentierte Zweck-, Erforderlichkeits- und Interessenabwägung vor Aktivierung; ein bloßes Etikett „Testmodus“ genügt nicht. Für die wörtliche Adminauswertung ist deshalb ein explizit konfigurierter Stichtag `NOXIA_TEST_TRANSCRIPT_REVIEW_SINCE` erforderlich. Alte Gesprächsinhalte vor diesem Stichtag werden nicht rückwirkend geöffnet. Admin-Lesezugriffe werden protokolliert; Aufbewahrungsgrenze, Betroffenenrechte, Löschung und Schutz sensibler Inhalte sind verpflichtende weitere Anforderungen. Besonders für Minderjährige ist eine gesonderte Schutzprüfung erforderlich.

## Definition of Done für das spätere Forschungssystem

- Berechenbarer, testbarer Multi-Skalen-Kern und deterministische Replay-Tests.
- Datenvertrag für phasen-, ereignis- und altersabhängige Bedürfnisse.
- Messkurven aus Simulationsdurchläufen, belegte Parametrisierung.
- Vorher/Nachher-Vergleich mit bestehendem Verhalten.
- Erst danach Feature-Flag für kontrollierte Testpopulation.
