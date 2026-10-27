# NOXIA-SCHOOL-0001 – Grundschule als Lernort für Grundlagen, Handwerk und Alltag

Status: accepted (Entscheidungen Thomas 27.10.2026; Punkt 1 nach Empfehlung)
Datum: 2026-10-27
Anlass: Thomas hat auf der Erdkarte in Sundern die reale Grundschule gefunden – sie ist heute nur ein Punkt ohne Funktion.
Bezug: NOXIA-INTERIOR-0001 (ein Bedienmodell für alle Gebäude), NOXIA-LIVING-0001 (Kompetenzen als `skill_code + level + experience`), NOXIA-LIVING-0010 (Stellenmarkt prüft Qualifikation), NOXIA-LIVING-0012 (Hunger und Durst), NOXIA-OMNI-0001 (Spielraum als Maß), ADR-sundog-prinzip, `docs/SSF-INTEGRATION.md`, `docs/Spec-gebaeude-katalog.md` (keine leeren Hülsen)

## Ausgangslage (Code, Stand 840755e)

- `amenity=school|kindergarten` kommt über `enrichEarthLocalScene()` nur als POI (`visual_class='school'`) auf die Karte. `materializeEarthPlace()` klassifiziert Schulen nicht, `establishmentKind()` kennt sie nicht, `EarthWalkableSurface.namedPoiTargets` gibt ihnen keinen Raum – „Betreten“ führt ins Leere.
- `buildingOffer.notForSaleReason()` führt Schulen korrekt als öffentlich, nicht kaufbar.
- Die einzige Erdschule ist ein Seed (`tile_entities`, `entity_id='school'`, Selmecke), seit `20261027051000` mit Amara Ndlovu (`educator`) als Personal.
- Im Gebäudekatalog existiert `basic_school` („Schule“), wird aber nirgends verwendet.
- Lernen erzeugt heute nur Wissenspunkte und `player_unlocks`. `person_skills` wird nur geseedet und gelesen, nie erhöht. Spieler haben gar keine Kompetenzen.
- `learn`, `teach`, `research`, `practice` fehlen im `INTERIOR_CAPABILITY_REGISTRY`.
- Öffentliche Arbeitgeber, Lehrerlohn (`role_wage_rates`, educator) und Steuerfinanzierung über `sync_employer_economy` sind vorhanden.

## Leitgedanke

Die Akademie lehrt Wissen über das Sonnensystem. Die Grundschule lehrt, was man zum Leben braucht – Lesen, Schreiben, Rechnen, Sprachen, aber genauso Kochen, Reparieren, Gärtnern, mit Geld umgehen, Erste Hilfe. Lernen ist hier überwiegend **Tun**, nicht Quiz. Wer es kann, hat mehr Spielraum: bessere Stellen, eigene Versorgung, weniger Abhängigkeit. Wer es nicht übt, verlernt es langsam – Werden statt Besitz.

## Vorschlag

### 1. Keine neue Mechanik – die fünfte Einrichtung

Die Grundschule ist eine `InteriorFitting` auf `WalkableInterior`, wie Lokal, Akademie, Verwaltung, Raumhafen. Gleiche Bewegung, gleiche rechte Tafel, gleiches Gespräch, gleiches Angebot als Kacheln. Neu sind nur Grundriss, Wissen der Figuren und Angebot.

Grundriss (`VenueLayout`, Vorlage `basic_school`):

| Raum | Bedienplatz | Funktion | Capability |
|---|---|---|---|
| Sekretariat / Eingang | Sekretariat | Anmeldung, Stundenplan, Aushang | – |
| Klassenzimmer | Lehrerpult | Grundlagen: Lesen, Schreiben, Rechnen, Sprachen | `learn`, `teach` |
| Werkraum | Werkbank der Lehrkraft | Handwerk: Holz, Metall, einfache Elektrik, Reparatur | `practice` |
| Schulküche | Herd der Lehrkraft | Alltag: Kochen, Vorrat, Hygiene | `practice` |
| Schulgarten | – (draußen) | Anbau, Wasser, Jahreszeiten | `practice` |
| Pausenhof | – | Begegnung, Spiel; Kinder-NPCs treffen sich | – |

