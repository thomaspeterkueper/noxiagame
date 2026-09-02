# OTA → NOXIA Request — Scanner Vertical Slice

**ID:** OTA-NOX-REQ-20260831-scanner-vertical-slice  
**Datum:** 2026-08-31  
**Abgeschlossen:** 2026-09-01  
**Status:** done  
**Priorität:** high  
**Quelle:** Overtime Archive / KUEPER-Ökosystem  
**Ziel:** noxiagame

## Ziel

Den Scanner als ersten vollständigen, spielbaren First-Person-Vertical-Slice auf dem aktuellen `main` fertigstellen. Der Scanner darf keine zweite Simulation und keinen parallelen Discovery-Stack erzeugen. Er ist eine persönliche Sicht auf denselben kanonischen NOXIA-Zustand.

## Architektur-Invariante

```text
Ground Truth → Measurement → Interpretation → Discovery
```

Diese Kette ist die einzige fachliche Scanner-Pipeline. Rendering, First-Person-Raum und UI konsumieren sie, definieren aber keine eigene Wahrheit.

## Abnahme 2026-09-01

- [x] `Ground Truth → Measurement → Interpretation → Discovery` ist im Code nachvollziehbar getrennt.
- [x] Domänenkern ist unabhängig von Three.js und Browser-Persistenz.
- [x] Persistierte Discoveries werden beim Start des Scanner-Views geladen.
- [x] Wiederholtes Scannen ist über den persistenten Discovery-Key idempotent.
- [x] Scannerraum konsumiert denselben NOXIA-World-State; keine zweite Simulation wurde eingeführt.
- [x] `Ergebnis auf Karte anzeigen` fokussiert die kanonische Koordinate im bestehenden ColonyGrid statt eines separaten Markersystems.
- [x] Three.js bleibt Darstellung/Interaktion; fachliche Updates erzeugen keinen zweiten Simulationszustand.
- [x] Deterministische Scanner-Domänentests decken Pipeline und Idempotenz ab; Persistenzinitialisierung erfolgt vor lokalem Ergebniszustand.
- [x] Scanner-Domain-CI ist grün.
- [x] Vercel-Produktionsbuild ist grün.
- [x] Keine neue Population Engine, kein Ressourcenmodell, kein Balancing und keine harte 32×24-Annahme wurden eingeführt.

## Relevante Umsetzung

- `lib/game/scanning.ts` — kanonischer Scanner-Domänenkern.
- `lib/game/scanning.test.ts` — deterministische Pipeline-/Idempotenztests.
- `app/api/game/scanner/` — Persistenzgrenze und Scanner-API.
- `app/scanner/` / Scanner-UI — Messung, Interpretation und Discovery.
- `supabase/migrations/*scanner*` — persistenter Discovery-State.
- bestehendes `ColonyGrid` — kanonische Kartenlokalisierung.
- `.github/workflows/scanner-domain.yml` — Scanner-Domain-Test plus vollständiger Next.js-Build.

## Abschlussnotiz

Der Scanner dient ab diesem Stand als Referenzmuster für weitere persönliche First-Person-Ansichten: **eine Simulation, mehrere Sichten**. Neue Gebäude-/Fahrzeugansichten dürfen dieses Muster verwenden, aber keinen eigenen fachlichen World-State aufbauen.
