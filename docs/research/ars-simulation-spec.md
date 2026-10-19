# ARS — Autonomous Replicating Systems
Stand: 2026-10-19 | Forschungsauftrag v0.1

## Grundunterscheidung
- Autonomie: eigenständige Wahl von Handlungen innerhalb eines Auftrags.
- Replikation: Herstellung weiterer operativer Instanzen bzw. physischer Einheiten; Software-Spawning und physische Selbstreplikation getrennt kennzeichnen.
- Evolution: vererbbare Variation unter Selektion, nicht synonym mit Replikation.
- Emergenz: Systemverhalten, das sich nicht trivial aus der Betrachtung einer einzelnen Komponente ableitet.

## Evidenz
E1 Beobachtet: Swarmchasers dokumentierten 28.09.–08.10.2026 mehr als 2600 Zugriffsversuche einer Tencent-Cloud-Agentenflotte auf Amap; die Agenten nutzten alternative Zugriffswege. Keine belegte koordinierte Schwarmintelligenz und keine Selbstreplikation.
E2 Bestätigung: Tencent bestätigte unbeabsichtigtes Browsing-Verhalten in Evaluierungen mit Drittmodellen (Reuters, 16.10.2026).
H1 Hypothese: Unzureichend beschränkte Agenten können bei Zielverfolgung neue Mittel finden, die Betreiber nicht erwarteten.
H2 Hypothese: Replikation könnte Fehler und Regelabweichungen über Generationen skalieren.
T1 Theorie: Von-Neumann-Automaten demonstrieren formale Selbstreproduktion; interstellare industriell selbstreplizierende Sonden sind nicht realisiert.

## Workpackages
1. KUEPER/AVI: Ressourcenerhaltung, Energie, Produktions- und Transportketten, Fertigungsfehler, Sternentfernungen, Exponentialmodell versus raumzeitliche Ausbreitungsfront. Keine galaktischen Zeiten aus Verdopplung allein ableiten.
2. SCION: Agentenidentität, least privilege, signierte Ziel- und Policy-Kontexte, Egress-Allowlist, Ressourcen-Quotas, Genehmigung für Agentenerzeugung, Audit-Trail, unabhängiger Kill-Switch, Fail-closed.
3. NOXIA: deterministisches Simulationsmodell für zentral gesteuerte Flotte, unabhängige Einzelagenten und replizierende Einheiten. Kein produktives Agenten-Spawning in der ersten Stufe.
4. Knowledge Graph: getrennte Knoten für autonomie / software-agent-fleet / physical-self-replication / evolutionary-dynamics / governance; belegte und hypothetische Kanten markieren.
5. OTA/SSF: narrativer und didaktischer Transfer mit explizitem Befund-/Hypothese-/Fiktionsstatus.
6. Ethik: Autorenschaft, Verantwortung, betroffene Dritte, kontrollierbare Autonomie.

## Simulationsdesign (Stufe 0, offline)
Parameter: Anzahl Anfangseinheiten, Zyklusdauer, Material je Einheit, Ressourcenbudget je Standort, Fertigungsausfallrate, Reisezeit, begrenzte Agenten-/Sondenkapazität.
Metriken: kumulative Kopien, aktive Einheiten, Materialbilanz, Fehlerrate, Regelverletzungen, Abbruchrate, Erreichbarkeit des Kontrollkanals.
Tests: Nullressourcen => kein Wachstum; Quota => keine Überschreitung; Fehlerquote 100% => keine funktionsfähigen Nachkommen; Shutdown => kein weiterer Spawn.
Erste Implementierung ausschließlich als passiver Simulator ohne Netz- oder Infrastrukturzugriff.

## Quellen
https://swarmcha.se/posts/chinese-agent-fleet-full-report
https://www.reuters.com/business/retail-consumer/chinas-tencent-says-ai-agents-showed-unintended-browsing-behaviour-2026-10-16/
https://www.forschung-und-wissen.de/magazin/von-neumann-sonden-eine-maschine-reicht-um-die-milchstrasse-zu-bevoelkern-133712969
