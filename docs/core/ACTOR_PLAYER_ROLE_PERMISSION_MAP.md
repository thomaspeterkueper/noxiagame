# NOXIA Core — Actor / Player / Person / Role / Permission Map

Stand: 15.09.2026

## Core-Regel

`player identity != person != actor != ownership != membership != role != permission`

NOXIA darf diese Dimensionen nicht implizit ineinander umdeuten.

## 1. Spieleridentität

Ein Spieler ist ein realer menschlicher Nutzer. `auth.users.id` und das zugehörige `profiles.id` bilden die heutige authentifizierte Spieleridentität.

Eine Weltinstanz benötigt nicht automatisch ein Spielerprofil. Insbesondere dürfen NPCs, NPC-Personen und NPC-Organisationen keine Dummy-Profile erhalten, nur damit bestehende Spielerpfade wiederverwendet werden können.

## 2. Personen

`people` repräsentiert natürliche Personen in der simulierten Welt. Die Living-Population-Migration trennt diese ausdrücklich von Firmenakteuren.

Eine Person kann NPC sein, ohne Spieler zu sein. `person_assignments` beschreibt Wohnen, Arbeit und temporäre Zuweisung. `employer_actor_id` verbindet eine arbeitende Person mit einem Actor; `role_code` beschreibt die Arbeitsrolle.

Diese Beziehung ist keine Authentifizierung und keine allgemeine Vollmacht.

## 3. Actors

`actors` repräsentiert heute insbesondere algorithmisch handelnde Firmenakteure. `kind`, `decision_weights`, `personality` und das NPC-Ledger gehören zu dieser Ebene.

Ein Actor kann Eigentümer von `tile_entities` sein. Das macht den Actor weder zu einer Person noch zu einem Spieleraccount.

`actors.founded_by` ist historische Herkunft/Gründung und darf nicht als dauerhafte Administrations- oder Vertretungsberechtigung interpretiert werden.

## 4. Eigentum

Eigentum bleibt der bereits dokumentierten Ownership-Custody-Usage-Grenze unterworfen.

Bei `tile_entities` existieren historische/kompatible Eigentumspfade für Spieler (`profile_id`), Actors (`actor_id`) und staatliche Objekte. Neuere `owner_class`/`owner_id`-Semantik darf diese Unterscheidung nicht in Authentifizierung umdeuten.

Eigentum allein erteilt keine universelle Betriebs-, Governor-, Crew- oder Organisationsrolle.

## 5. Governor / Kolonieverwaltung

`locations.governor_profile_id` ist heute eine explizite spielerbezogene Governance-Beziehung. Die Colony-API prüft bei steuerverändernden Aktionen die authentifizierte User-ID gegen `governor_profile_id`.

Das ist ein konkretes Berechtigungsmodell, kein Beweis für eine allgemeine Rollenarchitektur.

Gebäudeeigentum, Top-Owner-Status oder Standortanwesenheit dürfen Governor-Rechte nicht implizieren.

## 6. Beschäftigung und NPC-Rollen

`person_assignments.employer_actor_id` und `role_code` modellieren Beschäftigung/Funktion einer simulierten Person.

Beispiele: Forscher, Techniker, Pilot, Stationsleitung.

Diese Rollen dürfen Simulation und NPC-Entscheidungen beeinflussen. Sie dürfen aber nicht ohne explizite Autorisierungsbrücke als Berechtigung eines authentifizierten Spielers verwendet werden.

## 7. Organisationen und zukünftige Delegation

KG, SSF, Unternehmen, Kolonien und weitere Organisationen werden langfristig echte Mitgliedschaften und delegierte Rechte benötigen.

Der aktuelle Stand besitzt noch keine hinreichend allgemeine Membership-/Role-/Permission-Struktur. Deshalb wird jetzt **keine** universelle Tabelle erfunden.

Wenn mindestens zwei konkrete Domänen dieselbe delegierte Beziehung benötigen, soll ein gemeinsamer Core-Vertrag eingeführt werden, z. B. für:

- Mitgliedschaft eines Spielers oder einer Weltperson in einer Organisation;
- zeitlich begrenzte Rollen;
- explizite Capabilities wie `manage_inventory`, `dispatch_vehicle`, `set_tax`, `manage_station`;
- Delegation und Widerruf;
- Auditierbarkeit der Autorisierungsentscheidung.

Bis dahin bleiben vorhandene konkrete Berechtigungen explizit und fail-closed.

## 8. NPCs und Spieler

Die historische ADR-Formulierung „NPCs sind Spieler mit Algorithmus“ bedeutet nur Gameplay-Symmetrie.

Kanonisch gilt:

- NPCs sind **keine Spieler**.
- NPC-Firmen sind Actors.
- NPC-Personen sind People.
- NPCs sollen soweit fachlich passend denselben Welt- und Wirtschaftsregeln unterliegen wie Spieler.
- Gemeinsame Regeln rechtfertigen keine gemeinsame Authentifizierungsidentität.

## 9. Erforderliche Invarianten

1. `profiles.id` bleibt Spieler-/Accountidentität und darf nicht für NPC-Dummyaccounts verwendet werden.
2. `people` bleibt von `actors` getrennt.
3. `person_assignments.employer_actor_id` ist Beschäftigung, keine Eigentums- oder Authentifizierungsbeziehung.
4. `person_assignments.role_code` ist keine universelle Spielerberechtigung.
5. Actor-Eigentum an einem Objekt erzeugt kein `profile_id`.
6. Spieler-Eigentum erzeugt keinen `actor_id`.
7. `actors.founded_by` ist keine implizite aktuelle Vertretungsvollmacht.
8. Governor-Rechte werden aus der expliziten Governor-Beziehung geprüft, nicht aus Gebäudeeigentum.
9. Service-Role-Nutzung in APIs darf Authentifizierung/Autorisierung nicht ersetzen.
10. NPC-Wirtschaft darf dieselben fachlichen Regeln nutzen, ohne NPCs als Spieler zu modellieren.
11. Crew, Beschäftigung, Eigentum, Governor, Custody und Standort bleiben getrennte Beziehungen.
12. Zukünftige Organisationsrechte müssen explizit, widerrufbar und fail-closed sein.

## 10. Nicht jetzt einführen

Noch nicht gerechtfertigt sind:

- ein universeller `actor_memberships`-Umbau aller bestehenden Systeme;
- ein generisches RBAC-Schema ohne konkrete Consumer;
- automatische Migration von `profiles` in `actors`;
- automatische Umwandlung aller `people` in `actors`;
- Ableitung von Berechtigungen aus Eigentum oder Beschäftigung.

Der nächste Schema-Schritt soll erst aus einem konkreten organisationsübergreifenden Gameplay-Bedarf entstehen.
