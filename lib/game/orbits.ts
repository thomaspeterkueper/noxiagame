// orbits.ts
// Aktualisiert: 20.06.2026 — Orbital-Schicht deterministisch
// Version:      0.2.0
// lib/game/orbits.ts
// Erstellt:     15.06.2026
// Aktualisiert: 20.06.2026
//
// Orbital-Schicht (Schicht 2) — REINE FUNKTIONEN, kein DB-Zugriff, kein Zufall,
// kein Date.now. Position eines Orts ist eine deterministische Funktion der
// verstrichenen Zeit (Ticks): θ(t) = phase₀ + 2π·(t/Periode). Nie gespeichert,
// immer frisch berechnet — exakt das Invariant „Basis + verstrichene Zeit".
//
// 3D-bereit: position() liefert von Anfang an {x,y,z}. Bei incl=0 (Default) ist
// z überall 0 → reines 2D. Der Sprung auf echte 3D-Bahnen ist später rein
// additiv (incl/node ≠ 0 setzen) — keine Aufrufer-Änderung, kein Rewrite.
//
// Skala ist BEWUSST arcadig: Spieleinheiten, keine km. Nur die VERHÄLTNISSE
// zählen. SEC_PER_UNIT + MIN/MAX halten die Reisezeiten kurz (15-Minuten-Regel):
// Mond↔Mars schwankt ~25–50s, kurze Hops (Mars↔Phobos, Erde↔Prometheus) liegen
// nahe der Untergrenze.
//
// Generisch über String-Slugs gehalten (nicht die geschlossene LocationSlug-
// Union), damit spätere Stationen/Planeten/Belt nur Daten hinzufügen.
//
// Lagrange-Physik:
//   L4/L5 eines Zweikörpersystems (Sonne + Planet) liegen exakt 60° vor bzw.
//   hinter dem Planeten auf derselben Bahn. Für das arcadige Modell: gleicher
//   Radius und gleiche Periode wie die Erde, phase = ±π/3.
//   L5 (60° HINTER Erde): phase_erde − π/3. Da earth.phase = 0: phase = −π/3.
//   Prometheus bleibt damit immer ~45 Einheiten von der Erde entfernt (konstant!),
//   weil der Erde-L5-Abstand = Bahnradius × 1 (gleichseitiges Dreieck Sonne-Erde-L5).

export interface Vec3 { x: number; y: number; z: number }

export interface OrbitParams {
  parent: string | null   // null = heliozentrisch (umkreist den Ursprung)
  radius: number          // Bahnradius in Spieleinheiten
  period: number          // Umlaufzeit in TICKS
  phase:  number          // Phase bei Tick 0 (Radiant). 0 = positive x-Achse.
  incl?:  number          // Bahnneigung (Radiant). Default 0 = koplanar → z=0 (2D)
  node?:  number          // aufsteigender Knoten (Radiant). Default 0
}

// ── Bahnen (Physik-Konstanten, hierarchisch) ──────────────────────────────────
// Alle heliozentrischen Bahnen (parent: null) umkreisen den Ursprung (Sonne).
// Hierarchische Bahnen (parent: slug) addieren zur Elternposition.
//
// Radien so gewählt, dass Mond↔Mars zwischen |150−45|=105 und 150+45=195
// schwankt → mit SEC_PER_UNIT=0.25: ~26s (nah) bis ~49s (fern, geclampt 50s).
//
// Prometheus (L5 Erde): gleicher Radius+Periode wie Erde, phase = −π/3 (60° zurück).
// Erde↔Prometheus: konstant 45 Einheiten → immer ~11s. Physikalisch korrekt.
export const ORBITS: Record<string, OrbitParams> = {
  earth:      { parent: null,    radius: 45,  period: 88,  phase: 0              },
  moon:       { parent: 'earth', radius: 3,   period: 2,   phase: 0              },
  prometheus: { parent: null,    radius: 45,  period: 88,  phase: -Math.PI / 3   },  // L5, 60° hinter Erde
  mars:       { parent: null,    radius: 150, period: 188, phase: 0              },  // 188/88 ≈ reales 1.88
  phobos:     { parent: 'mars',  radius: 3,   period: 2,   phase: 0              },
}

// ── Tuning ────────────────────────────────────────────────────────────────────
export const SEC_PER_UNIT = 0.25   // Distanz (Einheiten) → Sekunden
export const MIN_SECONDS   = 10    // Untergrenze: kürzester Hop
export const MAX_SECONDS   = 50    // Obergrenze: hält's arcadig

const TWO_PI = Math.PI * 2

// ── Position (deterministisch, 3D-bereit, rekursiv über parent) ──────────────
export function position(slug: string, tick: number): Vec3 {
  const o = ORBITS[slug]
  if (!o) return { x: 0, y: 0, z: 0 }   // unbekannter Ort → Ursprung

  const theta = o.phase + TWO_PI * (tick / o.period)
  const i  = o.incl ?? 0
  const om = o.node ?? 0
  const cosT = Math.cos(theta), sinT = Math.sin(theta)
  const cosI = Math.cos(i),     sinI = Math.sin(i)
  const cosO = Math.cos(om),    sinO = Math.sin(om)

  // Kreisbahn in (ggf. geneigter) Ebene. Bei incl=0 → cosI=1, sinI=0 → z=0.
  const lx = o.radius * (cosO * cosT - sinO * sinT * cosI)
  const ly = o.radius * (sinO * cosT + cosO * sinT * cosI)
  const lz = o.radius * (sinT * sinI)

  const base = o.parent ? position(o.parent, tick) : { x: 0, y: 0, z: 0 }
  return { x: base.x + lx, y: base.y + ly, z: base.z + lz }
}

// ── Distanz zwischen zwei Orten zu einem Tick (euklidisch, 2D wie 3D gleich) ──
export function distance(a: string, b: string, tick: number): number {
  const pa = position(a, tick), pb = position(b, tick)
  const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// ── Basis-Reisezeit (Sek., Tempo 1.0) — das Drop-in für baseTravelSeconds ─────
// Distanz × SEC_PER_UNIT, geclampt auf [MIN, MAX], auf ganze Sekunden gerundet.
export function orbitalBaseSeconds(a: string, b: string, tick: number): number {
  const raw = distance(a, b, tick) * SEC_PER_UNIT
  return Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, raw)))
}
