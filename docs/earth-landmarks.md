# Earth Landmarks

## Zweck

NOXIA verwendet reale Orte nicht als beliebige Sehenswürdigkeiten, sondern als persistente Anker der Erdoberfläche. Ein Landmark ist ein nicht normal baubares Weltobjekt, wenn mindestens eine der folgenden Bedingungen erfüllt ist:

1. Der Ort hat eine nachvollziehbare Funktion für Wissenschaft, Raumfahrt, Klima, Energie oder andere NOXIA-Systeme.
2. Der Ort ist ein kanonischer NOXIA-Ort wie der Hauptsitz der Solar Science Foundation.
3. Der reale Ort besitzt eine konkrete Verbindung zu einem anderen KUEPER-Werk und eignet sich deshalb als `cross-universe`-Anker.

Die kanonische Registry liegt in `lib/world/spatial/earthLandmarks.ts`.

## Cross-Universe-Regel

Ein Cross-Universe-Landmark muss auch ohne Kenntnis des anderen Werks funktionieren. Die Verbindung darf zusätzliche Tiefe liefern, aber sie darf den realen Ort nicht in ein Easter Egg verwandeln oder historische Behauptungen aus der Fiktion als Tatsachen darstellen.

Dafür trennt die Registry ausdrücklich:

- `presentDayRole`: reale bzw. historisch belastbare Bedeutung des Orts,
- `noxiaRole`: plausible Funktion oder Bedeutung innerhalb der NOXIA-Zeitlinie,
- `sourceProjects`: Relation zu anderen KUEPER-Projekten,
- `tags`: technische und redaktionelle Klassifikation.

## Erste kanonische Welle

### NOXIA / reale Wissenschaft

- Solar Science Foundation · Hauptsitz, Sundern
- ESA · ESOC, Darmstadt
- EUMETSAT · Hauptsitz, Darmstadt
- ESA · European Astronaut Centre, Köln
- DLR · Oberpfaffenhofen

### Cross-Universe

- Dvārakā / Dwarka — `Dvārakā / Baumeister-Zyklus`
- Phaistos — `Dvārakā / Baumeister-Zyklus`
- Alexandria — `Alexandria / Kalender-Roman`

Diese drei Cross-Universe-Orte bilden bewusst unterschiedliche Verbindungstypen ab: Schauplatz, Artefakt-/Erkenntnisreferenz und Wissenschafts-/Zeitgeschichte.

## Darstellung im Spiel

Die Registry ist zunächst datenorientiert und greift nicht in Build-Persistenz ein. Die UI-Integration soll anschließend auf dem bestehenden Earth-Layer erfolgen.

Für ein Landmark sind langfristig drei Informationsebenen vorgesehen:

1. **NOXIA** — Zustand und Funktion im aktuellen Spieljahr.
2. **Historie / Gegenwart** — reale Herkunft und Entwicklung des Orts.
3. **Werkbezug** — nur bei `cross-universe`; welches Buch/Projekt den Ort verwendet und in welcher Relation.

Externe Webseiten werden immer als Übergang aus NOXIA gekennzeichnet und in einem neuen Tab/Fenster geöffnet. Der bereits vorhandene SSF-Link ist die Referenz für dieses Verhalten.

## Aufnahme weiterer Buchorte

Weitere reale Orte aus Romanen und Weltbauprojekten werden nicht automatisch kanonisiert. Vor Aufnahme werden vier Punkte geprüft:

- Ist der Ort im Werk tatsächlich relevant oder nur beiläufig erwähnt?
- Gibt es eine sinnvolle NOXIA-Funktion jenseits des Werkbezugs?
- Ist die reale/historische Aussage sauber von der fiktionalen Aussage getrennt?
- Ist der Ort präzise genug lokalisierbar, ohne spekulative Koordinaten zu erfinden?

Damit kann die Registry schrittweise wachsen, ohne die Earth-Oberfläche mit bedeutungslosen Markern zu überladen.