### 2. Drei Lernwege, ein Ergebnis

| Lernweg | Wie gelernt wird | Quelle des Inhalts |
|---|---|---|
| **Grundlagen** | SSF-Modul lesen, Aufgaben lösen (bestehendes `SchoolOverlay`) | SSF / Knowledge Graph, L0-Module |
| **Handwerk** | Übungsaufgabe mit echtem Material: Stuhl reparieren, Kabel verbinden, Regal bauen | Übungsrezept (Daten), fachlich aus SSF/KG |
| **Alltag** | Übung mit echten Gütern: Suppe kochen, Beete bestellen, Einkauf planen | Übungsrezept (Daten), fachlich aus SSF/KG |

Alle drei schreiben dasselbe Ergebnis: Erfahrung auf einen `skill_code`. Inhalte werden nicht in noxiagame erfunden (Regel aus NOX-0007) – noxiagame definiert nur, **wie** geübt wird und welche Kompetenz es bewegt.

### 3. Üben mit echten Folgen (SunDog-Prinzip)

- Eine Übung verbraucht echte Güter aus dem Schulvorrat (Mehl, Gemüse, Holz, Schrauben). Ohne Vorrat keine Übung – der Vorrat muss gekauft oder im Schulgarten erzeugt werden.
- Das Ergebnis ist ein echtes Ding: Die gekochte Suppe senkt Hunger (NOXIA-LIVING-0012), das reparierte Möbel gehört dem, der es mitgebracht hat, das Gemüse geht in die Schulküche.
- Eine Übung dauert Spielzeit: eine Schulstunde = 45 Spielminuten, bei 60× also 45 Sekunden. Der Spieler sieht den Fortschritt im Raum (Icons der Dinge, nicht nur Text).
- Misslingen ist möglich und abhängig von der Kompetenz – angebrannte Suppe ist auch eine Erfahrung (weniger Erfahrung, Material weg).

### 4. Kompetenzen für Personen und Spieler

- Personen (NPCs): `person_skills` wird endlich beschrieben – durch Schule **und** durch Arbeit (Learning by Doing, wie in sepc_solarAcademy beabsichtigt).
- Spieler: braucht eine eigene Ablage mit demselben `skill_code`-Vokabular (Vorschlag `profile_skills`, gleiches Schema). Kein Dummy-`people`-Eintrag für Spieler (ADR-npcs-sind-spieler).
- Verblassen: Ungeübte Kompetenz sinkt langsam bis zu einem Sockel (was man einmal gut konnte, ist nie ganz weg) – dasselbe Muster wie verblassende Beziehungen.
- Startvokabular (Vorschlag, je Code eine Familie): `literacy`, `numeracy`, `language_<iso>`, `craft_wood`, `craft_metal`, `craft_electric`, `repair`, `cooking`, `gardening`, `household_finance`, `first_aid`. Die bestehenden Codes (`medicine`, `triage`, …) bleiben.

### 5. Nachweise statt Punkte

Eine abgeschlossene Lerneinheit erzeugt eine **Bescheinigung** (Ausstellerin = die Schule als öffentlicher Akteur, Datum, Kompetenz, Stufe). Der Stellenmarkt (`employerDecision`) darf sie als Qualifikationsnachweis lesen. Kompetenz ohne Bescheinigung zählt trotzdem bei der Arbeit selbst – der Nachweis öffnet nur Türen.

### 6. Personal, Öffnung, Geld

