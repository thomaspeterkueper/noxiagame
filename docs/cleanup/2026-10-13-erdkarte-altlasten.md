# Bereinigung 13.10.2026 – Altlasten der Erdkarte

**Status:** Straßenstücke zum Löschen vorgesehen, SQL in `internal-tasks/open/REQ-NOXIA-20261013-world-map-cleanup.md` (Löschbefehle kamen aus der Claude-Umgebung nicht durch). Die leeren Ortszeilen bleiben auf Thomas' Wunsch stehen: Sie zeigen, welche Orte noch in die Karte gehören.

Auf Thomas' Wunsch („die alten Straßen und andere jetzt sinnlose Artefakte von früher löschen"). Vorher geprüft: kein Fremdschlüssel und keine Spielzeile verweist darauf. Alle Straßenstücke gehören Thomas' Konten (Aristeas, McKnight).

## Straßenstücke aus dem alten Bausystem (`tile_entities`, `entity_id = 'road'`)

Ersetzt durch die echten Straßen aus OpenStreetMap. Je 8 × 24 m, Zustand 100, Bodenwert 360.

| id | Konto | Breite | Länge | Drehung | Bauauftrag (`player_builds`, wird mitgelöscht) |
|---|---|---|---|---|---|
| fdd233f9-63fb-47ec-8b5a-9d6db1f1e6de | Aristeas | 51.3405799224228 | 8.00103804799562 | 79 | 5efe1b40-c3fc-446b-9614-abed3edcd83c |
| 11849775-6bf2-479b-bd64-27079ebd2b98 | Aristeas | 51.3406373419095 | 8.0014301354106 | 76 | e5c4f849-4690-42b8-9636-fe552bc41f3f |
| ce2f34d6-2680-487d-89c9-6bf33348f5b5 | McKnight | 51.330428683679 | 8.00737324037499 | 0 | f96295b5-bfb7-4674-8cac-18807e560052 |
| 23b880f2-b003-4f63-9705-94e81559775e | McKnight | 51.3306472108119 | 8.00737566899599 | 0 | 5a7a8238-01df-4edd-8389-86b09e2b5807 |

## Leere Ortszeilen (`celestial_regions` ohne ein einziges Kartenobjekt) – bleiben stehen

Reste gescheiterter Abrufe. Thomas (13.10.2026): Hinweise, dass diese Orte in die Karte gehören – nicht löschen, sondern nachholen.

| slug | Art | Mitte |
|---|---|---|
| earth-place-40p09232-113p29527 | gescheiterte Ortssuche (2,5 km) | 40.0923, 113.2953 |
| earth-place-49p99151-8p66670 | gescheiterte Ortssuche (2,5 km) | 49.9915, 8.6667 |
| earth-place-50p11064-8p68209 | gescheiterte Ortssuche (2,5 km) | 50.1106, 8.6821 |
| earth-place-51p33436-7p98851 | leeres Ortsdetail | 51.3344, 7.9885 |
| earth-place-51p33165-7p99235 | leeres Ortsdetail | 51.3316, 7.9923 |
| earth-place-51p33165-7p99666 | leeres Ortsdetail | 51.3316, 7.9967 |
| earth-place-51p32893-8p00050 | leeres Ortsdetail | 51.3289, 8.0005 |
| earth-place-51p32700-8p00320 | leeres Ortsdetail (Innenstadt Sundern, Abruf gescheitert) | 51.327, 8.0032 |

## Bewusst stehen gelassen

- Alle übrigen NOXIA-Gebäude auf der Erde (Raumhafen Selmecke, Café, Bauten in Peru, Namibia, Tunesien usw.) – Spielstand, keine Altlast.
- Zwei `residential_block` ohne Koordinaten (Thomas, McKnight) – werden gelöscht, nachdem die vier Bewohner in McKnights Wohnblock in Sundern umgezogen sind (SQL im Request).
- Ältere Ortsdetail-Zeilen mit 340 m Radius – die begehbare Erdszene nutzt sie; doppelte Objekte zählt die Karte nur einmal.
- Die Region `earth-place-51p32983-8p00726` (Quelle „materialization-failed", aber mit 643 Objekten) – enthält brauchbare Daten.
