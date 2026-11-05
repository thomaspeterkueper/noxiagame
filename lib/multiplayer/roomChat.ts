// lib/multiplayer/roomChat.ts
// Spieler reden im Raum miteinander (Thomas, 04.11.2026: „Chats zwischen Spielern
// freischalten; alles, was gerade passiert, wenn jemand kommt, ist wichtig, um
// einzuschätzen, wo wir aufpassen müssen“).
// Alles wird gespeichert und ausgewertet. Geschützt wird nur das Nötigste:
// Kontaktdaten (E-Mail, Telefon, Links, Messenger) werden in der gezeigten Fassung
// entfernt – auch wegen des Schulpilots. Grobe Einordnung mit derselben Regel wie
// bei Gesprächen mit Figuren (conversationTopic). Reine Regeln.

import { classifyConversationTopic, type ConversationTopic } from '../game/cognition/conversationTopic'

export const ROOM_MESSAGE_MAX = 300
/** Höchstens so viele Nachrichten je Minute und Spieler. */
export const ROOM_MESSAGES_PER_MINUTE = 6

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|de|net|org|io|me|app|gg|ly|tv)\b\S*/giu
const PHONE = /(?:\+|00)?\d[\d\s/().-]{6,}\d/g
const HANDLE = /(^|\s)@[\p{L}\p{N}_.]{2,}/gu
const MESSENGER = /\b(whats\s?app|telegram|snap(chat)?|insta(gram)?|discord|tiktok|signal|skype|kik)\b/i

export interface PreparedMessage { text: string; shown: string; topic: ConversationTopic; flags: string[] }

export function prepareRoomMessage(raw: string): PreparedMessage | null {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, ROOM_MESSAGE_MAX)
  if (!text) return null
  const flags: string[] = []
  let shown = text
  const before = shown
  shown = shown.replace(EMAIL, '[Kontakt entfernt]').replace(URL, '[Link entfernt]').replace(PHONE, '[Nummer entfernt]').replace(HANDLE, '$1[Name entfernt]')
  if (shown !== before) flags.push('contact')
  if (MESSENGER.test(text)) flags.push('messenger')
  const topic = classifyConversationTopic(text)
  if (topic === 'provocation') flags.push('provocation')
  return { text, shown, topic, flags }
}

// ── Flüstern, Sagen, Rufen (05.11.2026, Second-Life-Mechanik) ──────────────
// Flüstern geht nur an einen Spieler (privat zugestellt), Sagen hört, wer in der
// Nähe steht, Rufen der ganze Raum. Gespeichert wird alles (Testphase).

export type ChatRange = 'whisper' | 'say' | 'shout'
export const CHAT_RANGES: readonly ChatRange[] = ['whisper', 'say', 'shout']
/** Reichweite im Raum in Bildpunkten des Innenraums (760 × 470). */
export const SAY_RANGE_PX = 300
export const WHISPER_RANGE_PX = 80

export interface HeardMessage { senderId: string; range?: ChatRange; toId?: string | null; x?: number | null; y?: number | null }

/** Hört man die Nachricht dort, wo man steht? Eigene immer. */
export function heardAt(m: HeardMessage, me: { id: string; x: number; y: number }): boolean {
  if (m.senderId === me.id) return true
  const range = m.range ?? 'say'
  if (range === 'whisper') return m.toId === me.id
  if (range === 'shout') return true
  if (typeof m.x !== 'number' || typeof m.y !== 'number') return true
  return Math.hypot(m.x - me.x, m.y - me.y) <= SAY_RANGE_PX
}

export const rangeLabel = (r: ChatRange | undefined) => r === 'whisper' ? 'flüstert' : r === 'shout' ? 'ruft' : 'sagt'

