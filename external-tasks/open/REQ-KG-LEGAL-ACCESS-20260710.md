# REQ-KG-LEGAL-ACCESS-20260710 — Zentrale Rechtstexte aus dem KG beziehen

## Target System
`SYS:KUEPER:noxia`

## Origin
`SYS:KUEPER:knowledge-graph`

## Status
Open

## Priority
High vor öffentlicher Bewerbung und produktiver Kontonutzung

## Zweck
NOXIA rendert zentrale Rechtstexte aus dem Knowledge Graph. Verantwortlichen-Daten und Rechtstexte bleiben KG-owned; NOXIA ergänzt nur verifizierte technische Fakten über den Request-Workflow.

## Kanonische Quellen

- `exports/document-references-0.1.json`
- `registry/legal/impressum-master.json`
- `registry/legal/datenschutz.de.md`
- `registry/legal/terms.de.md`

Quelle: `thomaspeterkueper/kueper-knowledge-graph`

IDs:

- `DOC:KUE:LEGAL-IMPRINT-DE`
- `DOC:KUE:LEGAL-PRIVACY-DE`
- `DOC:KUE:LEGAL-TERMS-DE`

## Requested Change

1. Document IDs über `exports/document-references-0.1.json` auflösen und die dort referenzierten Dateien build- oder serverseitig laden.
2. Platzhalter aus `registry/legal/impressum-master.json` ersetzen.
3. Lokale Seiten/Routen für Impressum, Datenschutz und Nutzungsbedingungen rendern und im Footer verlinken.
4. Keine Client-seitige GitHub-/KG-Abfrage.
5. Keine lokalen inhaltlichen Forks der Rechtstexte. NOXIA-spezifische Fakten als KG-Request zurückmelden.
6. Produktiven Stand von Supabase/Auth prüfen und dokumentieren: gespeicherte Felder, Region, Cookies/Session, Spielstand, Löschweg und Aufbewahrungsfristen.
7. `NOX-0005` umsetzen, damit Courier Prime und Playfair Display beim Build self-hosted werden und keine Google-Font-Anfrage zur Laufzeit verbleibt.
8. Privacy und Terms sind aktuell `draft_productive` und nicht juristisch freigegeben. Erst nach ausdrücklichem `released` als freigegebene Rechtstexte ausweisen.

## Temporärer Zugriff

Bis der öffentliche KG-Endpunkt live ist, beim Build aus dem öffentlichen KG-GitHub-Repository lesen. Source-Pfade über die Registry ermitteln; keine hart codierten Textkopien.

## Akzeptanzkriterien

- KG bleibt SSOT.
- Impressums-Platzhalter werden korrekt aufgelöst.
- Keine Browser-Laufzeitabfrage an GitHub/KG.
- Supabase-/Kontodatenverarbeitung ist verifiziert und an den KG gemeldet.
- Remote-Google-Fonts sind nach `NOX-0005` entfernt.
- Footer-Links und Legal-Routen funktionieren.
- Draft-/Release-Status wird respektiert.

## Created
2026-07-10

## Curator
T.P.K.
