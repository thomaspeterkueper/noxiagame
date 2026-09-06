# EXT-OTA-NOXIA-20260906 — Retroactive Generation Mars Character Entity Notices

Quelle: `SYS:KUEPER:ota`  
Ziel: `thomaspeterkueper/noxiagame`  
Status: open  
Datum: 2026-09-06  
Typ: **rückwirkender Charakter-/Discovery-Hinweis, kein automatischer Gameplay-Import**

## Anlass

Die aktuellen Generation-Mars-Biografien tragen einen expliziten NOXIA-Bezug und sollen deshalb nach der neuen Entity-Notification-Regel auch dem Spiel bekannt gemacht werden. Diese Meldung betrifft nur Existenz, kanonischen Stand und Identitätsabgleich. Sie setzt keine NPC-Mechanik, Missionen, Skills oder Balancingwerte.

## Entity Notices

| OTA | KG-Dokument-ID | Rolle für Discovery | OTA-Status | Hinweis |
| --- | --- | --- | --- | --- |
| `OTA-BIO-0035-2092-DE` — Rashid Al-Mansouri | `DOC:OTA:OTA-BIO-0035-2092-DE` | character/person | AKTIV | Kanonischer Stand 2092; ersetzt den archivierten Rashid-Stand von 2025. |
| `OTA-BIO-0036-2092-DE` — Lena Kowalski | `DOC:OTA:OTA-BIO-0036-2092-DE` | character/person | AKTIV | Kanonischer Stand 2092; älteres Profil ist archivierter Vorgänger mit überholten Angaben. |
| `OTA-BIO-0037-2092-DE` — Keiko Nakamura | `DOC:OTA:OTA-BIO-0037-2092-DE` | character/person | AKTIV | Kanonischer Stand 2092; offene Angaben bleiben ausdrücklich unbestimmt. |
| `OTA-BIO-0014-2092-DE` — Kaelen | `DOC:OTA:OTA-BIO-0014-2092-DE` | character/person/discovery | ENTWURF | Partielles Profil; Details noch nicht vollständig kanonisiert. Nicht als vollständig ausdefinierte Spielfigur behandeln. |

## Erwartete NOXIA-Triage

Bitte prüfen:

- ob die Figuren bereits als NPC, Crew, Story-Referenz oder Datenobjekt existieren;
- ob konkurrierende ältere IDs/Datensätze vorhanden sind;
- ob der aktuelle OTA-Status korrekt gespiegelt wird;
- ob `Kaelen` wegen `ENTWURF` nur als Discovery-/Placeholder-Entität geführt werden sollte;
- ob ein Implementierungsrequest für Story-/Crew-Nutzung sinnvoll ist.

## Source-of-Truth-Grenze

OTA besitzt den biografischen Kanon. NOXIA entscheidet über Gameplay-Rolle, NPC-System, Missionen, Skills, Werte und Präsentation. Archivierte Vorgängerprofile dürfen nicht als aktuelle Figurenquelle zurück in das Spiel fließen.
