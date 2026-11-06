// lib/game/cognition/nightDreams.ts
// Erstellt: 06.11.2026 — Träume im Nachtlauf (NOXIA-LIVING-0016)
// Version:      1.0.0
//
// Jede schlafende Figur träumt – mehr oder weniger intensiv. Die meisten Träume
// bleiben unterbewusst; nur wenige Figuren erinnern sich an Bruchstücke oder
// deutlich, und nur erinnerte Träume kann die Figur erzählen (Thomas, 06.11.2026).
//
// Deterministisch, ohne Sprachmodell. Ein Traum ist eine Handvoll Motive aus dem
// eigenen Tag (Begegnungen, Arbeit) und manchmal einem Fremdimpuls (Meldung aus
// der Region). Er erzeugt keine Fakten, keine Erinnerung an Ereignisse und keine
// Handlung. Echte Personen aus Meldungen werden nie Traumfiguren.

import { creativityFromTraits } from '../personCognition'

export type DreamRecall = 'none' | 'fragment' | 'clear'

export interface DreamDayMaterial {
  /** Begegnungen des Tages mit anderen Figuren (fiktive Namen), stärkste zuerst. */
  encounters: Array<{ name: string; kind: 'interaction' | 'conflict' | 'assistance'; salience: number; valence: number }>
  /** Hat die Figur heute gearbeitet – und als was (Rollenwort, z. B. „Verwaltung“). */
  workedAs?: string | null
}

export interface DreamNewsCandidate {
  id: string
  title: string
  sourceName: string
  /** Nur Meldungen, die als Traumstoff taugen (Schutzfilter, keine Gewalt/Unglücke). */
  dreamOk: boolean
}

export interface NightDream {
  intensity: number
  recall: DreamRecall
  tellable: boolean
  motifs: string[]
  newsItemId: string | null
  sources: { encounters: string[]; work: boolean; news: string | null }
}

const unit = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))

