# NOXIA – Prüfauftrag Myzelmaterial und dezentrale Bioproduktion

Status: offen / keine Runtime-Änderung · 2026-10-10

Ausgangsdokument: https://github.com/thomaspeterkueper/kueper-engineering/blob/main/docs/research/MYCO-0001-pilzbasierte-baustoffe-materialkreislaeufe.md

Vor jeder Umsetzung aktuellen Stand prüfen: vorhandene Materialien, Wirtschaftsgüter, Gebäude, Produktionsketten, ECLSS/Soil-Ecology-Verträge, Tick-Last, Persistenz, Kosten- und Performancebudget. Vorhandene Konzepte wiederverwenden statt doppeln.

Mögliche Produktkette (nur Entwurfsannahme): pflanzliche Rückstände → Substrat → Kultivierungsanlage → Trocknung/Pressung → Dämm-/Leichtbaukomposit. Für jeden Schritt Masse [kg], Energie [kWh], Wasser [kg], Zeit [h], Verluste und Nebenprodukte abrechnen. Keine fiktive »kostenlose Biomasse«; konkurrierende Kompost-/Nährstoffverwendungen berücksichtigen.

Prototyp: zunächst reines Kosten-/Prozessmodell ohne laufende NPC- oder Tick-Updates; ereignisgetriebene Batch-Buchungen statt häufiger DB-Schreibvorgänge, Metriken für DB-Zugriffe/CPU/Storage vor jeder Skalierung. Biologische Zonen mit Kontaminations- und Quarantänefällen modellieren.

Mars-Sicherheit: Innenverkleidung/Dämmung ≠ drucktragende Außenhülle oder Strahlenschutz. Keine Mars-Freilandpilze implizieren.

Akzeptanz: Dokumentierte Bestandsaufnahme, Materialbilanzen, Performance-Messung, Tests und Entscheidungsvorlage vor Implementierung.
