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

- Frankfurt · Senckenberg — `YIN HUA / Senckenberg-Zyklus`
- Frankfurt · Camaleo Artlounge — kultureller Cross-Universe-Anker; bis zur kanonischen Adressauflösung nur auf Stadtebene lokalisiert
- Dvārakā / Dwarka — `Dvārakā / Baumeister-Zyklus`
- Phaistos — `Dvārakā / Baumeister-Zyklus`
- Alexandria — `Alexandria / Kalender-Roman`
- Malta · Ħal Saflieni — Resonanz-/Archäoakustik-Anker
- Istanbul · Bosporus — kompakter urbaner Werkverbund-Knoten
- Vuiteboeuf (Jura-Nord vaudois) — konkreter Book-World-Ort unterhalb von Sainte-Croix; mit historischer Jura-Querung und Verbindung zur Covatannaz-Landschaft
- Deutsche Nordseeküste — zunächst regionaler Platzhalter für das kanonische Nordsee-Dorf
- Chavín de Huántar — peruanischer Anden-/Archäologie-Anker

Diese erste Cross-Universe-Welle bildet bewusst unterschiedliche Verbindungstypen ab: Roman-Schauplatz, Kulturort, Artefakt-/Erkenntnisreferenz und Wissenschafts-/Zeitgeschichte. Frankfurt dient dabei als erster kompakter Book-World-Slice statt als generische Sehenswürdigkeiten-Sammlung.

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


## Mikroregionen

Landmarks bleiben die stabilen kanonischen Weltanker. Für Orte, die mehr als einen Marker benötigen, gibt es ergänzend kleine `EarthMicroregion`-Slices in `lib/world/spatial/earthMicroregions.ts`.

Eine Mikroregion ist ausdrücklich **keine vollständige Stadt- oder Regionssimulation**. Sie enthält nur wenige für Gameplay, Atmosphäre und Werkbezug relevante Nodes sowie ihre semantischen Verbindungen. Routing-Geometrie, Reisezeit und operative Mobilität bleiben bei den bestehenden Earth-/World-Systemen.

Erste Referenz ist **Vuiteboeuf · Covatannaz · Sainte-Croix**:

- Vuiteboeuf — Talort und Arrival Node
- Covatannaz — Landschafts-/Passage-Knoten
- Sainte-Croix — Hochort
- Vuiteboeuf ↔ Sainte-Croix — zusätzlich als Verkehrsrelation modellierbar, ohne hier Fahrplan oder Fahrzeit zu erfinden

Das Muster wird inzwischen auch für Frankfurt und Malta verwendet:

- **Frankfurt · Buchwelt** — Frankfurt Hbf als neutraler Arrival Node, Senckenberg als Forschungs-/Archivknoten und Camaleo Artlounge als Kulturknoten. Camaleo bleibt bis zur kanonischen Adressauflösung auf Stadtebene.
- **Malta · Paola / Valletta** — Paola als lokaler Arrival Node, Ħal Saflieni als Archäologie-/Konservierungsknoten und das National Museum of Archaeology in Valletta als Sammlungs-/Provenienzknoten.

Damit wird ein Book-World-Ort nicht durch möglichst viele POIs definiert, sondern durch wenige funktional und narrativ unterschiedliche Knoten.


### Kreta · Heraklion / Phaistos

Die Phaistos-Mikroregion folgt demselben Minimalprinzip:

- Heraklion — Arrival Node
- Heraklion Archaeological Museum — Sammlung, Provenienz und Forschung; dort wird die reale Phaistos-Scheibe museal überliefert
- Phaistos — archäologischer Fund-/Landschaftsknoten und MISHKENAZ-Anker

Die Relation Phaistos ↔ Museum ist ausdrücklich mehr als Verkehr: Sie repräsentiert auch Fundort ↔ Sammlung/Überlieferung. MISHKENAZ-Interpretationen werden nicht als reale archäologische Aussagen in die Present-Day-Rolle zurückgeschrieben.


### Dwarka · Küste / Unterwasserarchäologie

Die Dvārakā-Mikroregion trennt drei Ebenen, die nicht kanonisch miteinander verschmolzen werden dürfen:

- Dwarka — heutiger Küstenort und Arrival Node
- Dwarka Offshore Archaeology — Evidenzknoten für dokumentierte marine archäologische Befunde
- Bet Dwarka — separater Insel-/Archäologieknoten mit eigener Siedlungssequenz

Der Roman **Dvārakā / Baumeister-Zyklus** darf diese reale Evidenz als Forschungs- und Weltbauanker nutzen. Die NOXIA-Present-Day-Schicht behauptet daraus jedoch weder die Identität einzelner Unterwasserstrukturen mit dem literarischen Dvārakā noch eine geschlossene Rekonstruktion der versunkenen Stadt. Fundort, Datierung, Interpretation und Fiktion bleiben getrennte Ebenen.


## Kartografen-Korridor · Mittelmeer bis Atlantik

Für **Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr** ist nun der erste großräumige Earth-Korridor als Landmark-Folge angelegt:

`Kairo → Alexandria → Karthago/Tunis → Kyrene → Malta/Pantelleria → Cádiz/Andalusien`

Die Landmark-Folge ist keine kanonisierte Reiseroute und legt weder Reihenfolge einzelner Etappen noch Reisezeiten fest. Sie schafft stabile geografische Anker, aus denen später kleine Mikroregionen und historische Reisebeziehungen aufgebaut werden können.

Neue Anker:
- Kairo — Herkunft, Vermessung und Kartografie
- Karthago/Tunis — Hafen-/Küstenschichten und Station I
- Kyrene — Ruinen- und Händlerraum
- Pantelleria — Insel-/Kreuzungsknoten im zentralen Mittelmeer
- Cádiz — westlicher Hafen- und Übergangsknoten Mittelmeer/Atlantik

Alexandria und Malta waren bereits im Registry-Bestand und werden in denselben Korridor eingebunden.


## Weitere Romanwelt-Anker

Die nächste Landmark-Welle erweitert den Earth-Registry um mehrere bereits kanonisch belegte Romanräume:

- **Seoul** — Herkunftsanker für Hana in *NALGAE – Zwischen den Welten*
- **Frankfurt-Sachsenhausen** — WG-/Alltagsraum von Hana
- **Städel Museum** — realer Kulturanker des Städel-/Margarethe-Strangs
- **Hamburg-Altona** — WG-/Lebensraum für *TRAILERS* und erster Hamburger Stadtanker für *OTJIZE*
- **Menden / Hexenteich** — Ortsanker für *Die Kette vom Hexenteich*

Beim Hexenteich bleibt der Locator absichtlich auf Menden-Ebene, bis eine belastbare kanonische Georeferenz vorliegt. Die Registry darf aus einem literarischen Ortsnamen keine vermeintlich reale Straßen- oder Gewässeradresse ableiten.
