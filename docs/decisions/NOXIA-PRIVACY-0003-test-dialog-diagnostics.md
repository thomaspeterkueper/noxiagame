# NOXIA-PRIVACY-0003 · Rohdialoge während der Testphase

> **Abgelöst** durch [NOXIA-PRIVACY-0004](NOXIA-PRIVACY-0004-auswertung-ohne-mitlesen.md) (05.11.2026): Keine Rohtext-Ansicht mehr im Adminbereich.

**Stand:** 2026-11-05  
**Entscheidung:** Keine separate Opt-in-Abfrage für NPC-Gesprächsdiagnostik. Stattdessen klare, jederzeit sichtbare Information VOR der Eingabe.  
**Status:** Datenschutz- und Freigabeprüfung vor Aktivierung der Administrator-Transkriptansicht erforderlich.

## Zweck und Erwartung

Der geschlossene NOXIAGAME-Test soll spontanes, teils absichtlich absurdes, widersprüchliches oder grenztestendes Verhalten sichtbar machen. Eine freiwillige Inhaltsfreigabe pro Gespräch erzeugt Selektionsverzerrung. Bereits heute führt die Spiel-API technische Gesprächslogs. Die neue Administratoroberfläche darf nur ab einem expliziten Stichtag wörtliche Dialoge anzeigen; bestehende historische Logs werden **nicht rückwirkend** geöffnet.

## Entwurf der Interessenabwägung (keine abschließende Rechtsprüfung)

Mögliche Rechtsgrundlage: Artikel 6 Absatz 1 Buchstabe f DSGVO **nur falls nach dokumentierter Prüfung tragfähig**.

1. **Interesse:** Reproduzierbare Fehlersuche, Korrektur von NPC-Antworten, Evaluation von Weltaktionen und Modellen im Testbetrieb.
2. **Erforderlichkeit:** Rohdialoge können für Konversationsfehler (beispielsweise Fehlinterpretation, Kontextverlust, Verweigerung und Halluzination) wichtig sein. Für allgemeine Metriken reichen oft aggregierte Daten. Der Zugriff auf Rohtexte ist daher besonders zu beschränken.
3. **Abwägung:** Gesprächsinhalte können reale private Angaben einschließlich besonderer Kategorien personenbezogener Daten enthalten. Erwartbarkeit durch einen sichtbaren Hinweis reduziert, beseitigt aber nicht die Eingriffsintensität. Minderjährige und Gesundheitsdaten brauchen zusätzliche Beachtung. Für Informationen besonderer Kategorien nach Artikel 9 bedarf es einer geeigneten weiteren Ausnahme oder eines wirksamen Filter-/Ausschlusskonzepts.

**Vor Aktivierung** müssen Betreiber/Datenschutzverantwortliche die konkrete Abwägung, Rechtsgrundlage, Aufbewahrungsgrenze, Lösch- und Widerspruchsverfahren und vollständige Datenschutzhinweise einschließlich Verantwortlichenkontakt festlegen und prüfen. Die Basis ist nicht automatisch wegen eines „Testmodus“ gegeben.

Quellen:
- EDPB Guidelines 1/2024, Article 6(1)(f): https://www.edpb.europa.eu/documents/guideline/guidelines-12024-on-processing-of-personal-data-based-on-article-61f-gdpr_en
- EU Commission, legal grounds: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en

## Technische Umsetzung

- `app/testbetrieb` gibt den Hinweis.
- Dashboard-Hinweis ist sichtbar und führt zur ausführlichen Information.
- Gesprächsfenster weisen vor der Texteingabe auf Protokollierung hin.
- `/api/admin/conversation-audit` ist nur für verifizierte Mitglieder von `admin_profiles` erreichbar.
- Admin-API ist **fail-closed** solange `NOXIA_TEST_TRANSCRIPT_REVIEW_SINCE` fehlt oder ungültig ist.
- Bei Freigabe muss der Stichtag nach der tatsächlichen Veröffentlichung des Transparenzhinweises liegen, als UTC-ISO-Wert (z. B. `2026-11-05T05:00:00Z`).
- Administrator-Abrufe von Dialogzeilen werden in `admin_conversation_read_audit` geschrieben. Ein Audit-Fehler verhindert die Textauslieferung.
- `world_action`, `wish_kind`, `topic` usw. werden mit Gesprächszeilen angezeigt; eine gesonderte kausale Ereigniskette mit eindeutiger `correlation_id` bleibt offen.

## Ausstehend vor allgemeiner Freigabe

- Geeignete Rechtsgrundlage inklusive Art. 9 und Interessenabwägung dokumentieren.
- Verbindliche Speicherdauer und automatische sichere Löschung der Diagnose-Rohdaten implementieren, ohne Spielgedächtnis unbemerkt zu beschädigen.
- Minderjährige/ausdrücklich vertrauliche Inhalte besonders schützen.
- Zugriffsrollen gegenüber genereller `admin_profiles`-Berechtigung weiter einschränken.
- Export, Auskunft, Löschung und Widerspruchsvorgang implementieren.
- End-to-End-Prüfung: keine Auth / regulärer Spieler => 401/403; ohne Schalter => keine Texte; mit Schalter => nur neue Zeilen, jeder Aufruf auditiert.

## Wissenschaftlicher Zweck

Testdialoge sollen nicht alleine qualitativ betrachtet werden: Ziel ist reproduzierbar zu sehen, welche Aussage welches Merkmal, welchen Zustand, welche Entscheidung und welche tatsächlich gespeicherte Weltänderung auslöste, mit Versions- und Fehlerreferenzen. Diese deterministische Ursache-Wirkungs-Nachvollziehbarkeit ist ein eigener Entwicklungsschritt.
