// lib/game/hospitality/spokenOrder.ts
// Bestellen im Gespräch (Thomas, 28.10.2026, nach der Gesprächsauswertung G-6):
// Wer der Bedienung sagt „ein Wasser bitte“, bekommt darunter einen Knopf, der
// den passenden Posten der Karte bucht. Gebucht wird erst mit dem Knopf – die
// Figur sagt nicht mehr „notiert“, ohne dass etwas geschieht.
// Hier nur die Zuordnung gesprochener Wörter zu Posten der Karte. Reine Regeln.

export interface SpokenMenuItem { itemCode: string; label: string }
export interface SpokenOrder { itemCode: string; label: string; /** Das Wort, wie es gesagt wurde, z. B. „Wasser“. */ said: string }

/** Wörter je Kartenposten. Nur Posten, die auf der Karte stehen, werden vorgeschlagen. */
const WORDS: Readonly<Record<string, readonly string[]>> = {
  drink: ['getränk', 'getraenk', 'trinken', 'wasser', 'sprudel', 'kaffee', 'espresso', 'cappuccino', 'latte', 'tee', 'kakao', 'cola', 'limo', 'limonade', 'saft', 'schorle', 'bier', 'pils', 'wein', 'milch'],
  longdrink: ['longdrink', 'cocktail', 'gin', 'whisky', 'wodka', 'rum'],
  snack: ['snack', 'nüsse', 'chips', 'brezel', 'kleinigkeit'],
  cake: ['kuchen', 'torte', 'gebäck', 'croissant', 'keks', 'waffel'],
  meal: ['mahlzeit', 'essen', 'gericht', 'suppe', 'eintopf', 'brot', 'sandwich', 'frühstück', 'mittagessen', 'abendessen'],
  starter: ['vorspeise', 'suppe', 'salat'],
  main: ['hauptgericht', 'hauptspeise', 'essen', 'schnitzel', 'steak', 'pasta', 'pizza', 'burger', 'grillteller', 'cevapcici', 'ćevapi', 'braten'],
  dessert: ['nachtisch', 'nachspeise', 'dessert', 'eis', 'pudding'],
  room_night: ['zimmer', 'übernachtung', 'übernachten'],
  water: ['wasser'],
  ration: ['ration'],
}

const NEGATIONS = new Set(['kein', 'keine', 'keinen', 'keinem', 'nicht', 'ohne', 'nichts'])

function tokens(text: string): string[] {
  return text.toLocaleLowerCase('de-DE').replace(/[^\p{L}\s-]+/gu, ' ').split(/[\s-]+/).filter(Boolean)
}

/** Ein Wort passt, wenn es mit dem Stichwort beginnt (Kaffee → Kaffees, Kuchen → Kuchenstück). */
function matches(token: string, keyword: string): boolean {
  return token === keyword || (keyword.length >= 4 && token.startsWith(keyword))
}

/**
 * Posten der Karte, die in einem Satz genannt werden – höchstens drei, in der
 * Reihenfolge des Satzes. Verneinte Wörter („kein Kaffee“) zählen nicht. Steht
 * ein Wort bei mehreren Posten (Suppe: Vorspeise oder Mahlzeit), gilt der erste,
 * den die Karte führt.
 */
export function spokenOrderItems(text: string | null | undefined, menu: readonly SpokenMenuItem[]): SpokenOrder[] {
  if (!text || menu.length === 0) return []
  const words = tokens(text)
  const onMenu = new Map(menu.map(item => [item.itemCode, item]))
  const found: SpokenOrder[] = []
  words.forEach((word, index) => {
    if (found.length >= 3) return
    const negated = words.slice(Math.max(0, index - 2), index).some(w => NEGATIONS.has(w))
    if (negated) return
    for (const [code, keywords] of Object.entries(WORDS)) {
      const item = onMenu.get(code)
      if (!item || found.some(f => f.itemCode === code)) continue
      const keyword = keywords.find(k => matches(word, k))
      if (!keyword) continue
      // Das Wort so zeigen, wie es auf der Karte heißt, wenn es der Posten selbst ist.
      const said = item.label.toLocaleLowerCase('de-DE') === word ? item.label : word.charAt(0).toLocaleUpperCase('de-DE') + word.slice(1)
      found.push({ itemCode: code, label: item.label, said })
      break
    }
  })
  return found
}

/** „Getränk (Wasser)“ – oder nur „Kuchen“, wenn das Gesagte der Posten selbst ist. */
export function spokenOrderTitle(order: SpokenOrder): string {
  return order.said.toLocaleLowerCase('de-DE') === order.label.toLocaleLowerCase('de-DE') ? order.label : `${order.label} (${order.said})`
}
