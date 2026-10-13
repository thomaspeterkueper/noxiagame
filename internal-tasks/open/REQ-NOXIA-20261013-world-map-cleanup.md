# REQ-NOXIA-20261013 – Alte Straßenstücke der Erdkarte löschen

Status: open  
Repository: noxiagame  
Scope: Earth / Prototyp „eine Welt“ (`docs/workstreams/world-map.md`)  
Priority: Normal  
Type: Internal Request  
Für: Thomas (Löschbefehle an die Datenbank kommen aus der Claude-Umgebung nicht durch)

## Beschluss (Thomas, 13.10.2026)

- Die vier Straßenstücke aus dem alten Bausystem löschen, samt ihren abgeschlossenen Bauaufträgen.
- Die leeren Ortseinträge gescheiterter Kartenabrufe **stehen lassen** – sie zeigen, welche Orte noch in die Karte gehören (siehe Aufgabe 11 in `world-map.md`).
- Alle übrigen NOXIA-Gebäude stehen lassen.
- Die zwei Wohnblöcke ohne Koordinaten: siehe unten, noch offen.

Geprüft: Auf die Straßenstücke verweist nichts (keine Kinder, Konzessionen, Bewohner, Wartung, Versorgung, Schiffe). Sicherung aller Kennungen und Koordinaten: `docs/cleanup/2026-10-13-erdkarte-altlasten.md`.

## SQL – im Supabase-SQL-Editor ausführen

```sql
begin;
delete from tile_entities
 where entity_id = 'road'
   and id in ('fdd233f9-63fb-47ec-8b5a-9d6db1f1e6de','11849775-6bf2-479b-bd64-27079ebd2b98',
              'ce2f34d6-2680-487d-89c9-6bf33348f5b5','23b880f2-b003-4f63-9705-94e81559775e');
delete from player_builds
 where buildable_id = 'road' and status = 'complete'
   and id in ('5efe1b40-c3fc-446b-9614-abed3edcd83c','e5c4f849-4690-42b8-9636-fe552bc41f3f',
              'f96295b5-bfb7-4674-8cac-18807e560052','5a7a8238-01df-4edd-8389-86b09e2b5807');
commit;

-- Prüfen: beide Werte 0
select (select count(*) from tile_entities where entity_id = 'road') as strassen,
       (select count(*) from player_builds where buildable_id = 'road') as bauauftraege;
```

## Noch offen: zwei Wohnblöcke ohne Koordinaten

| id | Konto | Bewohner |
|---|---|---|
| 8d697841-df03-44b8-9101-b7d19a82c588 | Thomas | 4 Figuren mit aktivem Zuhause („home“, Mietverhältnis „provided“), 3 davon gerade drinnen |
| afab5749-fd05-42a1-8c48-4f49b65fa234 | McKnight | keine |

Löschen macht die vier Figuren obdachlos (Zuhause und Mietverhältnis verlieren ihr Gebäude, die Anwesenheit drinnen wird gelöscht). Das berührt das Teilprojekt Bevölkerung. Erst entscheiden, ob sie vorher umziehen sollen; dann:

```sql
-- nur der leere Block (McKnight), ohne Bewohner:
delete from tile_entities where id = 'afab5749-fd05-42a1-8c48-4f49b65fa234' and entity_id = 'residential_block' and latitude_deg is null;
```

## Erledigt, wenn

Die Prüfabfrage zweimal 0 zeigt. Dann diese Datei nach `internal-tasks/done/` verschieben.
