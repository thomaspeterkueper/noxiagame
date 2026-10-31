// lib/worldlab/placeStories.ts
// Erstellt: 31.10.2026
// Ortsgeschichten zu realen Gebäuden: feste Texte nach OSM-Kennung, mit Quelle.
// Nur belegte Angaben (Quelle steht dabei); was nicht belegt ist, steht nicht da.
// Rein, ohne Datenbank. Ergänzt den Verlauf (buildingChronicle), der nur Spielereignisse zeigt.

export interface PlaceStory {
  /** OSM-Kennung des Gebäudes, z. B. osm:way:246890728. */
  source: string
  title: string
  /** Kurzzeile unter der Überschrift. */
  tagline: string
  paragraphs: { heading?: string; text: string }[]
  /** Angaben aus dem Bestandsverzeichnis (Baubeschreibung). */
  facts: { label: string; value: string }[]
  credit: { label: string; url: string }
}

export const PLACE_STORIES: readonly PlaceStory[] = [
  {
    source: 'osm:way:246890728',
    title: 'Rochuskapelle',
    tagline: 'Eine Kapelle in der Rochus-Tradition · Sundern, Hauptstraße · von 1925',
    paragraphs: [
      {
        heading: 'Eine Kapelle in der Rochus-Tradition',
        text: 'Die Rochuskapelle in Sundern steht in der Tradition der Verehrung des heiligen Rochus. Der heutige Bau ersetzt eine ältere Kapelle und gehört zu den religiösen Erinnerungsorten der Stadt.',
      },
      {
        heading: 'Innenbesichtigung vorab klären',
        text: 'Bei einem Rundgang lässt sich die Kapelle als Teil der örtlichen Geschichte betrachten. Für eine Besichtigung des Innenraums sollte man die aktuellen Möglichkeiten erfragen; die Außenansicht sagt nichts über eine tägliche Öffnung aus.',
      },
    ],
    facts: [
      { label: 'Baujahr', value: '1925' },
      { label: 'Bauform', value: 'Achteckiger, längsoblonger Zentralbau mit rechteckigem, eingezogenem Chor und offener Westvorhalle' },
      { label: 'Dach', value: 'Verschieferter Dachreiter und Dachgaupen an den Seiten' },
      { label: 'Fenster', value: 'Originale Verglasung in den längsovalen Fenstern' },
      { label: 'Zustand', value: 'gut' },
    ],
    credit: {
      label: 'Rochuskapelle von 1925 – Deutsche Digitale Bibliothek',
      url: 'https://www.deutsche-digitale-bibliothek.de/item/5E7A4OWEQT2BORSEQKOQMEAY3SR5G6H5#item-detail',
    },
  },
]

export function placeStory(source: string | null | undefined): PlaceStory | null {
  if (!source) return null
  return PLACE_STORIES.find(story => story.source === source) ?? null
}
