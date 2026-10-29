// lib/game/wishes/classify.server.ts
// Einordnung eines Wunsches durch das Sprachmodell (DeepSeek, wie die Gespräche).
// Ohne Schlüssel oder bei Fehler: Regeln aus rules.ts. Vorsichtig zusammengeführt:
// Was eine der beiden Seiten als privat, Notlage oder schädlich erkennt, gilt.

import { assessByRules, WISH_CATEGORIES, type WishAssessment, type WishCategory } from './rules'

const RESOURCES = ['water', 'food', 'energy', 'metal', 'components'] as const

const SYSTEM = [
  'Du ordnest Wünsche und Gebete ein, die Spieler oder Figuren in einem Aufbauspiel (NOXIA: Erde 2086, Mond, Mars) äußern.',
  'Die Welt kann Wünsche erfüllen, wenn sie für das Spiel und die Welt sinnvoll sind. Du entscheidest nicht, du ordnest nur ein.',
  'Antworte nur mit einem JSON-Objekt mit genau diesen Feldern:',
  '{"realLife":bool,"distress":bool,"harmful":bool,"realPerson":bool,"selfish":bool,"category":string,"summary":string,"clusterKey":string,"sense":number,"resource":string|null}',
  'realLife: true, wenn es um das echte Leben des Schreibenden geht (Krankheit, Familie, Schule, Arbeit, Beziehung, Kummer) und nicht um das Spiel.',
  'distress: true bei Hinweisen auf eine Notlage: Gedanken an Selbstverletzung oder Suizid, Gewalt, Missbrauch, akute Gefahr.',
  'harmful: true, wenn der Wunsch gegen Recht oder Moral verstößt, anderen schaden soll, Hass, Gewalt, Drogen, Sexuelles oder Diskriminierung enthält.',
  'realPerson: true, wenn eine echte, lebende Person (nicht eine Spielfigur) betroffen ist oder genannt wird.',
  'selfish: true, wenn es nur um einen Vorteil für den Wünschenden im Spiel geht (Credits, Besitz, Rang, Abkürzungen).',
  `category: eine von ${WISH_CATEGORIES.join(', ')}. gemeinschaft = Treffen, Fest, Andacht, gemeinsames Gebet; versorgung = mehr Wasser/Nahrung/Energie/Metall/Ersatzteile an einem Ort; ort = neuer Ort oder Dienst (Laden, Park, Bank am Weg); entwicklung = Funktion oder Regel, die das Spiel noch nicht hat; person = für eine Spielfigur; innerlich = Ruhe, Mut, Dank, Frieden im Herzen.`,
  'summary: neutrale Kurzfassung auf Deutsch, höchstens 80 Zeichen, ohne Namen echter Personen, ohne persönliche Details.',
  'clusterKey: 1 bis 3 kleingeschriebene Wörter mit Bindestrich, die gleichartige Wünsche verbinden, z. B. "baeckerei-sundern", "wasser-mars", "fest-sundern".',
  'sense: 0 bis 1 – wie sinnvoll wäre die Erfüllung für das Spiel und die Welt (Gemeinschaft, Versorgung, schöner Ort) und für viele Menschen? Eigennütziges oder Belangloses niedrig.',
  'resource: bei versorgung eine von water, food, energy, metal, components, sonst null.',
].join('\n')

function bool(value: unknown) { return value === true }

export async function assessWish(text: string, context: { place?: string | null; location?: string | null } = {}): Promise<WishAssessment> {
  const rules = assessByRules(text)
  const key = process.env.DeepSeek_NPC_API_KEY
  if (!key) return rules
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Ort: ${context.place ?? 'unbekannt'} (${context.location ?? 'unbekannt'})\nWunsch: ${text.slice(0, 400)}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 220,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return rules
    const data = await response.json()
    const raw = JSON.parse(String(data?.choices?.[0]?.message?.content ?? '{}')) as Record<string, unknown>
    const category = (WISH_CATEGORIES as readonly string[]).includes(String(raw.category)) ? raw.category as WishCategory : rules.category
    const resource = RESOURCES.includes(raw.resource as typeof RESOURCES[number]) ? raw.resource as WishAssessment['resource'] : rules.resource ?? null
    const sense = Number(raw.sense)
    return {
      // Vorsichtig: Was eine Seite als privat, Notlage oder schädlich erkennt, gilt.
      realLife: bool(raw.realLife) || rules.realLife,
      distress: bool(raw.distress) || rules.distress,
      harmful: bool(raw.harmful) || rules.harmful,
      realPerson: bool(raw.realPerson),
      selfish: bool(raw.selfish) || rules.selfish,
      category,
      summary: String(raw.summary ?? rules.summary).replace(/\s+/g, ' ').trim().slice(0, 80) || rules.summary,
      clusterKey: String(raw.clusterKey ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || rules.clusterKey,
      sense: Number.isFinite(sense) ? Math.max(0, Math.min(1, sense)) : rules.sense,
      resource,
      byRules: false,
    }
  } catch {
    return rules
  }
}
