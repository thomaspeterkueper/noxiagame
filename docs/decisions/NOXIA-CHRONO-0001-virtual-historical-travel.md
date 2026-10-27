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
