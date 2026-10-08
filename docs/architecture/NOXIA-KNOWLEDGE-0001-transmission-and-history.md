# NOXIA-KNOWLEDGE-0001 — Ereignis, Erinnerung, Überlieferung und Spur

Status: Architekturentscheidung / Implementierungsetappe 1 (2026-10-08)

## Grundsatz

**Ein Ereignis ist nicht seine Erinnerung. Eine Erinnerung ist nicht ihre Überlieferung. Eine Überlieferung ist nicht automatisch die Wahrheit.**

Die reale Simulationshistorie gehört ausschließlich dem autoritativen Ereignisstrom (bestehende `population_events` und weitere fachlich autoritative Ereignisse). Die Welt kennt keine globale allwissende NPC-Datenbank. Jeder NPC darf nur aus eigenen Wahrnehmungen, erhaltenen Äußerungen, zugänglichen Aufzeichnungen und eigenen Schlussfolgerungen Wissen ableiten. LLM-Ausgaben sind keine autoritativen Ereignisse und erzeugen nicht ohne überprüfte Handlung eine neue Weltwahrheit.

## Vier unterschiedliche Konzepte

1. **Ereignis:** autoritativ verifizierte Änderung; unveränderliche Quelle für Forschung/Replays.
2. **Individuelle Erinnerung/Überzeugung:** begrenzte, fehlbare Projektion; besitzt Perspektive, Quelle, Sicherheit, Zeitpunkt und Interpretation. Glauben und Nichtglauben sind nicht vorab als Wahrheiten markiert.
3. **Übertragung:** gerichtete, zeitgebundene Kommunikation eines Inhalts, nicht automatisch dessen Akzeptanz. Kopie und Interpretation getrennt; mögliche Bedeutungsverschiebung.
4. **Persistente Spur:** Schrift, Datei, Artefakt, Gebäude, Ritual oder Praxis; mit Ort, Eigentum/Zugriffsrechten, Haltbarkeit und möglicher Zerstörung. Eine Spur ist kein unmittelbarer Zugang zu dem Ereignis.

## Verträge und Grenzen

- Ein Gedankenbericht verweist auf `source_ref` und `source_kind`: `event`, `perception`, `testimony`, `record`, `inference` oder `unknown`. `unknown` ist zulässig und darf nicht stillschweigend in `event` umgewandelt werden.
- Jede Übertragung besitzt Sender, Empfänger, übermittelten Wortlaut/Inhalt, Ursprungsreferenz, eigenen Zeitpunkt sowie optional eine davon **getrennte** Interpretation beim Empfänger.
- Keine Wissensdiffusion durch bloße räumliche Nähe. Wahrnehmung braucht Sensorik bzw. unmittelbaren Zugang; Schrift braucht Auffindbarkeit, Lesbarkeit und Berechtigung; Gespräch braucht tatsächlich stattgefundene Kommunikation.
- Das System darf Inhalt, Wahrheit, Glaubwürdigkeit, moralische Güte oder Religion nicht gleichsetzen. Keine intrinsischen Religion-/Atheismus-/Weisheitsboni.
- Vergessen/Verzerren sind begründete Mechanismen (Wahrnehmung, Zeit, Abruf, Motivation, Kanäle), nicht pauschal willkürliche Zufallsverfälschung.
- Individuelle private Erinnerungen und religiöse Überzeugungen sind potenziell besonders sensible Daten. Minimal speichern, Zugriffe absichern, Retentionsregeln beachten; Forschung verwendet anonymisierte oder synthetische Daten.
- Wirtschaftlichkeit: Eintrag nur bei relevanten Ereignissen, Batch-Verarbeitung und kompakte Projektionen; LLM nur für Ausnahmedialoge oder semantische Interpretation, nie für jeden Tick.

## Implementierung

Phase 1: Reines, deterministisches Modul `lib/game/knowledge/transmission.ts` implementiert den minimalen Informationsfluss ohne persistente Nebenwirkung. Es schließt eine stille Akzeptanz aus und erhält die Quellenkette. Dazu eigenständige Tests.

Phase 2: Nach Prüfung vorhandener NPC-/Erinnerungs-/Rechte-Schemata: migrationsfähige Tabellen/Policies für Übertragungen, Projektionen und Spuren; auf bestehende IDs referenzieren, kein Shadow-Event-System.

Phase 3: Erleben → Erinnern → Erzählen → Weitererzählen → Aufzeichnen → Vergessen/Wiederentdecken als End-to-End-Test über simulierte Generationen. Vergleich mit autoritativer Quelle nur im internen Forschungsmodus.

## Evaluierung

Messgrößen: (a) Herkunftskette rekonstruierbar, (b) Wissen ohne tatsächlichen Kanal = 0, (c) Verfälschung und bewusste Anpassungen unterscheidbar, (d) bei Wegfall des letzten Gedächtnisträgers ohne Spur geht Wissen für NPCs verloren, (e) Laufzeit- und Datenbankkosten pro 1.000 Ereignisse.

## Produktpositionierung

Der öffentlich sichtbare Produktname ist **noχ¹ᐃ**. Forschungsziel: eine persistente Gesellschaftssimulation, in der Ereignisse unabhängig von ihrem späteren historischen Bild stattfinden und NPCs Kultur, Glaube, Tradition und Wissen durch tatsächliche Erlebnisse und Weitergabe entwickeln. **Nicht als bereits vollständig implementierte Funktion behaupten.** Einzigartigkeit gegenüber anderen Spielen benötigt Vergleich und Benchmark; vorläufig als Differenzierungshypothese kommunizieren.


## Betriebsentscheidung 2026-10-08 — sensibler Gesprächsinhalt

Der Gesprächsendpunkt kann Aussagen des Spielers als epistemische Spuren projizieren. **Diese zusätzliche Erfassung ist standardmäßig deaktiviert** und verlangt sowohl die serverseitige Freigabe `NOXIA_TESTIMONY_CAPTURE_ENABLED=true` als auch das explizite Feld `allowTestimonyMemory: true` im jeweiligen Request. Das Feld ist bislang nicht als geprüfter, persistenter Nutzer-Einwilligungsdialog implementiert und ist **keine ausreichende Rechtsgrundlage** für Live-Erfassung. Daher Flag aus lassen, bis Opt-in-UI, nachweisbare Einwilligung, Widerruf, Löschung, Speicherlimit und Replay-Idempotenz eingebaut und geprüft sind.

Die bestehende `npc_player_conversation_memory` speichert bereits Dialoge unabhängig von der neuen Funktion; diese Sicherheitsentscheidung gilt nur für die zusätzliche epistemische Projektion. Die volle Datenschutzbewertung muss beide Speicherpfade umfassen.

Offene Risiken: zeitstempelbasierte Trace-IDs verhindern Duplikate bei Request-Retries nicht zuverlässig; das neue Trace-Schema erlaubt unbegrenztes Wachstum ohne Retention; die subjektive Erinnerung ist noch nicht in den NPC-zu-NPC-Dialogfluss integriert. Alle drei vor produktiver Aktivierung beheben.
