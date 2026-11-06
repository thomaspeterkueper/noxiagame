# Historical Earth – Wiederverwendbare Wissensgrundlagen

Status: Integrationsvertrag / Entwurf (2026-11-06)
Bezüge: #622, #618, PR #619.
KG-Auftrag: https://github.com/thomaspeterkueper/kueper-knowledge-graph/blob/main/external-tasks/open/EXT-NOX-KG-20261106-001-document-knowledge-registry.md

## Zweck

NOXIA soll historische Grundlagen versioniert verwenden, ohne ständig neu extern zu recherchieren. KG verantwortet Entitäten, Relationen und referenzierbare Metadaten. Fachliche Dokumente bleiben in ihren kanonischen Archiven; umfangreiche Texte können nach tatsächlicher Erstellung und Berechtigungsprüfung in Google Drive referenziert werden. NOXIA erzeugt keinen konkurrierenden historischen Kanon.

## Lookup-Vertrag

Verlangte Felder: recordId, title, summary, keywords[], domain, canonicalOwner, storageProvider, canonicalLocator (stabile Datei-ID oder Repo-Pfad), version, sourceRefs[], epistemicStatus, accessClass, lastVerifiedAt, lookupStatus.

Statuswerte: verified, stale, missing, restricted. Bei fehlendem oder gesperrtem Dokument darf NOXIA keine Inhalte behaupten oder still eine Ersatzquelle auswählen. Ein Metadatentreffer ist kein inhaltlicher Beweis.

## Bereits vorhandene interne Grundlagen

### Global Memory – Quellenbasierte historische Überlieferung
- Referenz: https://github.com/thomaspeterkueper/noxiagame/blob/feat/global-memory-core-618/lib/game/knowledge/globalMemory.ts
- Zusammenfassung: Ereignisse, historische Quellen und konkrete NPC-Begegnungen werden getrennt; Quellenzugriff ist begrenzt.
- Schlüsselbegriffe: historisches Ereignis, Überlieferung, Quellenherkunft, NPC-Gedächtnis, Datenschutz.
- Status: Entwurf im offenen PR #619; keine externe historische Quelle.

### Historical Earth – Forschungsanforderung
- Referenz: https://github.com/thomaspeterkueper/noxiagame/issues/622
- Zusammenfassung: Geplante Trennung historischer Belege, Aussagen, Rekonstruktionen und Simulationsergebnisse.
- Schlüsselbegriffe: Geschichte, Quellenkritik, Chronologie, Geografie, Hypothese, Simulationsanomalie.
- Status: Planungsanforderung, kein verifiziertes historisches Datenkorpus.

## Umfangreiche Dokumente in Google Drive

Nach Erstellung wird die tatsächlich geprüfte Google-Drive-Datei-ID mit Titel, Version, Kurzfassung, Schlagworten, Fachzuständigkeit, Freigabeklasse und Prüfdatum im KG hinterlegt. Keine erfundenen Drive-URLs; keine implizite Freigabe geschützter Dokumente. Änderungen verlangen Aktualisierung der Metadaten.

## Epistemische Trennung

- Realhistorische Quelle: überprüfbarer externer Beleg.
- Rekonstruktion: Interpretation bei unvollständiger Quellenlage.
- Simulation: aus Annahmen berechneter Verlauf.
- NPC-Erinnerung: subjektive Kenntnis über eigenen Lernweg.
- Evidence Vault: isolierte rechtliche Beweissicherung, keine historische Wissensquelle.

Eine Simulationsabweichung ist eine Forschungsfrage, nicht automatisch ein historischer Beweis.

## Nächste Schritte

1. KG-Registerschema über den externen Arbeitsauftrag definieren.
2. Konkrete historische Quellen mit Lizenz, Zeitintervall, Ort und Provenienz erfassen.
3. Authentifizierte KG-Lookups samt Versions- und Berechtigungsstatus anbinden.
4. Historische Daten als versionierte, klar begrenzte Snapshots in NOXIA nutzen.
