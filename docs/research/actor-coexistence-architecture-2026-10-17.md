# NOXIA – Koexistenz menschlicher und synthetischer Akteure

**Architekturauftrag:** NOX-ACTOR-COEXIST-001  
**Datum:** 2026-10-17  
**Status:** Langfristiges Zielbild / Entwurf, keine Produktionsänderung

## Leitbild
NOXIA ist eine persistente, auch ohne eingeloggte Menschen fortlaufende Welt. Menschliche Spieler und simulierte NPCs handeln innerhalb gemeinsamer, nachvollziehbarer Weltregeln. NPCs sind eigenständige Spielakteure mit Erinnerungen, Bedürfnissen, Beziehungen und begrenzten Handlungsmöglichkeiten, nicht bloße Dekoration. Daraus können langfristige Biografien, Institutionen und eine gemeinsame, generationsübergreifende Geschichte entstehen.

## Akteursklassen
1. Menschliche Spieler: menschlich gesteuerte Entscheidungen, verbindliche Eigentums- und Zugriffsrechte.
2. Reguläre NPCs: Wahrnehmung, Erinnerung, Arbeit, Beziehungen, soziale Entwicklung.
3. Forschungs-NPCs: reguläre Weltregeln plus experimentelle, kontrolliert konfigurierte Kognitions- und Informationsverarbeitung. Ihre Zugehörigkeit darf nicht automatisch einen sozialen Status oder besondere Ressourcenrechte begründen.

## Gemeinsame Regeln
- Identische ökonomische Erhaltungs- und Eigentumsregeln; keine Credits, Materialien, Gebäude oder Informationen ohne nachvollziehbare Quelle.
- Handlungen sind zeit-, orts-, ressourcen- und berechtigungsgebunden.
- Jeder relevante Zustandswechsel ist nachvollziehbar: Akteur, Auslöser, Tick, Kosten, Ziel, Provenienz.
- Spielerautonomie und Datensicherheit: NPCs erhalten keine Administratorrechte, keinen Zugriff auf private Spielerinformationen und keine Umgehung der vorgesehenen Autorisierung.
- Kognitive Sonderkanäle dürfen im Forschungsmodus ausschließlich explizit simulierte Signale empfangen; dies ist kein Nachweis außersinnlicher Übertragung.

## Soziale Persistenz
NPCs dürfen Beziehungen, Wissen und begrenzte materielle Zustände über Ticks hinweg fortentwickeln. Ereignisse beeinflussen Biografien; wichtige Ereignisse werden auf geeigneter Abstraktionsebene in einer Weltchronik erfasst. Historische Informationen müssen Herkunft, Beobachtungsart und mögliche Unsicherheit bewahren. Narrative Kontinuität darf nicht allein aus frei erfundenen Rückblicken bestehen.

## Architekturbausteine (konzeptionell)
- Actor Registry: gemeinsame Identität und Rollen, getrennte Authentifizierung und Zugriffspfade.
- Action Gateway: validierte, autorisierte Weltaktionen für Menschen und NPC-Agents.
- World Simulation: deterministische Tick-/Ereignisverarbeitung, Ressourcenbilanzierung, Konfliktauflösung.
- Memory & Provenance: Episoden, abgeleitete Interpretationen, Quellenangaben, Retention und Löschregeln.
- Society Layer: Interaktion, Informationsaustausch, Institutionen, Reputation.
- Experiment Controller: Kohorten, Seeds, Feature-Flags, Auswertung; keine privilegierten Live-Wirtschaftsaktionen.
- Observatory: Kosten, Laufzeiten, abgelehnte Aktionen, Datenbankabfragen, Simulationsergebnisse, Sicherheitsereignisse.

## Last- und Kostenleitplanken
Bestehende Tick-Abstände und Batch-Verarbeitung respektieren. Nur bei relevanten Ereignissen teure Schlussfolgerungen oder LLM-Aufrufe; sonst regelbasierte Simulation. Population schrittweise nach Lastmessung erweitern. Datenbankabfragen bündeln, Nachrichtenaustausch begrenzen, Rate-Limits pro Agent. Degradationsmodus bei Ressourcenengpässen.

## Einführungsphasen
P0: Architekturabgleich mit realem Repository, Datenbank, NPC-/Traumsystem und Multiplayer-Schnittstellen.
P1: Offline-Kohortenexperiment; keine Produktionsmigration.
P2: Shadow-Betrieb in Staging, ohne produktive Wirtschaftseffekte.
P3: kleine Live-Canary-Kohorte hinter Flag und Kill-Switch; explizite Freigabe.
P4: freiwillig sichtbare, graduell wachsende NPC-Population mit Weltchronik.
P5: Interaktionen mit größeren externen Spielergruppen, Moderation und Missbrauchsschutz.

## Akzeptanzkriterien vor Live-Freigabe
Keine Breaking Changes der vorhandenen Persistenz-/Traumtypen. Eigentum, Ressourcen und Spielerkonten bleiben geschützt. Deterministische Replays, Rückrollbarkeit, kontrollierte Idempotenz und getrennte Audit-Ereignisse. SLOs und Budgetobergrenzen dokumentiert; Population kann jederzeit sicher gedrosselt werden. Transparente Beschreibung der Simulation gegenüber Spielern.

## Verknüpfte Forschung
Siehe [NPC-Informationskanäle](./npc-information-channels-2026-10-17.md): Kontrollgruppe, Rekombination, soziales Lernen, künstlicher Signalkanal und Placebo-Kanal. Ergebnisse dieser Simulation entscheiden nicht automatisch über einen Live-Rollout.

## Nächste Arbeiten
1. Vorhandene Actor-/NPC-/Player-Datenmodelle und Serveraktionen inventarisieren.
2. Gemeinsame Action-Invarianten, Berechtigungsgrenzen und Provenienz spezifizieren.
3. Offline-Simulator mit gematchten NPC-Kohorten und Kostenmetriken erstellen.
4. Nur nach Tests die Live-Erweiterung getrennt freigeben.
