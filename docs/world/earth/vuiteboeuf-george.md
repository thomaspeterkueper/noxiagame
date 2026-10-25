# noχ¹ᐃ Erde — Vuiteboeuf / GEORGE

Status: Ortskonzept und Implementierungsgrundlage (noch keine Runtime-Freischaltung)
Stand: 2026-10-25
Verantwortung: `earth`, für Innenräume `interiors`, für Persistenz `core`

## Ort und Identität
- Kanonischer technischer Slug: `ch-vd-vuiteboeuf`
- Sichtbarer Name: **Vuiteboeuf** (literarische Schreibweise „Vuitebœuf“ als Alias)
- Land: Schweiz (CH), Kanton Waadt (VD), Bezirk Jura-Nord vaudois
- Geografische Einordnung: Am Jurafuß, unterhalb von Sainte-Croix; Gewässer Arnon
- Koordinaten: Reale Ortsgeometrie aus bestehendem WGS84-/OSM-Provider auflösen; keine erratene Punktgenauigkeit für Gebäude oder Flussabschnitte.
- Gemeinde-Referenz: https://www.vuiteboeuf.ch/notre-commune
- Geotop Covatannaz: https://data.geo.admin.ch/ch.swisstopo.geologie-geotope/PDF/geotope-CH_048.pdf

## Reale Orte / räumliche Kette
1. Vuiteboeuf — Dorf / Einstieg / Kartensuche
2. Gorges de Covatannaz — reale Schlucht / Landschafts- und Lernort
3. Sainte-Croix — Hochort; Bezug zu Musikautomaten, mechanischen Werkstätten und Spieldosen
Die Ortsbeziehungen werden über echte Straßendaten und Terrain abgebildet; keine fiktiven Entfernungen, Routen oder Reisezeiten festschreiben.

## GEORGE — fiktionale Ebene
- Werkbezug: `GEORGE` (separate literarische Kanonquelle, nicht in noxiagame neu festlegen)
- Literarischer Schauplatz: alte Spieldosen-/Mechanikfabrik bei Vuiteboeuf im Schweizer Jura, im Umfeld des Arnon.
- Vorgesehene Mikroorte: Werkstatt, Maschinen-/Lagerhalle, Keller, Verbindungsgang und Wohnbereich über der Fabrik.
- Figuren und Motive aus frühen Entwurfsständen: Eric, Mariella, ihre Familie; „George“ als Kristall/Resonanzphänomen; auffällige Synchronisation mechanischer Uhren. **Kanonstatus prüfen:** spätere GEORGE-Fassungen und Manuskripte können Namen, Interpretation und Details geändert haben.
- George weder als nachgewiesenes physikalisches Phänomen noch als eindeutig gesicherte Entität in Earth-/SSF-Daten ausgeben. Literarische Mehrdeutigkeit und Perspektiven erhalten.

## Modellierung / Akzeptanz
- Der reale Ort wird in derselben Erde erfasst, ohne eigene Weltinstanz.
- Karten-/Suchort, fiktionales POI sowie optionale Innenräume sind getrennte Objekte mit eindeutigen stabilen IDs und Quellen-/Kanonstatus.
- Ein fiktionales Gebäude wird NICHT an einer erfundenen exakten Adresse platziert. Vor Festlegung des Bauwerksstandorts ist eine kanonische und kartentechnische Entscheidung nötig.
- Reale Straßen, Flüsse, Terrain und Ortsgrenzen kommen aus dem Earth-Geodatenpfad; öffentliches Gameplay darf keine Fiktion als historische Lokalgeschichte deklarieren.
- Die Ansicht nutzt die gemeinsame Dashboard-Shell und vorhandene Earth-/Interior-Capabilities.
- GEORGE-Inhalte nur stufenweise anhand freigegebener Werkfassung freischalten; keine unbelegten NPC-Biografien oder Plotauflösungen.
- Vorerst keine neuen Ressourcen-/Wirtschaftswerte, keine erzwungene Quest, keine Live-Datenbankänderung.

## Prüfschritte
- Earth-POI-Schema, Suchindex und Karten-Layer ermitteln.
- Vor Anlegen auf Dubletten für Vuiteboeuf, Sainte-Croix und Covatannaz prüfen.
- Geeignete OSM-/amtliche Geodaten mit WGS84 verknüpfen.
- Reales Dorf auf der Erdkarte anzeigen und finden können.
- Fiktionales GEORGE-POI klar kennzeichnen, Innenraum nur wenn implementiert.
- GEORGE-Kanon mit maßgeblichem Manuskript abgleichen; Frühentwurfsnamen nicht ungeprüft übernehmen.
