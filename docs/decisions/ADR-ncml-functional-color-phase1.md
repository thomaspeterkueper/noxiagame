# ADR: NCML-Funktionsfarbe für Gebäude-Assets (Phase 1)

**Status:** angenommen · **Datum:** 24.09.2026
**Zugehöriger Request:** `external-tasks/open/EXT-NOXIA-UNIVERSE-20260924-chromatic-renaissance-game-integration.md`
**Kanonquelle:** `thomaspeterkueper/noxia-universe/canon/NXU-CHROMATIC-RENAISSANCE.md`

## Kontext

Der Kanon beschreibt Farbe nicht als Dekoration, sondern entlang der Kette
`Physical Material → Optical Properties → Functional Color → Operational
State → Cultural Treatment → Representation` (NCML). Explizit genannt:
frühe Mondinfrastruktur bleibt materiell noch stark weiß/metallisch/
isolierend — eine durchgängig bunte Palette wäre für Shackleton kanonisch
falsch.

## Entscheidung (Phase 1 — Funktionsakzente statt Vollfarbe)

- **Hülle** der Gebäude bleibt hell/metallisch (bestehende Assets
  unverändert in Form und Grundfarbe).
- **Funktionale Akzente** (kleine Statuslicht-/Detail-Elemente) bekommen
  eine je Funktion feste, unterscheidbare Farbe statt der bisherigen
  einheitlichen Gold-Warnfarbe:
  - Rohstoffgewinnung (Mine): kupfern-warm `#e08a3c`
  - Wasser-/Eisgewinnung (Eisbohrer): cyan-blau `#7fd4f0` (bestand bereits)
  - Kommunikation/Sensorik (Scanner): violett `#b478e0`
  - Raumhafen-Landepad/-Kern: bleibt Gold/Warngelb (etablierte
    Landung-/Beacon-Konvention, absichtlich unverändert)
- **Form bleibt die primäre Unterscheidung**, Farbe ist zusätzliche,
  redundante Information (Kanon-Vorgabe: sicherheitsrelevante Information
  nie ausschließlich über Farbe).
- Betriebszustands-Modulation (heller/dunkler je nach Auslastung) ist
  **nicht** Teil dieser Phase — vorbereitet, aber noch nicht umgesetzt.

## Nicht Teil dieser Entscheidung

- Keine feste globale RGB-Palette (Kanon-Vorgabe: NCML ist kein starres
  Farbschema, sondern eine Begründungskette).
- Keine Vollfarbigkeit der Gebäudehüllen für die frühe Mondkolonie.
- Kulturelle/organisationsspezifische Farbtraditionen (spätere Phase).

## Betroffene Dateien

- `public/assets/buildings/mine/moon/style-anchor.svg`
- `public/assets/buildings/ice_drill/moon/style-anchor.svg`
- `public/assets/buildings/scanner/earth/style-anchor.svg` (standortübergreifend genutzt)
