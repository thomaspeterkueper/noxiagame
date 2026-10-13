// lib/worldlab/frameStats.ts
// Messung für den Prototyp „eine Welt“: wohin die Zeit eines Bildes geht.
//
// Je Bild werden drei Werte gemerkt: der Abstand zum vorigen Bild, die Zeit in
// der eigenen Logik (Laufen, Kacheln) und die Zeit, die PixiJS auf dem Prozessor
// zum Zeichnen braucht. Was die Grafikkarte danach noch tut, sieht man nur am
// Bildabstand: Ist der groß, Logik und Zeichnen aber klein, wartet das Bild auf
// die Grafikkarte (Füllrate, Kantenglättung, Auflösung).

export interface FrameSample {
  /** Abstand zum vorigen Bild in ms. */
  intervalMs: number
  /** Eigene Logik in ms. */
  logicMs: number
  /** Zeichnen auf dem Prozessor in ms. */
  renderMs: number
}

export interface FrameSummary {
  /** Bilder je Sekunde im Mittel über das Fenster. */
  fps: number
  /** Langsamstes Bild im Fenster (ms). */
  worstMs: number
  /** Bilder, die länger als zwei Bildschirmtakte (bei 60 Hz: 25 ms) brauchten. */
  stutters: number
  logicMs: number
  renderMs: number
  /** Ausreißer: höchste Logik- und Zeichenzeit im Fenster. */
  logicMaxMs: number
  renderMaxMs: number
  frames: number
}

/** Ringpuffer der letzten Bilder; `summary()` fasst das Fenster zusammen. */
export class FrameStats {
  private readonly samples: FrameSample[] = []
  private next = 0

  constructor(private readonly capacity = 120) {}

  push(sample: FrameSample) {
    if (this.samples.length < this.capacity) this.samples.push(sample)
    else this.samples[this.next] = sample
    this.next = (this.next + 1) % this.capacity
  }

  summary(): FrameSummary {
    const n = this.samples.length
    if (!n) return { fps: 0, worstMs: 0, stutters: 0, logicMs: 0, renderMs: 0, logicMaxMs: 0, renderMaxMs: 0, frames: 0 }
    let interval = 0, logic = 0, render = 0, worst = 0, logicMax = 0, renderMax = 0, stutters = 0
    for (const s of this.samples) {
      interval += s.intervalMs; logic += s.logicMs; render += s.renderMs
      if (s.intervalMs > worst) worst = s.intervalMs
      if (s.logicMs > logicMax) logicMax = s.logicMs
      if (s.renderMs > renderMax) renderMax = s.renderMs
      if (s.intervalMs > 25) stutters++
    }
    return {
      fps: interval > 0 ? 1000 * n / interval : 0,
      worstMs: worst,
      stutters,
      logicMs: logic / n,
      renderMs: render / n,
      logicMaxMs: logicMax,
      renderMaxMs: renderMax,
      frames: n,
    }
  }
}
