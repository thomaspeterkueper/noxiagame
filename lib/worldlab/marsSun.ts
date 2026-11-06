// lib/worldlab/marsSun.ts
// Sonnenstand auf dem Mars (06.11.2026) – damit Tag und Nacht in der Weltkarte dem
// echten Marstag (Sol, 24 h 39 min) folgen und nicht der Erduhr.
//
// Verfahren nach Allison & McEwen (2000), wie im NASA-GISS-Programm Mars24,
// ohne die kleinen Planetenstörungen (Fehler im Sonnenstand < 0,1°).
// Längen planetozentrisch, Ost positiv – wie `world_frames` (Tharsis: −102°).

const DEG = Math.PI / 180

/** Sekunden eines mittleren Marstags */
export const SOL_SECONDS = 88775.244

/** Tage seit J2000 in Terrestrischer Zeit */
function daysSinceJ2000TT(nowMs: number): number {
  const jdUt = nowMs / 86_400_000 + 2440587.5
  return jdUt + 69.184 / 86_400 - 2451545.0
}

export interface MarsSunState {
  /** Areozentrische Sonnenlänge Ls (Grad, 0 = Frühlingsanfang im Norden) */
  ls: number
  /** Deklination der Sonne (Grad) */
  declination: number
  /** Wahre Ortssonnenzeit (Stunden 0–24) */
  localSolarHours: number
  /** Höhe der Sonne über dem Horizont (Grad) */
  elevation: number
}

export function marsSun(lat: number, lonEast: number, nowMs: number): MarsSunState {
  const dt = daysSinceJ2000TT(nowMs)
  const m = (19.3871 + 0.52402073 * dt) * DEG
  const alphaFms = 270.3871 + 0.524038496 * dt
  const nuMinusM = (10.691 + 3.0e-7 * dt) * Math.sin(m) + 0.623 * Math.sin(2 * m) + 0.050 * Math.sin(3 * m) + 0.005 * Math.sin(4 * m) + 0.0005 * Math.sin(5 * m)
  const ls = ((alphaFms + nuMinusM) % 360 + 360) % 360
  const lsR = ls * DEG
  const declination = Math.asin(0.42565 * Math.sin(lsR)) / DEG + 0.25 * Math.sin(lsR)
  const eot = 2.861 * Math.sin(2 * lsR) - 0.071 * Math.sin(4 * lsR) + 0.002 * Math.sin(6 * lsR) - nuMinusM
  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626
  const mst = ((24 * msd) % 24 + 24) % 24
  const localSolarHours = ((mst + lonEast / 15 + eot / 15) % 24 + 24) % 24
  const hourAngle = (localSolarHours - 12) * 15 * DEG
  const sinEl = Math.sin(lat * DEG) * Math.sin(declination * DEG) + Math.cos(lat * DEG) * Math.cos(declination * DEG) * Math.cos(hourAngle)
  return { ls, declination, localSolarHours, elevation: Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG }
}

/** Nur die Sonnenhöhe – Form wie `sunElevationDeg` der Erde (`ambient.ts`). */
export function marsSunElevationDeg(lat: number, lonEast: number, nowMs: number): number {
  return marsSun(lat, lonEast, nowMs).elevation
}

/** Ortszeit als „Sol-Uhr“ (z. B. „14:05“) für die Anzeige. */
export function marsLocalTimeText(lonEast: number, nowMs: number): string {
  const h = marsSun(0, lonEast, nowMs).localSolarHours
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60)
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}