export function stableHash01(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Wie gut sich eine Figur überhaupt an Träume erinnert – fest je Figur.
 * Trait `dream_recall` (0–1) geht vor; sonst stabil aus der ID, schief verteilt:
 * die meisten niedrig, wenige hoch.
 */
export function dreamRecallAbility(personId: string, traits?: Record<string, unknown> | null): number {
  const explicit = Number(traits?.dream_recall)
  if (Number.isFinite(explicit) && traits?.dream_recall !== undefined && traits?.dream_recall !== null) return unit(explicit)
  const h = stableHash01('dream-recall:' + personId)
  return unit(Math.pow(h, 2.2))
}

/** Wörter, die keine Motive sind. */
const STOP = new Set(['nach', 'nicht', 'eine', 'einer', 'einen', 'einem', 'durch', 'gegen', 'unter', 'wieder', 'sollen', 'wollen', 'werden', 'wurde', 'worden', 'haben', 'heute', 'immer', 'neues', 'neuer', 'neuen', 'neue', 'mehr', 'seit', 'beim', 'über', 'ueber', 'zwischen', 'sich', 'auch', 'noch', 'sind', 'dass', 'diese', 'dieser', 'ihren', 'seine', 'their', 'about', 'after', 'with', 'from', 'will', 'into', 'over', 'what', 'says', 'said'])

/**
 * Motive aus einer Meldung: Inhaltswörter ohne Namen. Folgen zwei groß geschriebene
 * Wörter aufeinander (typisch für Personennamen und Organisationen), fallen beide weg.
 */
export function newsMotifs(title: string, max = 2): string[] {
  const tokens = title.replace(/[„“"'«»()\[\]:;,.!?–—-]/g, ' ').split(/\s+/).filter(Boolean)
  const capital = (t: string) => /^\p{Lu}/u.test(t)
  const drop = new Set<number>()
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (capital(tokens[i]) && capital(tokens[i + 1])) { drop.add(i); drop.add(i + 1) }
  }
  const out: string[] = []
  tokens.forEach((t, i) => {
    if (drop.has(i)) return
    if (t.length < 5 || /\d/.test(t)) return
    if (STOP.has(t.toLocaleLowerCase('de-DE'))) return
    if (!out.some(o => o.toLocaleLowerCase('de-DE') === t.toLocaleLowerCase('de-DE'))) out.push(t)
  })
  // Längere Wörter tragen im Deutschen meist das Thema.
  return out.sort((a, b) => b.length - a.length || a.localeCompare(b, 'de')).slice(0, max)
}

const KIND_MOTIF: Record<DreamDayMaterial['encounters'][number]['kind'], string> = {
  interaction: 'ein Gespräch mit',
  conflict: 'ein Streit mit',
  assistance: 'Hilfe von',
}

/**
 * Ein Traum für eine Figur in einer Nacht. `nightKey` macht ihn reproduzierbar.
 */
export function dreamForNight(input: {
  personId: string
  nightKey: string
  traits?: Record<string, unknown> | null
  day: DreamDayMaterial
  news: DreamNewsCandidate[]
}): NightDream {
  const creativity = creativityFromTraits(input.traits ?? null)
  const seed = (s: string) => stableHash01(input.personId + '|' + input.nightKey + '|' + s)
  const top = input.day.encounters.slice().sort((a, b) => b.salience - a.salience || a.name.localeCompare(b.name, 'de')).slice(0, 2)
  const emotional = top.reduce((m, e) => Math.max(m, unit(e.salience) * 0.6 + Math.abs(e.valence) * 0.4), 0)

  // Alle träumen; die Intensität schwankt von Nacht zu Nacht.
  const intensity = unit(0.15 + seed('intensity') * 0.45 + emotional * 0.25 + creativity.associativeRange * 0.15)

  // Fremdimpuls: wer offener für Neues ist, nimmt eher eine Meldung in den Traum.
  const usable = input.news.filter(n => n.dreamOk && newsMotifs(n.title).length > 0)
  const takesNews = usable.length > 0 && seed('news') < 0.25 + creativity.noveltySeeking * 0.35
  const news = takesNews ? usable[Math.floor(seed('pick') * usable.length) % usable.length] : null

  const motifs: string[] = []
  for (const e of top) motifs.push(`${KIND_MOTIF[e.kind]} ${e.name}`)
  if (input.day.workedAs && seed('work') < 0.6) motifs.push(`die Arbeit (${input.day.workedAs})`)
  if (news) motifs.push(...newsMotifs(news.title))
  if (motifs.length === 0) motifs.push(seed('empty') < 0.5 ? 'ein langer Weg' : 'ein Raum, den man nicht kennt')

  const recallScore = unit(dreamRecallAbility(input.personId, input.traits) * 0.65 + intensity * 0.35)
  const recall: DreamRecall = recallScore >= 0.62 ? 'clear' : recallScore >= 0.45 ? 'fragment' : 'none'

  return {
    intensity: Math.round(intensity * 1000) / 1000,
    recall,
    tellable: recall !== 'none',
    motifs: motifs.slice(0, 4),
    newsItemId: news?.id ?? null,
    sources: { encounters: top.map(e => e.name), work: motifs.some(m => m.startsWith('die Arbeit')), news: news?.sourceName ?? null },
  }
}

/** Gesprächszeilen aus dem letzten erinnerten Traum (leer, wenn unterbewusst). */
export function dreamConversationLines(dream: { recall: DreamRecall; motifs: string[]; newsTitle?: string | null; newsSource?: string | null } | null): string[] {
  if (!dream || dream.recall === 'none' || dream.motifs.length === 0) return []
  const lines = dream.recall === 'clear'
    ? [`Letzte Nacht hast du geträumt – du erinnerst dich ungefähr an: ${dream.motifs.join('; ')}.`]
    : [`Von letzter Nacht ist dir nur ein Bruchstück eines Traums geblieben: ${dream.motifs[0]}.`]
  if (dream.recall === 'clear' && dream.newsTitle) lines.push(`Der Traum hing wohl mit einer Meldung zusammen, die du gehört hast: „${dream.newsTitle}“${dream.newsSource ? ` (${dream.newsSource})` : ''}. Die Meldung ist belegt, was du geträumt hast, nicht.`)
  lines.push('Erzähl davon nur, wenn es passt – wenn nach Schlaf, Träumen, Befinden oder einem der Motive gefragt wird. Ein Traum ist keine Tatsache; schmücke ihn nicht zu einer Geschichte aus und mach daraus keine Vorhersage.')
  return lines
}
