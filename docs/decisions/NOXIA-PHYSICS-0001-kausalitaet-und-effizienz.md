# NOXIA-PHYSICS-0001 – Permanente Kausalitäts-, Persistenz- und Effizienzprüfung

Status: Architektur- und Review-Grundsatz (11.10.2026). **Keine Behauptung, dass ein automatischer Wächter bereits deployed sei.**

## Ziel
Nicht jedes Objekt benötigt Echtzeitphysik. Jede spielrelevante Zustandsänderung benötigt aber eine nachvollziehbare Ursache und konsistente Folgen.

## Prüfmatrix für neue Features und Änderungen
1. **Kausalität**: Auslöser, Vorbedingungen, Wirkung und relevante Grenzen sind definiert; keine wirkungslosen Scheininteraktionen.
2. **Persistenz**: Dauerhafte Änderungen bleiben über Szenenwechsel, Ticks, Server-Neustarts und Spielerabwesenheit bestehen, soweit fachlich vorgesehen.
3. **Bilanztreue**: Ressourcen-, Eigentums-, Energie- und gegebenenfalls Massenbilanzen ohne Duplikation und unmotivierte Entstehung/Vernichtung.
4. **Räumliche Konsistenz**: Position, Kollision, Innen-/Außenwechsel, Erreichbarkeit und Zustandsprojektionen widersprechen sich nicht.
5. **NPC-/Weltfolgen**: Betroffene Agenten, Gebäude, Wirtschaft und Infrastruktur reagieren nachvollziehbar.
6. **Adaptive Detailtiefe**: Lokale zeitkritische Prozesse detailliert; entfernte/ruhende Prozesse ereignisbasiert oder aggregiert, ohne relevante Invarianten zu verlieren.
7. **Effizienz**: Kein permanentes Polling oder pro-Tick-Write ohne Zustandsänderung; Batch-/Idempotenzregeln und Messung von DB-Zugriffen, CPU und Datenvolumen.
8. **Beobachtungstreue**: Beobachtung, angenommene Mechanik, Validierung und bloße visuelle Darstellung auseinanderhalten.

## Umsetzung als Dauerprüfung (geplant)
Bei jedem relevanten Pull Request: passende vorhandene Tests und Invarianten ausführen; neue Zustandsänderungen durch Regressionstests abdecken. GitHub Actions / bestehende CI nur nach Prüfung der vorhandenen Workflows ändern. Keine zusätzlichen Datenbanklast erzeugenden Hintergrundjobs als Standard.
Wöchentliche/manuelle Review-Schleife für ungelöste Kausalitätslücken und Laufzeitkosten optional, jedoch nicht Ersatz für PR-Tests.

## Akzeptanzkriterien und Beispieltests
- **Selbstgebautes Café**: Gebäude existiert persistent, ist erreichbar und von der vorgesehenen Ansicht betretbar; Innenraum referenziert dasselbe Gebäude. Sichtbar ohne Zutritt ist ein Fehlerzustand, nicht die beabsichtigte Mechanik.
- **Materialentnahme**: Ressource am Ort nimmt ab, Inventar/Transport nimmt um bilanzierte Menge zu; Wiederholung derselben Operation kann nichts duplizieren.
- **Gebäudeschaden**: Schaden verändert Zustand, Nutzbarkeit und Reparaturbedarf; Ergebnis bleibt nach Szenenwechsel.
- **NPC-Bewegung**: Orte und Übergänge sind konsistent, Bewegungszeit und Weg passen zum Modell.
- **Entfernter Ort**: Vereinfachte Simulation liefert innerhalb definierter Toleranzen dieselben relevanten Bilanzen wie detailliertere Auflösung.

## Bestehende Anknüpfungspunkte
package.json enthält u. a. test:core-invariants, test:spatial, test:interiors, test:population, test:transport. Energieinvarianten beschrieben in docs/decisions/NOXIA-ENERGY-0001-energietraeger-und-einheiten.md.
Prinzip aus PCGH-Artikel (2026): https://www.pcgameshardware.de/Gears-of-War-E-Day-Spiel-74725/Specials/Physik-in-Spielen-1555992/

## Grenzen
Automatische CI-Tests prüfen nur explizit formulierte Invarianten. Sie können weder vollständige physikalische Richtigkeit noch alle emergenten Spielfolgen beweisen. Ein ständig rechnender Hintergrund-Simulator ist ausdrücklich nicht vorgesehen.

## Technologie-Plausibilitätsprüfung (Erweiterung 12.10.2026)
**Vor** Implementierung, Balancing oder Aufnahme in den technischen Kanon ist jeder neue physikalische Mechanismus zu klassifizieren:

1. **Physikalische Zulässigkeit:** Welche Erhaltungsgrößen, Teilchenstatistik, Symmetrien, Grenzfälle und No-Go-Sätze gelten? Voraussetzungen und Geltungsbereich der Aussage dokumentieren. Ein *spezifisch* widerlegter Mechanismus bedeutet nicht, dass eine ganze Technologieklasse unmöglich ist.
2. **Evidenzstatus:** A = reproduziertes Experiment; B = experimenteller Einzelbefund; C = theoretisch konsistentes Modell; D = plausible Extrapolation; E = ausdrücklich fiktionale Annahme; X = im angegebenen Modell widerlegter Mechanismus. Evidenzstatus enthält keine automatische Aussage über wirtschaftliche Reife.
3. **Technische Machbarkeit:** Wirkungsgrade, Stoff- und Energiebilanzen, Komponenten, Skalierung, Stabilität, Betrieb und realistische Entwicklungszeit separat prüfen.
4. **Kanon und Simulation:** Epoche, Infrastruktur, Materialströme und Auswirkungen auf die Ökonomie abgleichen. Modelle mit Status X für die konkreten widerlegten Voraussetzungen nicht als reale Technologie übernehmen; SF-Abweichungen sichtbar als fiktionale Prämissen markieren.
5. **Automatisierung:** Ein PR-Check kann Dokumentationspflichten und definierte Invarianten kontrollieren, jedoch keine physikalische Möglichkeit allgemeingültig beweisen. Bei neuen Technologieklassen fachliche Review-Freigabe verlangen; keine permanente rechenintensive Simulation starten.

### Beispiel: Neutrino-Laser (2026)
Die spezifische superradiante Verstärkung von Neutrinoemission aus radioaktiven Bose-Einstein-Kondensaten ist laut zwei theoretischen Arbeiten durch Rückstoß/Kohärenzverlust und Fermionenstatistik ausgeschlossen bzw. nicht erreichbar. Das ist **kein universeller Ausschluss** aller denkbaren Neutrinoquellen oder Neutrino-Kommunikation. Für NOXIA: Status X für genau diesen Mechanismus, andere Neutrinotechnologien getrennt bewerten.
Quellen: https://doi.org/10.1103/8x7k-rwx2 und https://doi.org/10.1103/rnx6-wqpf ; Einordnung https://www.scinexx.de/news/physik/quantengesetze-verhindern-den-geplanten-neutrino-laser/

### Review-Auslöser
Neue Primärstudien, widersprechende Experimente, neue Forschungsmechaniken oder bedeutende Änderungen am Kanon. Spätestens Oktober 2027 erneut prüfen.
