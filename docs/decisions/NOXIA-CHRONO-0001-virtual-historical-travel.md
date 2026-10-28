# NOXIA-CHRONO-0001 – Virtuelle historische Zeitreisen

Status: proposed – fachlicher Pilot im Branch `feat/chronotravel-domain-v1`, keine produktive Buchung
Datum: 2026-10-28

## Ziel

Die **noχ¹ᐃ ChronoTravel Agency** vermittelt VR-Simulationen historischer Orte. Keine physische Zeitreise, kein Umschreiben der persistenten Weltzeit. Buchungen werden später als reguläre wirtschaftliche Transaktionen des Core geführt; historische Szenen sind read-only-Rekonstruktionen.

## Pilot

Ein realer Ortsanker am historischen Hippodrom in Istanbul, drei Zeitschnitte: 550 / 1200 / 1700. `lib/game/chronotravel/catalogue.ts` enthält zunächst nur Szenenmanifeste, ausdrücklich **keine bereits historisch validierten 3D-Szenen**. Preise und Kapazitäten sind Designplatzhalter, nicht produktives Balancing.

## Wissenschaftliche Nachvollziehbarkeit

Jede Szene führt Quellenreferenzen mit Einstufung `documented`, `inferred` oder `speculative`. Ein Platzhalter `research-required:` ist keine Quelle. Historische NPCs dürfen nur zeitgenössisch verfügbares Wissen besitzen. Aus heutiger Perspektive bekannte Befunde erscheinen als optionale didaktische Metainformation, nicht als Wissen der historischen Figuren. Alternative History ist deutlich zu markieren und darf nicht in den SSF-Wissensbestand zurückfließen.

## Systemgrenzen

- **Core:** einzige Autorität für Zeitskala, Credits/Wallet, Reservierung, Tick, Eigentum und NPC-Memory. Buchungen müssen atomar gegen Kapazität und Guthaben geprüft werden; das reine Domänenmodell persistiert nichts.
- **KG/SSF:** externe Referenzen mit Provenienz und Evidenzstatus, niemals spontan erfundene kanonische IDs.
- **Simulation:** historisches Setting darf keine aktuellen Welt-Ressourcen, Bevölkerungsdaten oder Wirtschaftssalden überschreiben. Keine historischen NPCs unkontrolliert in die reale Population kopieren.
- **Kognition:** abgeschlossene Besuche können über bestehende Gedächtnis- und Lernsysteme als *simulierte* Erfahrung verarbeitet werden. Nicht automatisch wahre historische Erinnerung.

## MVP-Schnittstellen

`validateScene`, `validateReservation`, `quoteCredits`, `evidenceOverview`, `visitMemoryEvent` in `lib/game/chronotravel/domain.ts`. Reine Funktionen, keine DB-Migration, keine API, kein UI, keine Live-Reise.

## Nächste Umsetzungsschritte

1. Core-Integration: atomare Transaktionen, Persistenz, Stornierung und Slot-/Zeitfensterkollisionen.
2. Quellenkuration von KG/SSF mit datierten Belegen für Bauformen, Stadtentwicklung, Sprachgebrauch.
3. Renderer/Assets: drei Zeitstände auf identischem realen Ortsanker; Unsicherheits-Overlay.
4. Historische NPC-Schicht mit zeitlich begrenztem Wissen, Dialogen, sozialem Kontext und Reiseleiterrolle.
5. In-World-Agentur, Tickets und Lernmodul in der Akademie; Tests für Multiplayer, Manipulationsschutz und Performance.

## Desktop-WebGL-Prototyp (28.10.2026)

Route `/chronotravel` rendert nun mit der bereits installierten Bibliothek `three` eine tatsächliche WebGL-Szene. Geometrien für Platz, Obelisk und Gebäude sind bewusst schematisch und nicht archäologisch validiert. Kamera mit WASD und Pfeiltasten, Licht/Schatten, Nebel, drei epochenspezifische Massenmodelle. Nicht live verifiziert: TypeScript-/Next.js-Build, Browser-/GPU-Kompatibilität und Laufzeitverhalten. Keine Mobiloptimierung vorgesehen. Vor Merge bitte `npm run build` und Browser-Smoke-Test mit Epochenschaltung und Tastatursteuerung ausführen.

## Modulare Architektur v1 (28.10.2026)

`app/chronotravel/historicalBuildings.js` generiert Tribünen, Arkaden, Säulen, Loge, einfache Mauersegmente und Häuser aus Three.js-Geometrie. Jahresauswahl: 550 (Tribünen/Loge), 1200 (reduzierte Tribünen und gemischte Bebauung), 1700 (Häuser mit Dachformen am offenen Platz). Alle Abmessungen, Bauformen und Positionen sind **illustrativ, nicht quellengeprüft**. Die Funktion gibt ein Cleanup zurück und erzeugt weder Datenbankobjekte noch echte historische NPCs. Nächste Aufgaben: originale Quellen je Bauwerk, sichere Kollisionsnavigation, Performance-/Render-Test im Browser und ggf. Instancing.

## Wegsystem und Szenenbevölkerung (28.10.2026)

`app/chronotravel/historicalStreetLife.js` stellt einen einfachen zentralen Weg, visuelle Eingangshinweise (1200/1700), sechs deterministisch animierte lokale Figuren und eine begehbare Korridorfläche mit Hindernis am Obelisken bereit. Die Eingänge sind **noch keine betretbaren Innenräume**; Figuren sind **keine echten Core-NPCs**, sie besitzen weder Dialog noch Gedächtnis noch persistierte Identität. Die Kollisionsprüfung ist ein eng begrenzter Prototyp, kein vollständiger Physik-/Navmesh-Algorithmus. Vor Merge: WebGL-Browser-Smoke-Test, Prüfung der Szene bei Szenenwechsel, Performance und Build. Keine wissenschaftliche Authentizitätsfreigabe.
