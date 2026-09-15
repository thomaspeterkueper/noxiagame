# ADR: NPCs teilen das Kausalmodell der Spieler

**Datum:** 20.07.2026  
**Klarstellung:** 15.09.2026  
**Status:** Accepted  
**Gilt für:** noxiagame, alle zukünftigen NOXIA-Features

## Entscheidung

NPCs sind **keine Spieler**. Ein Spieler ist ein realer menschlicher Nutzer mit authentifiziertem Account/Profile. NPCs sind simulierte Personen oder Organisationen innerhalb der NOXIA-Welt.

Die ursprüngliche Formulierung „NPCs sind Spieler mit Algorithmus“ beschreibt ausschließlich eine **Gameplay-Symmetrie**: NPC-Wirtschaftsakteure sollen, soweit fachlich passend, im selben Kausalmodell wie menschliche Spieler handeln und dieselben Welt- und Wirtschaftsregeln respektieren. Daraus folgt weder Identitätsgleichheit noch ein künstliches `profile_id` für NPCs.

## Kanonische Begriffe

| Begriff | Bedeutung | Persistenz heute |
|---|---|---|
| Spieler | realer menschlicher Nutzer / Account | `auth.users` + `profiles` |
| Person | natürliche Person in der simulierten Welt | `people` |
| NPC-Person | simulierte natürliche Person; kein Spielerprofil erforderlich | `people` |
| Actor | wirtschaftlich/organisatorisch handelnde Weltinstanz | `actors` |
| NPC-Firma | algorithmisch handelnde Organisation | `actors.kind = 'npc_firm'` |
| Rolle/Zuweisung | Beziehung einer Person zu Arbeit, Ort oder Organisation | `person_assignments` |

`people` und `actors` sind absichtlich nicht dasselbe. Die Living-Population-Architektur trennt natürliche Personen von Firmenakteuren. Ein Mensch in der Welt kann für einen Actor arbeiten, ohne selbst dieser Actor zu sein.

## Gameplay-Symmetrie

| Aspekt | Menschlicher Spieler | NPC-Firma |
|---|---|---|
| Account/Profile | erforderlich | keines |
| `tile_entities.profile_id` | UUID des Spielers | `null` |
| `tile_entities.actor_id` | normalerweise `null` | UUID des Actors |
| Wirtschaftsregeln | Core-Regeln | dieselben Core-Regeln, soweit die Domäne sie unterstützt |
| Entscheidung | menschliche Eingabe | Simulations-/Entscheidungslogik |
| Weltpräsenz | sichtbar | sichtbar |

NPCs dürfen deshalb nicht dadurch „spielerähnlich“ gemacht werden, dass ein Dummy-Account oder Dummy-Profil erzeugt wird. Umgekehrt darf `actor_id` nicht als Authentifizierungsidentität interpretiert werden.

## Berechtigungsgrenze

Ein Actor kann Eigentümer oder wirtschaftlicher Auftraggeber sein. Das bedeutet nicht automatisch, dass irgendein Spieler im Namen dieses Actors handeln darf.

Heute vorhandene Beziehungen wie `person_assignments.employer_actor_id` drücken Beschäftigung/Zuweisung aus, **keine universelle Vertretungs- oder Administrationsvollmacht**. Ebenso sind Eigentum, Beschäftigung, Crew-Mitgliedschaft, Governor-Status und Authentifizierung voneinander getrennte Beziehungen.

Wenn NOXIA später Unternehmen, SSF/KG, Kolonien oder andere Organisationen mit delegierten Spielerrechten benötigt, muss dafür eine explizite Mitgliedschafts-/Rollen-/Berechtigungsbeziehung eingeführt werden. Sie darf nicht aus `founded_by`, Gebäudeeigentum, Beschäftigung oder bloßer Zugehörigkeit abgeleitet werden.

## Konsequenzen

- NPCs sind keine Spieler und benötigen kein `profile_id`.
- NPC-Personen leben in `people`; NPC-Firmen/Organisationen leben in `actors`.
- Spieleridentität und Weltidentität bleiben getrennt.
- Wirtschaftliche Symmetrie bedeutet gemeinsame Regeln, nicht gemeinsames Identitätsschema.
- `npcBrain.ts` darf NPC-Aktionen erzeugen, muss aber dieselben fachlichen Grenzen respektieren wie entsprechende Spieleraktionen.
- Kein Mechanismus darf `actor_id` als Ersatz für `auth.uid()` verwenden.
- Keine Rolle darf allein aus Eigentum, Beschäftigung oder Standort abgeleitet werden.

## Aktive NPC-Wirtschaftsakteure (Alpha)

Die bestehenden Actor-Seeds wie Goibniu, Belenus und Boann bleiben NPC-Firmen. Sie sind keine Spieleraccounts.

## Verwandte ADRs

- `NOXIA-LIVING-0001-living-population-v0.1.md`
- `ADR-terrain-vs-entity.md`
- `ADR-progressive-disclosure.md`
- `docs/core/OWNERSHIP_CUSTODY_USAGE_MAP.md`
