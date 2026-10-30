# NOXIA-CCRS-0001 – Conflict, Consequence & Regeneration System

Status: proposed – Architekturvorhaben, Pilot Seelenberg
Datum: 2026-10-30
Bezug: NOXIA-FOOD-0002, NPC-Gruppeninteraktion, Cultural DNA, Gedächtnis, Wirtschaft, Core Tick

## Ziel
Glaubwürdige, persistente Konflikt-, Schaden-, Anpassungs- und Regenerationsprozesse ohne starre Quests oder moralische Vorentscheidung. NPCs behalten autonome, kontextabhängige Entscheidungen.

## Geltungsbereich
Individuum, Beziehungen, Gruppen, Institutionen, Infrastruktur und Ökosysteme. Keine Einteilung von NPCs in unveränderlich „gut“ und „böse“.

## Architekturprinzipien
1. Der Core besitzt den kanonischen Zustand; CCRS berechnet nachvollziehbare Vorschläge und Folgen. Keine zweite Weltzustandsdatenbank.
2. Ereignisse besitzen stabile ID, Tick, Ort, Akteure, Betroffene, Ursache, Sichtbarkeit, Auswirkungen und Herkunft. Ereignisverarbeitung idempotent.
3. NPC-Entscheidungen berücksichtigen Bedürfnisse, Persönlichkeit/Cultural DNA, Erinnerungen, soziale Bindungen, Kompetenzen, Normen, wahrgenommene Risiken und aktuelle Zustände. Hormone sind modulierende Parameter, keine moralischen Determinanten.
4. Schäden sind nicht automatisch reversibel. Regeneration braucht Zeit, Arbeitskraft, Ressourcen, ggf. Zustimmung und Institutionen.
5. Lokale Eskalation ist begrenzt (Cooldowns, Interventionschancen, begrenzte Ereignisbudgets); kein ungebremstes Konflikt-Event-Spamming.
6. Deterministische Tick-Simulation mit Seed und Replay, Provenienz, Beobachtbarkeit und invariantenbasierten Tests.
7. Keine heimliche moralische Optimierung: soziale Normen und Ethiken sind im Weltmodell konkurrierende und wandelbare Perspektiven.

## Fachdomänen
- **Sozial:** Provokation, Bedrohung, Beistand, Vermittlung, Gewaltfolgen, Vertrauensreparatur.
- **Politisch:** Einfluss, Legitimität, Institutionen, Koalitionen, Missbrauch, Protest, Reform.
- **Ökologisch:** Emissionen, Schadstoffbestände, Exposition, Schäden, Sanierung, natürliche Regeneration.
- **Strukturell:** Wartungsstau, Verfall, Ausfälle, Reparatur, Wiederaufbau.
- **Kulturell:** normativer Wandel, institutionelles Lernen, gesellschaftliche Erinnerung.

## Schnittstellenentwurf
- Eingänge: read-only Snapshot aus NPC-/Gruppen-/Institutionen-/Ressourcen-/Umweltzustand; Tick/Seed; neue Aktionen/Ereignisse.
- Ausgabe: validierte Effects/Commands, Konflikt- und Regenerationsereignisse sowie Ursachen-/Unsicherheitsmetadaten.
- Core prüft Berechtigung, Kosten, Bestände, konkurrierende Änderungen und verbucht atomar.
- Störungen der Lebensmittelversorgung gehen über vorhandene Engpass-/Lieferkettenmechanismen; keine parallel erfundenen Güterbestände.

## Pilot Seelenberg – vertikale Szenarien
### S1 Cafékonflikt
Ein NPC provoziert einen anderen. Begleiter und Umstehende wählen unterschiedliche Reaktionen (Hilfe, Vermittlung, Flucht, Ignorieren). Vertrauen, Erinnerung und Gruppenzusammenhalt verändern sich. Versöhnung ist möglich, aber nicht garantiert.

### S2 Machtkonzentration
Ein einflussreicher NPC organisiert Unterstützer und versucht legitimen oder illegitimen Zugriff auf eine knappe Ressource. Institutionen, Opposition und Betroffene reagieren autonom. Keine scripted „Bösewicht“-Rolle.

### S3 Umweltbelastung
Ein Betrieb verursacht eine persistente Belastung. Umwelt- und Gesundheitsfolgen, ökonomische Anreize und öffentliche Reaktionen beeinflussen Verhalten. Sanierung verbraucht reale Ressourcen und reduziert Belastung schrittweise; Restschäden bleiben messbar.

## Umsetzung in überprüfbaren Etappen
1. Inventur: bestehende NPC-, Gruppen-, Core-, Umwelt-, Ereignis- und Admin-Modelle; Integrationspunkte benennen.
2. Reines TypeScript-Fachmodell: Typschema, Evaluator, Effects, deterministische Szenarien, Tests; noch kein Live-Schreibzugriff.
3. Core-Anbindung: atomare Effects, Event-Persistenz, Tick-Budgets und Replay.
4. NPC-Integration: Wahrnehmung, Entscheidungsoptionen, Beistand/Gruppenreaktion, Gedächtnis.
5. Umwelt-/Institutionen-Integration und administratives Observability-Dashboard.
6. Balancing mit Simulationen und Spielerfeedback; Feature-Flag für kontrollierte Aktivierung.

## Akzeptanzkriterien
- Gleicher Snapshot + Seed + Tick erzeugt identische Ergebnisse.
- Kein Effekt erzeugt negative Bestände oder dupliziert Buchungen.
- NPCs zeigen mindestens drei plausible Reaktionspfade in S1.
- S2 kann ohne festgeschriebenes Ergebnis eskalieren oder friedlich enden.
- S3 modelliert anhaltende Schadstoffbestände und kosten-/zeitabhängige Erholung.
- Events sind ursächlich nachvollziehbar und erneut abspielbar.
- Bestehende Produktion, Gebäude und NPC-Routinen bleiben bei deaktiviertem CCRS unverändert.
- Private Charakter-/Autorenwerkzeuge und nichtöffentliche Cultural-DNA-Dokumente bleiben außerhalb öffentlich sichtbarer Spieloberflächen.
