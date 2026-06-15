// lib/game/orbits.test.ts
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Lokaler Demo-/Test-Runner für die Orbital-Engine. Zeigt die Reisezeiten über
// einen synodischen Zyklus (Mond↔Mars schwingt nah↔fern) und prüft die
// Invarianten. Kein Framework — `node` nach esbuild-Bundle oder `npx tsx`.

import { position, distance, orbitalBaseSeconds, ORBITS, MIN_SECONDS, MAX_SECONDS } from './orbits'

// Synodische Periode Mond/Mars: 1 / (1/100 − 1/188) ≈ 214 Ticks.
const SYNODIC = Math.round(1 / (1 / ORBITS.moon.period - 1 / ORBITS.mars.period))

console.log(`Synodische Periode (Mond↔Mars) ≈ ${SYNODIC} Ticks\n`)
console.log('Tick   Mond↔Mars   Mond↔Phobos   Mars↔Phobos')
for (let t = 0; t <= 220; t += 20) {
  const mm = orbitalBaseSeconds('moon', 'mars', t)
  const mp = orbitalBaseSeconds('moon', 'phobos', t)
  const rp = orbitalBaseSeconds('mars', 'phobos', t)
  const bar = '█'.repeat(Math.round(mm / 2))
  console.log(`${String(t).padStart(4)}   ${String(mm).padStart(5)}s     ${String(mp).padStart(5)}s       ${String(rp).padStart(5)}s   ${bar}`)
}

// ── Invarianten ───────────────────────────────────────────────────────────────
let fails = 0
function pruefe(ok: boolean, was: string) { if (!ok) { fails++; console.log(`\n✘ FAIL: ${was}`) } }

// Feine Abtastung über einen vollen Zyklus für Min/Max + Klemmungen.
let mmMin = Infinity, mmMax = -Infinity, rpAllTen = true, zAllZero = true
for (let t = 0; t <= SYNODIC; t++) {
  const mm = orbitalBaseSeconds('moon', 'mars', t)
  if (mm < mmMin) mmMin = mm
  if (mm > mmMax) mmMax = mm
  if (orbitalBaseSeconds('mars', 'phobos', t) !== MIN_SECONDS) rpAllTen = false
  for (const s of ['moon', 'mars', 'phobos']) if (position(s, t).z !== 0) zAllZero = false
}

console.log('')
console.log(`Mond↔Mars Spannweite: ${mmMin}s … ${mmMax}s`)
pruefe(mmMin >= 24 && mmMin <= 26, `nahester Punkt ~25s (ist ${mmMin})`)
pruefe(mmMax >= 49 && mmMax <= 50, `fernster Punkt ~50s (ist ${mmMax})`)
pruefe(rpAllTen, `Mars↔Phobos konstant ${MIN_SECONDS}s (Phobos reitet mit Mars, MIN-Klemme)`)
pruefe(zAllZero, 'z überall 0 (koplanar / reines 2D)')
pruefe(MAX_SECONDS === mmMax, 'Mond↔Mars-Fernpunkt = MAX (arcadige Obergrenze greift genau)')

// Determinismus
const a = position('phobos', 137), b = position('phobos', 137)
pruefe(JSON.stringify(a) === JSON.stringify(b), 'position() deterministisch (zweimal identisch)')

// Phobos reitet mit Mars: Mond↔Phobos ≈ Mond↔Mars (Wobble nur ±Radius=3 → ±~1s)
let maxAbweichung = 0
for (let t = 0; t <= SYNODIC; t += 5) {
  const d = Math.abs(distance('moon', 'phobos', t) - distance('moon', 'mars', t))
  if (d > maxAbweichung) maxAbweichung = d
}
pruefe(maxAbweichung <= ORBITS.phobos.radius + 0.01, `Mond↔Phobos folgt Mond↔Mars (max Abweichung ${maxAbweichung.toFixed(2)} Einheiten ≤ Phobos-Radius)`)

console.log(`\n${fails === 0 ? '✓ alle Invarianten erfüllt' : `✘ ${fails} Fehlschläge`}`)
