# EXT-OTA-NOXIA-20260906 — Tharsis Seed Review Resolution

Quelle: `SYS:KUEPER:ota`  
Ziel: `thomaspeterkueper/noxiagame`  
Status: open  
Datum: 2026-09-06  
Bezug: `NOX-OTA-REQ-20260831-THARSIS-SEED-REVIEW-CLARIFICATIONS`

## Ergebnis

OTA hat die sechs offenen Architekturfragen aus dem NOXIA-Seed-/Layout-Review entschieden und die betroffenen Dossiers auf einen konsistenten Stand gebracht.

Aktualisierte Quellen:

- `OTA-TEC-0038-2026-DE` v0.2 — Gesamtarchitektur
- `OTA-TEC-0094-2026-DE` v1.1 — Energie
- `OTA-TEC-0096-2026-DE` v1.1 — ECLSS
- `OTA-TEC-0097-2026-DE` v1.1 — Habitat / Safe Haven
- `OTA-TEC-0100-2026-DE` v1.1 — Nahrung / Frischproduktion
- `OTA-TEC-0104-2026-DE` v1.1 — Fahrwege
- `OTA-TEC-0105-2026-DE` v1.1 — Mediennetze

## 1. Utility A/B — mediumspezifisch

Nicht jedes Medium wird als identischer Doppelring modelliert.

**Zwingend echte getrennte A/B- bzw. Cross-Feed-Pfade:**

- elektrische Energie;
- Leit-/Steuerdaten;
- Trink-/ECLSS-Nachspeisewasser;
- O2 / kritische Atemgas-Nachspeisung.

**Funktionsabhängig:** Prozesswasser und sonstige Prozessgase nur dort N-1, wo lebenserhaltend oder missionskritisch.

**Kein vollständiger Doppelbackbone zwingend:** Abwasser. Stattdessen Segmentierung, lokale Puffer, Bypass-/Notentsorgung.

**Thermik:** kein universeller kolonieweiter A/B-Wärmering. Lokale/regional getrennte Kreisläufe; kritische Lasten benötigen alternativen Wärmeabfuhrpfad oder ausreichende Pufferzeit.

NOXIA darf also mediumspezifisch validieren.

## 2. Fahrweg-N-1 vs. Medien-N-1

Die Energie-/Wasser-N-1-Forderung gehört in die Utility-Netze, **nicht** in den Road-Graphen.

Für Fahrwege gilt:

- alternative Rettungs-/Evakuierungswege zu allen Habitatclustern;
- Wartungs-/Bergungszugang zu kritischen Anlagen auch bei Sperrung eines Ring-/Korridorsegments;
- Frachtzugang darf über einen längeren Gegenweg erfolgen;
- keine Forderung, dass nach Ausfall jedes Road-Tiles jeder Cluster per Straße separat einen Energieerzeuger und ein Wasserobjekt erreichen muss.

Damit darf das bisher dominante 111-Tile-Netz deutlich vereinfacht werden, solange diese funktionalen Zugänge erhalten bleiben.

## 3. ECLSS 2-von-3

Die drei Regionalhubs versorgen normal jeweils zwei Cluster. Beim Verlust eines Hubs müssen die zwei verbleibenden Hubs **alle sechs Cluster** im degradierten Mindestbetrieb über absperrbare Cross-Feed-Verbindungen erreichen können.

Mindestfunktionen im degradierten Betrieb:

- O2-Nachspeisung;
- CO2-Abfuhr;
- Feuchtekontrolle;
- Druck-/Gasnachspeisung;
- notwendige Spurengas-/Kontaminationskontrolle.

Lokale Luftumwälzung, Druckzellen und Kontaminationsgrenzen bleiben clusterlokal. Cross-Feed bedeutet ausdrücklich **keinen kolonieweiten gemeinsamen Luftkreislauf**.

NOXIA sollte Cross-Ties/Absperrungen als echte Netz-/Objekteigenschaft modellieren.

## 4. 504 nominale Plätze vs. Safe Haven

Die 504 Plätze sind nur **nominale Wohnkapazität**: 6 × 84.

Separate Notfallregel:

- Verlust/Isolation eines Clusters;
- fünf verbleibende Cluster müssen gemeinsam alle 497 Bewohner temporär aufnehmen;
- vorläufiger OTA-Planungswert: **mindestens 100 Personen je verbleibendem Cluster** = 500 temporäre Plätze;
- Planungsdauer zunächst **bis zu 72 Stunden**;
- kein siebter regulärer Habitatcluster.

100 Personen/Cluster und 72 h sind `[F/H]`-Planungswerte und gehen zur quantitativen Prüfung an KUEPER Engineering. Für NOXIA ist die Architekturentscheidung jedoch bereits verwendbar: nominale und temporäre Notbelegung getrennt modellieren.

## 5. Pflanzenmodul

**Entscheidung: aus dem Minimum-Viable-Startbestand entfernen.**

Der Startzustand besitzt:

- 30-Tage-Vollreserve an lagerfähiger Nahrung;
- drei getrennte Lagerdomänen;
- vorbereitete Fläche/Medienanschlüsse;
- Saatgut-/Nährstoffbestand.

Das aktive Pflanzen-/Frischproduktionsmodul wird erst in **Ausbauphase 1** gebaut/in Betrieb genommen. Es ist kein überlebenskritischer Start-Buildable.

## 6. Energie-Epistemik

Bestätigt: **7–8 MW elektrische Nennleistung sind eine OTA-Weltarchitekturannahme / Designreserve `[A/F]`, kein `[R]`-Realwert.**

Auch die 6–10 MWh Kurzzeitspeicher bleiben vorläufig. Eine Bottom-up-Lastbilanz liegt noch nicht als geschlossene Engineering-Berechnung vor.

Dafür wurde an KUEPER Engineering übergeben:

`external-tasks/open/EXT-OTA-ENG-20260906-tharsis-resilience-closure.md`

NOXIA darf 7–8 MW als aktuelle Welt-/Architektursetzung verwenden, aber nicht als realwissenschaftlich gesicherten Koloniewert darstellen.

## NOXIA-Freigabe

Issue #52 bzw. die entsprechende Layout-/Seed-Korrektur kann auf dieser Grundlage weitergeführt werden. Der Engineering-Return ist für quantitative Feindimensionierung vorgesehen und blockiert die topologische/spielerische Umsetzung nicht.

Bitte bei der Umsetzung keine neuen OTA-IDs oder technischen Kanonwerte erfinden. Wenn aus der Implementierung neue Widersprüche entstehen, Rückrequest mit konkreter Objekt-/Netzreferenz an OTA.