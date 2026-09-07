---
id: EXT-ECO-NOX-20260907-signature-registry
title: Signatur-Registry vor Vergabe neuer OTA-*/ENG-*-Signaturen konsultieren
status: open
source: kueper-ecosystem
target: noxiagame
created: 2026-09-07
requested_by: Claude (im Auftrag von T.P.K.)
priority: high
affects: [noxiagame, overtime-archive, kueper-engineering]
supersedes: []
---

# EXT-ECO-NOX-20260907-signature-registry — Signatur-Registry vor Vergabe neuer OTA-*/ENG-*-Signaturen konsultieren

## Anlass

In diesem Repository wurden mehrfach OTA-TEC-Dossiers (u. a. Wasserextraktor, Rover, VEX-47, CYGNUS, Frühphase-Kombifahrzeug, Life-Support) mit Signaturen erstellt, die zeitgleich unabhängig auch andernorts vergeben wurden — konkret Kollisionen bei `OTA-TEC-0035`–`0037` (Serie "Die Kette vom Hexenteich") und `OTA-TEC-0088`–`0097` (Serie "Tharsis Hub"). Ursache: keine zentrale, maschinenlesbare Übersicht bereits vergebener Signaturen.

## Gewünschte Änderung

`kueper-ecosystem` führt jetzt eine Signatur-Registry (`registry/ota-signature-index.json`, siehe `ECO-ARC-0032-2026-DE.md`). Bitte:

1. Vor jeder neuen `OTA-*`- oder `ENG-*`-Signaturvergabe in diesem Repository (z. B. bei neuen `external-tasks/open/`-Requests an OTA/Engineering) diese Registry konsultieren.
2. Einen entsprechenden Hinweis in der README dieses Repositories ergänzen (Formulierungsvorschlag siehe `kueper-ecosystem/README.md`, Abschnitt nach dem External-Task-Format-Verweis).
3. Falls in diesem Repository selbst signaturtragende Dokumente entstehen (z. B. in `external-tasks/` referenzierte OTA-Signaturen), diese perspektivisch dem Collector in `kueper-ecosystem/tools/collector/scan_signatures.py` zugänglich machen (aktuell bereits als `SCAN_REPOS`-Eintrag vorgesehen).

## Begründung

Signaturvergabe ist repository-übergreifend (OTA, Engineering, NOXIA-nahe Requests). Eine zentrale Registry gehört gemäß Source-of-Truth-Prinzip ins `kueper-ecosystem` (Control-Plane-Rolle, analog zur bestehenden Status-Snapshot-Funktion aus ECO-ARC-0005), nicht in dieses Repository selbst — dieses Repository soll die Registry nur konsultieren und ggf. sein eigenes README entsprechend verweisen.

## Betroffene Repositories

- `kueper-ecosystem` (Registry-Quelle)
- `noxiagame` (dieses Repository, Konsultationspflicht)
- `overtime-archive` (Google Drive, Hauptquelle der Kollisionen — noch nicht automatisiert erfasst)
- `kueper-engineering` (paralleler Hinweis, siehe eigener External Task dort)

## Erwartetes Ergebnis

- README-Hinweis in `noxiagame` ergänzt.
- Zukünftige OTA-Signaturvorschläge aus diesem Repository werden vor Einreichung gegen die Registry geprüft.

## Hinweise

Der Google-Drive-Anteil des `overtime-archive`-Bestands ist in der Registry noch nicht automatisiert erfasst (fehlender Service-Account, siehe ECO-ARC-0032 "Nicht entschieden") — die Registry ist also ein Startpunkt, kein vollständiger Echtzeit-Stand. Bei Zweifel zusätzlich den Drive-Ordner direkt prüfen.
