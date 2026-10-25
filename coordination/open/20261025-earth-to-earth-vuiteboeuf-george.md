---
title: "Vuiteboeuf als Earth-Ort und GEORGE-Schauplatz integrieren"
source_area: earth
target_area: earth
status: open
priority: normal
created: 2026-10-25
claimed_by: null
depends_on: []
touches:
  - docs/world/earth/vuiteboeuf-george.md
input_sha: null
write_scope:
  - src/
  - app/
  - components/
  - lib/
  - supabase/migrations/
  - tests/
  - docs/world/earth/
read_scope:
  - docs/
  - src/
  - app/
  - components/
  - lib/
  - supabase/
risk_class: code
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag
Vuiteboeuf (VD, Schweiz) in der bestehenden globalen noχ¹ᐃ-Erdkarte als realen, suchbaren Ort ergänzen und einen gesondert gekennzeichneten literarischen GEORGE-Schauplatz vorbereiten.

## Grundlage
Siehe [Ortsdefinition](../../docs/world/earth/vuiteboeuf-george.md). Reale Orte Vuiteboeuf, Covatannaz-Schlucht, Sainte-Croix; fiktionale alte Spieldosenfabrik ohne erfundene genaue Gebäudegeometrie.

## Umsetzung
1. Earth-Orts-/POI- und Suchschema untersuchen, bestehende Einträge und Dubletten prüfen.
2. Vuiteboeuf als WGS84/OSM-gestützten Ort aufnehmen, sichtbar und über Suche auffindbar.
3. Beziehungen zur Covatannaz-Schlucht und Sainte-Croix anlegen, ohne Fantasiedistanzen.
4. GEORGE als getrennten fiktionalen Werkbezug modellieren. Für die alte Fabrik keine vermeintlich reale Adresse erfinden; spätere Standortentscheidung und Manuskriptkanon abwarten.
5. Falls Innenräume vorgesehen: Aufgaben für `interiors` über die bestehende Koordination ableiten, keine eigene parallele Raumlogik.
6. Karten-, Such-, Status- und Regressionsprüfungen durchführen.

## Abgrenzung
Keine Änderung an Wirtschafts-/Tick-Balancing; keine Live-Migration ohne Freigabe; keine neue eigenständige Welt/Map; keine Festlegung offener Romanfragen.

## Akzeptanzkriterien
- [ ] Vuiteboeuf ist auf der globalen Erdkarte sichtbar und suchbar.
- [ ] Geografie ist mit realen Quellen belegt und basiert auf vorhandenen Koordinatensystemen.
- [ ] Reale und fiktionale Daten sind trennbar und entsprechend gekennzeichnet.
- [ ] Gemeinsame Dashboard-Shell und POI-/Innenraumstrukturen werden wiederverwendet.
- [ ] Tests für Ortssuche und Kartendarstellung laufen erfolgreich.
- [ ] Dokumentation und Kanonabgleich sind nachvollziehbar.

## Ergebnis / Nachweis
- Commit/PR:
- Tests:
- Migration:
- Deployment:
- Hinweise:
