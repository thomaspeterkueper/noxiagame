# ChronoTravel Istanbul – historische Stadt als Forschungsroute

Status: research pilot (29.10.2026); Hippodrom besitzt eine begehbare schematische Szene, Hagia Sophia nun eine schematische 3D-Außenansicht mit Kamerabewegung.

## Ziel

Historische Reiseführer nicht als statische Liste, sondern als zeitlich versionierte Tour im selben räumlichen Stadtmodell: Orte, Funktionen, Gebäude, Personen, Stadtleben und historische Quellengüte. Kein Wechsel der kanonischen NOXIA-Weltzeit.

## Pilotstationen

- Hippodrom / Atmeydanı — 550, 1200, 1700; 3D-Demo vorhanden (historisch nur schematisch)
- Hagia Sophia — 550, 1200, 1700; schematische 3D-Außenansicht (keine Innenräume, kein quellengesichertes Bauaufmaß)
- Basilika-Zisterne — 550, 1200, 1700; noch keine 3D-Szene
- Topkapı-Palast — 1700; nicht in vorosmanische Epochen projizieren
- Süleymaniye — 1700; nicht in vorosmanische Epochen projizieren
- Theodosianische Mauern — 550, 1200, 1700; noch keine 3D-Szene

Jahreszahlen sind geplante Besuchs-Snapshots, keine datierten Belege für jedes Architekturdetail.

## Quellenbasis und Rechte

- https://whc.unesco.org/en/list/356/
- https://istanbul.ktb.gov.tr/EN-284696/historical-peninsula.html

Weitere Fachliteratur, historische Karten und möglichst primäre Quellen pro Bauphase erfassen. Ein privater historischer Reiseführer darf **erst mit ausdrücklicher Nutzungserlaubnis**, Namensnennung nach Vereinbarung und geklärtem Bild-/Karteneinsatz eingebunden werden. Ideen und öffentlich dokumentierte historische Tatsachen sind getrennt von urheberrechtlich geschützten Texten, Bildern und Karten.

## Roadmap

1. Stadtatlas-UI: Reiseziele und Zeitschnitte auswählen; derzeit nur Hippodrom tatsächlich öffnen.
2. Per-Place-Kanon: identische Ortsanker, Zeitintervalle, Evidenzstatus, Bau-/Abbruchereignisse, Quellenherkunft.
3. Visuelle Umgebung für Hagia Sophia / Zisterne als überprüfbare Low-Poly-Prototypen.
4. Historische Route mit Reiseleitung, optionalen Dialogen und didaktischem Unsicherheits-Layer.
5. Kuratierte Händler, Berufe, Sprachregister und Weltwissen für jeweilige Epoche.
6. Erst nach Freigabe: Live-Agentur, buchbare Touren, akademische Lernmodule.

Die Registry `lib/game/chronotravel/istanbulRoute.ts` ist eine Forschungsplanung und darf **nicht** mit betretbaren 3D-Szenen gleichgesetzt werden.

## Hagia Sophia – Zeitstände und Quellen

- **550:** Kirche nach der Weihe von 537. Die spätere Kuppelreparatur (558–562) darf nicht rückwirkend in 550 als gesichert dargestellt werden.
- **1200:** Noch byzantinische Kirche; die lateinische Eroberung folgte erst 1204. Detailausstattung nicht simulativ als gesichert ausgeben.
- **1700:** Osmanische Moschee seit 1453 mit späteren baulichen Ergänzungen. Minarette im Prototyp sind abstrahiert und nicht maßstabsgetreu.

Quellen: [Türkisches Kulturministerium](https://www.ktb.gov.tr/EN-113776/ayasofya-hagia-sophia.html), [Metropolitan Museum of Art](https://www.metmuseum.org/de/essays/hagia-sophia-532-37), [Fatih Belediye](https://www.fatih.bel.tr/en/main/pages/the-hagia-sophia-grand-mosque-ayasofya-i-kebi/578).

## Literarische Verbindungen

Hagia Sophia ist auch Schauplatz in Romanen des Autors. Dafür eine **separate Fiktionsebene** vorsehen: literarische Ereignisse, Charaktere und Resonanz-/Frequenzmotive dürfen mit historischen Orten verknüpft werden, aber nicht als wissenschaftlich belegte Eigenschaften in SSF, KG oder historische Rekonstruktion gelangen. Zunächst nur Architekturentscheidung, noch keine Romaninhalte in der UI.