- Anleiten kann jede Person mit hoher Kompetenz (Schwelle je `skill_code`), nicht nur eine Lehrkraft. Wer gut kocht, darf in der Küche anleiten – Spieler wie NPC. Das hält Werkraum und Küche auch dort offen, wo es kein Schulpersonal gibt.
- Unterrichten ist eine eigene Tätigkeit, die Spieler wählen können (Thomas, 27.10.: „es gibt viele, die gerne unterrichten“). Wer anleitet, sieht im Raum, wer gerade übt, kann eine Übung für andere öffnen und bekommt selbst Erfahrung. Über die Zeit entsteht eine Anleiter-Bescheinigung je Kompetenz – Anerkennung, die der Stellenmarkt lesen kann. Ein Anteil der Pauschale je Lernendem kann an Anleitende gehen, die keine angestellte Lehrkraft sind; Lernen bleibt für die Lernenden kostenlos.
- Personal: Lehrkräfte = `person_assignments` (`role_code='educator'`) am Schulgebäude, Arbeitgeber der öffentliche Akteur des Ortes, Lohn aus `role_wage_rates`, finanziert über Steuern – keine Geldschöpfung.
- Öffnung: Schulzeiten werktags morgens bis früher Nachmittag (Ortszeit). Ohne Lehrkraft: Klassenzimmer im Selbstlernbetrieb (Module ja, Prüfung ja), **Werkraum und Küche geschlossen** (Sicherheit) – analog zur Regel „Café ohne Personal ist geschlossen“.
- Lernen ist in noxia immer kostenlos – für Kinder, Erwachsene, NPCs und Spieler. Keine Gebühren.
- Finanzierung je Lernendem: Der Staat (öffentlicher Akteur des Ortes) zahlt der Schule je aktiv Lernendem eine Pauschale pro Spieltag; daraus kommen Lehrerlohn und Material. Geld aus echtem Budget (Steuern), keine Geldschöpfung.
- Ohne Lernende verfällt die Schule: Sinkt die Zahl der Lernenden über einen Zeitraum unter eine Schwelle, wird zuerst Personal abgebaut, dann schließt die Schule. Das reale Gebäude bleibt stehen (öffentlich, leer); es kann später wieder öffnen, wenn wieder gelernt wird.
- Kinder-NPCs aus `social_life_families` haben die Schule als Tagesziel im Tagesrhythmus (NOXIA-LIVING-0007); ihre Kompetenzen wachsen sichtbar über die Jahre.

### 7. Einstieg ins Spiel

Wie jedes Gebäude gibt die Schule einen Einstieg: Das Sekretariat führt Neue ein („Du kannst kochen? Dann melde dich in der Küche – sonst lernst du es hier.“). Die Schule ist damit der natürliche erste Ort für Spieler, die noch nichts können – vor Akademie und Raumhafen.

### 8. Andere Planeten und Stationen

Schulen gibt es überall – Erde, Mond, Mars, Stationen. Dort sind sie baubar (`basic_school`) und haben wenig oder gar kein echtes Personal. Grundlagen laufen im Selbstlernbetrieb über die SSF-Module; Handwerk und Alltag öffnen, sobald eine kompetente Person anleitet (Punkt 6). Die Finanzierung je Lernendem gilt gleich, über das Budget der Kolonie.

### 9. Namen

Reale Schulen behalten erstmal ihren realen Namen aus OSM.

## Zuständigkeiten (Requests statt selbst bauen)

| Bereich | Request |
|---|---|
| Erde | `coordination/open/20261027-0510-core-to-earth-real-schools-as-public-buildings.md` |
| Innenräume | `coordination/open/20261027-0511-core-to-interiors-school-fitting.md` |
| Core | `coordination/open/20261027-0512-core-to-core-skills-practice-certificates.md` |
| Knowledge Graph / SSF (extern) | `coordination/open/20261027-0513-core-to-kg-grundschule-l0-inhalte.md` |

Reihenfolge: Core (Kompetenzen, Übungsmodell) und Erde (Schule wird Gebäude) parallel, dann Innenräume. Grundlagen funktionieren sofort mit den vorhandenen SSF-Modulen; Handwerk und Alltag warten auf Inhalte.

## Entscheidungen (Thomas, 27.10.2026)

1. Spieler-Kompetenzen: eigene Tabelle `profile_skills` mit demselben Schema und Vokabular wie `person_skills`, beide über dieselbe Funktion beschrieben (Empfehlung; folgt ADR-npcs-sind-spieler: Spieler und Personen sind getrennt, die Regeln sind gleich).
2. Ungeübte Kompetenzen verblassen langsam bis zu einem Sockel – ja.
3. Keine Gebühren – Lernen ist in noxia immer kostenlos. Finanzierung indirekt durch den Staat je Lernendem; Schulen ohne Lernende verfallen.
4. Schulen gelten auch auf anderen Planeten und Stationen, mit weniger oder ohne echtes Personal.
5. Reale Namen bleiben erstmal.
