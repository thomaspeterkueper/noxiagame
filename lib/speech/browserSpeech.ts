// lib/speech/browserSpeech.ts
// Sprachausgabe des Browsers (Test, Thomas 03.11.2026): kostenlos, an/aus, Text steht immer dabei.
// Jede Figur bekommt – soweit der Browser mehrere deutsche Stimmen hat – ihre feste Stimme.

const KEY = 'noxia.speech.enabled'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function loadSpeechEnabled(): boolean {
  try { return window.localStorage.getItem(KEY) === '1' } catch { return false }
}
export function saveSpeechEnabled(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ohne Speicher gilt die Auswahl nur bis zum Neuladen */ }
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Stimme und Tonlage für eine Figur: stabil über die Zeit, verschieden zwischen Figuren. */
export function voiceChoice(voices: ReadonlyArray<{ lang: string; name: string }>, key: string) {
  const german = voices.filter(voice => voice.lang.toLowerCase().startsWith('de'))
  const h = hash(key)
  return { voiceIndex: german.length ? h % german.length : -1, pitch: 0.9 + (h % 21) / 100, german }
}

/** Lange Texte in Sätze teilen: Browser brechen sonst mitten im Text ab. */
export function speechChunks(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*/g) ?? []
  const out: string[] = []
  let current = ''
  for (const sentence of sentences.map(item => item.trim()).filter(Boolean)) {
    if (current && (current + ' ' + sentence).length > max) { out.push(current); current = sentence } else current = current ? current + ' ' + sentence : sentence
  }
  if (current) out.push(current)
  return out
}

export function speak(text: string, voiceKey: string, rate = 0.95) {
  if (!speechSupported() || !text.trim()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const choice = voiceChoice(synth.getVoices(), voiceKey)
  for (const chunk of speechChunks(text)) {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.lang = 'de-DE'
    utterance.rate = rate
    utterance.pitch = choice.pitch
    if (choice.voiceIndex >= 0) utterance.voice = choice.german[choice.voiceIndex] as SpeechSynthesisVoice
    synth.speak(utterance)
  }
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}
