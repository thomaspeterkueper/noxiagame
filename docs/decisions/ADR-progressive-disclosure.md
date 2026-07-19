# ADR: Progressive Disclosure — Features sichtbar aber gesperrt

**Datum:** 19.07.2026
**Status:** Accepted

## Kontext

Beim Design von Feature-Gates gibt es zwei Ansätze:
1. **Verstecken** — Feature ist unsichtbar bis Voraussetzung erfüllt
2. **Sperren** — Feature ist sichtbar aber gesperrt mit klarer Voraussetzung

NOXIA wählt bewusst **Ansatz 2: Progressive Disclosure**.

## Entscheidung

Features die durch Lernmodule freigeschaltet werden sind **immer sichtbar**,
aber mit einem 🔒-Symbol und klarer Voraussetzung versehen.

### Warum:
- Leere Interfaces verwirren → Spieler weiß nicht was möglich ist
- Gesperrte Features spornen an → "Das will ich freischalten"
- Klare Voraussetzung → direkter Weg in die Akademie
- Konsistent mit NOXIA-Prinzip: Kausalität sichtbar machen

### Implementierung:

```tsx
// ✅ RICHTIG: Tab immer anzeigen, gesperrt mit Hinweis
{(['konto', 'einlage', 'kredit'] as Tab[]).map(t => (
  <button>
    {!hasUnlock('bank-credit') && t === 'kredit' ? '🔒 Kredit' : 'Kredit'}
  </button>
))}

// Gate-Screen beim Klick:
{tab === 'kredit' && !hasUnlock('bank-credit') && (
  <GateScreen
    title="Kredit nicht freigeschaltet"
    requirement="ECO-L0-0001 — Was ist ein Kredit?"
    path="Akademie → Module"
  />
)}

// ❌ FALSCH: Feature verstecken
{hasUnlock('bank-credit') && <KreditTab />}
```

### Gate-Screen Inhalt:
1. 🔒 Icon (groß, zentriert)
2. Feature-Name: "X nicht freigeschaltet"
3. Voraussetzung: Modul-ID + Titel
4. Pfad: "Dashboard → Akademie → Module"

### Ausnahmen:
- **Sicherheitskritische Features** (Admin-Funktionen) → verstecken
- **Noch nicht implementierte Features** (Planung) → verstecken bis Alpha-ready

## Konsequenzen

- Alle zukünftigen Gate-Features folgen diesem Pattern
- `lib/knowledge/unlocks.ts` liefert die Gate-Checks
- BankOverlay ist die Referenz-Implementierung (v1.6.0)

## Geplante Gates

| Feature | Unlock-Key | Voraussetzung |
|---------|-----------|---------------|
| Bank-Kredit | `UNL:NOX:bank-credit` | ECO-L0-0001 |
| Spektral-Sensor | `UNL:NOX:SENSOR:SPECTRAL` | PHY-L1-000001 |
| Orbitale Navigation | `UNL:NOX:NAV:ORBITAL` | AST-L1-000001 |
| Phasendiagramm | `UNL:NOX:PHY:PHASE-DIAGRAM` | PHY-L1-000004 |
| Beobachtungsdeck | `UNL:NOX:MISSION:OBSERVATION-DECK` | PHY-L1-000002 |
