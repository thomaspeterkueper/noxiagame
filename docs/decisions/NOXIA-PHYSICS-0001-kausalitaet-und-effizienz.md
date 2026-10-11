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
