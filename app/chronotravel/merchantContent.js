export const SHOP_CONTENT = {
  550: { merchant: 'Händler am Hippodrom', greeting: 'Willkommen. Sucht Ihr Öl, Tuch oder Keramik?', goods: ['Ölamphore', 'Leinentuch', 'Keramikgefäß'] },
  1200: { merchant: 'Händler aus Konstantinopel', greeting: 'Willkommen in meinem Laden. Seht Euch meine Waren an.', goods: ['Glasgefäß', 'Gewürzbeutel', 'Gewebtes Tuch'] },
  1700: { merchant: 'Händler am Atmeydanı', greeting: 'Hoş geldiniz! Willkommen. Was möchtet Ihr sehen?', goods: ['Kupferkanne', 'Gewürzbeutel', 'Keramikschale'] },
}

/** Fiktiver Beispieltext: weder historische Transkription noch KI-/Core-NPC. */
export function merchantReply(year, topic) {
  const data = SHOP_CONTENT[year]
  if (!data) return 'Diese Epoche ist noch nicht verfügbar.'
  if (topic === 'goods') return 'Heute zeige ich Euch: ' + data.goods.join(', ') + '. Die Auswahl ist eine illustrative Rekonstruktion.'
  if (topic === 'city') return 'Die Stadt verändert sich mit den Menschen. Ich kann Euch nur von meinem eigenen Alltag erzählen. Historische Aussagen werden später mit SSF-Quellen abgeglichen.'
  if (topic === 'farewell') return 'Gute Reise. Mögen wir uns wiedersehen.'
  return data.greeting
}
