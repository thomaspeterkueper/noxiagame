const LABELS: Record<string,string> = {
  de: 'Deutsch',
  'de-DE': 'Deutsch',
  en: 'Englisch',
  vi: 'Vietnamesisch',
  tr: 'Türkisch',
  ar: 'Arabisch',
  zh: 'Chinesisch',
  cmn: 'Mandarin',
  yue: 'Kantonesisch',
  'x-marsianisch': 'Marsianisch',
}

export function languageDisplayName(code: string | null | undefined): string | null {
  if (!code) return null
  return LABELS[code] ?? LABELS[code.split('-')[0]] ?? code
}

export function translatedLanguageLabel(code: string | null | undefined, translated: boolean): string | null {
  const name = languageDisplayName(code)
  if (!name) return null
  return translated ? `${name} · automatisch übersetzt` : name
}
