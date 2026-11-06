// lib/game/cognition/nightDreams.ts
// Erstellt: 06.11.2026 — Träume im Nachtlauf (NOXIA-LIVING-0016)
// Aktualisiert: 06.11.2026 — Traumton färbt die Stimmung leicht (dreamAffectDelta); seltene Einsicht bei deutlicher Erinnerung (insightFromDream)
// Version:      1.1.0
//
// Jede schlafende Figur träumt – mehr oder weniger intensiv. Die meisten Träume
// bleiben unterbewusst; nur wenige Figuren erinnern sich an Bruchstücke oder
// deutlich, und nur erinnerte Träume kann die Figur erzählen (Thomas, 06.11.2026).
//
// Deterministisch, ohne Sprachmodell. Ein Traum ist eine Handvoll Motive aus dem
// eigenen Tag (Begegnungen, Arbeit) und manchmal einem Fremdimpuls (Meldung aus
// der Region). Er erzeugt keine Fakten, keine Erinnerung an Ereignisse und keine
// Handlung. Echte Personen aus Meldungen werden nie Traumfiguren.

import { createInsightCandidate, creativityFromTraits, type InsightCandidate } from '../personCognition'

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
  /** −1..1: Grundton des Traums (Streit dunkel, Hilfe hell), auch wenn er unterbewusst bleibt. */
  tone: number
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
  return unit(Math.pow(h, 3))
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

  const kindTone = top.reduce((sum, e) => sum + (e.kind === 'conflict' ? -0.5 : e.kind === 'assistance' ? 0.4 : 0.1) + e.valence * 0.3, 0) / Math.max(1, top.length)
  const tone = Math.max(-1, Math.min(1, kindTone * 0.7 + (seed('tone') - 0.5) * 0.6))

  const recallScore = unit(dreamRecallAbility(input.personId, input.traits) * 0.65 + intensity * 0.35)
  const recall: DreamRecall = recallScore >= 0.7 ? 'clear' : recallScore >= 0.5 ? 'fragment' : 'none'

  return {
    intensity: Math.round(intensity * 1000) / 1000,
    tone: Math.round(tone * 1000) / 1000,
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

/**
 * Jeder Traum – auch der unterbewusste – färbt die Stimmung leicht. Höchstens 0,12
 * je Gefühl; über applyAffect bewegt das die Grundstimmung um wenige Hundertstel.
 */
export function dreamAffectDelta(dream: Pick<NightDream, 'intensity' | 'tone'>): { joy: number; fear: number; anger: number; sadness: number } {
  const strength = 0.12 * unit(dream.intensity) * Math.min(1, Math.abs(dream.tone))
  if (dream.tone >= 0) return { joy: strength, fear: 0, anger: 0, sadness: 0 }
  return { joy: 0, fear: strength * 0.5, anger: 0, sadness: strength * 0.5 }
}

export type OpenProblemCode = 'purpose' | 'safety' | 'sustenance' | 'social' | 'rest' | 'variety'

export interface OpenProblem {
  code: OpenProblemCode
  /** 0..1, wie drängend (1 − Zufriedenheit). */
  severity: number
}

/** Das drängendste unerfüllte Bedürfnis unter 0,45 – sonst kein offenes Problem. */
export function openProblemFromNeeds(needs: Array<{ needCode: string; satisfaction: number }>): OpenProblem | null {
  const known: OpenProblemCode[] = ['purpose', 'safety', 'sustenance', 'social', 'rest', 'variety']
  const worst = needs
    .filter(n => known.includes(n.needCode as OpenProblemCode) && Number.isFinite(n.satisfaction) && n.satisfaction < 0.45)
    .sort((a, b) => a.satisfaction - b.satisfaction || a.needCode.localeCompare(b.needCode))[0]
  return worst ? { code: worst.needCode as OpenProblemCode, severity: unit(1 - worst.satisfaction) } : null
}

const HYPOTHESIS: Record<OpenProblemCode, string> = {
  variety: 'Vielleicht sollte ich mal etwas ganz anderes tun als sonst',
  social: 'Vielleicht sollte ich auf jemanden zugehen, statt zu warten',
  purpose: 'Vielleicht liegt meine Aufgabe woanders, als ich dachte',
  rest: 'Vielleicht muss ich mir bewusst Ruhe nehmen',
  sustenance: 'Vielleicht sollte ich anders für mein Essen sorgen',
  safety: 'Vielleicht muss ich etwas ändern, damit ich mich sicherer fühle',
}

export const INSIGHT_COOLDOWN_DAYS = 7

/**
 * Erleuchtung ist selten: nur bei deutlich erinnertem Traum, offenem Problem, außerhalb
 * der Sperrfrist, und wenn das Einsichtstor (selectCognitiveState, Traum) aufgeht.
 * Ergebnis ist eine Vermutung (`canonical: false`), keine Wahrheit.
 */
export function insightFromDream(input: {
  dream: NightDream
  problem: OpenProblem | null
  traits?: Record<string, unknown> | null
  expertise?: number
  lastInsightAt?: Date | null
  now: Date
}): InsightCandidate | null {
  const { dream, problem } = input
  if (dream.recall !== 'clear' || !problem) return null
  if (input.lastInsightAt && input.now.getTime() - input.lastInsightAt.getTime() < INSIGHT_COOLDOWN_DAYS * 86400000) return null
  // Einsichtstor im Traum: Intensität, Druck des Problems, Weite der Assoziationen,
  // Fachwissen und ein Rest Zufall (stabil je Traum). Schwelle wie ideaThreshold.
  const creativity = creativityFromTraits(input.traits ?? null)
  const chance = stableHash01('insight|' + dream.motifs.join('|') + '|' + input.now.toISOString().slice(0, 10))
  const gate = unit(dream.intensity * 0.3 + problem.severity * 0.25 + creativity.associativeRange * 0.15 + unit(input.expertise ?? 0.5) * 0.1 + chance * 0.2)
  if (gate < Math.max(0.55, creativity.ideaThreshold - 0.08)) return null
  const motif = dream.motifs[0]
  return createInsightCandidate({
    problemRef: 'need:' + problem.code,
    inspirationRefs: [...dream.sources.encounters.map(n => 'person:' + n), ...(dream.newsItemId ? ['news:' + dream.newsItemId] : [])],
    hypothesis: `${HYPOTHESIS[problem.code]}${motif ? ` – im Traum war ${motif}` : ''}.`,
    confidence: unit(0.3 + dream.intensity * 0.3),
    provenance: dream.newsItemId ? 'knowledge_gateway' : 'dream_recombination',
  })
}

/** Gesprächszeile für eine noch unbestätigte Einsicht. */
export function insightConversationLines(insight: { hypothesis: string } | null): string[] {
  if (!insight?.hypothesis) return []
  return [
    `Dir ist neulich nach einem Traum eine Idee gekommen, sicher bist du nicht: „${insight.hypothesis}“`,
    'Erzähl davon nur, wenn es zum Gespräch passt. Es ist eine Vermutung über dich selbst, keine Tatsache über die Welt.',
  ]
}
