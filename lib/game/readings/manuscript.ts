// lib/game/readings/manuscript.ts
// Ein Manuskript aus buecherwelten (Markdown mit Kopfdaten) in Kapitel teilen.
// Reine Funktionen, ohne Netz – damit testbar.

import { parse as parseYaml } from 'yaml'
import type { ReadingSection } from './types'

/** Ab dieser Länge wird ein Kapitel in mehrere Leseteile geteilt. */
const MAX_SECTION_CHARS = 14_000
/** Ein Vorspann bis zu dieser Länge (Titel, Untertitel) wird dem ersten Kapitel vorangestellt. */
const SHORT_INTRO_CHARS = 400

export type ParsedManuscript = {
  meta: Record<string, unknown>
  sections: ReadingSection[]
  teaser: string | null
}

export function splitFrontmatter(source: string): { meta: Record<string, unknown>; body: string } {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return { meta: {}, body: text }
  const end = text.indexOf('\n---\n', 4)
  if (end < 0) return { meta: {}, body: text }
  let meta: Record<string, unknown> = {}
  try {
    const parsed = parseYaml(text.slice(4, end))
    if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>
  } catch { meta = {} }
  return { meta, body: text.slice(end + 5) }
}

const stripHashes = (line: string) => line.replace(/^#{1,6}\s+/, '').trim()

/** Lange Kapitel an Absatzgrenzen teilen. */
function chunk(section: ReadingSection, max = MAX_SECTION_CHARS): ReadingSection[] {
  if (section.text.length <= max) return [section]
  const paragraphs = section.text.split(/\n{2,}/)
  const parts: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > max) { parts.push(current); current = '' }
    current = current ? current + '\n\n' + paragraph : paragraph
  }
  if (current) parts.push(current)
  if (parts.length < 2) return [section]
  return parts.map((text, index) => ({ heading: `${section.heading} (${index + 1}/${parts.length})`, text: text.trim() }))
}

function firstParagraph(body: string) {
  for (const block of body.split(/\n{2,}/)) {
    const text = block.split('\n').filter(line => !/^#{1,6}\s/.test(line) && !/^[-_*]{3,}\s*$/.test(line)).join(' ').trim()
    if (text.length >= 60) return text.length > 320 ? text.slice(0, 317).replace(/\s+\S*$/, '') + ' …' : text
  }
  return null
}

/**
 * Kapitel: Zeilen, die `chapter_pattern` aus den Kopfdaten treffen, sonst Überschriften
 * der Ebene „## “. Ohne Kapitelüberschriften ist der ganze Text ein Teil (bei Bedarf
 * in Leseteile geteilt).
 */
export function parseManuscript(source: string, fallbackTitle = 'Text'): ParsedManuscript {
  const { meta, body } = splitFrontmatter(source)
  let pattern = /^## \S/
  if (typeof meta.chapter_pattern === 'string') {
    try { pattern = new RegExp(meta.chapter_pattern) } catch { /* Standardregel */ }
  }
  const lines = body.split('\n')
  const intro: string[] = []
  const sections: Array<{ heading: string; lines: string[] }> = []
  for (const line of lines) {
    if (pattern.test(line)) sections.push({ heading: stripHashes(line), lines: [] })
    else if (sections.length) sections[sections.length - 1].lines.push(line)
    else intro.push(line)
  }
  const introText = intro.join('\n').trim()
  const out: ReadingSection[] = sections.map(section => ({ heading: section.heading, text: section.lines.join('\n').trim() }))
  if (!out.length) {
    out.push({ heading: fallbackTitle, text: introText })
  } else if (introText) {
    if (introText.length <= SHORT_INTRO_CHARS) out[0] = { ...out[0], text: introText + '\n\n' + out[0].text }
    else out.unshift({ heading: fallbackTitle, text: introText })
  }
  const teaser = typeof meta.teaser === 'string' ? meta.teaser : firstParagraph(body)
  return { meta, sections: out.filter(section => section.text.length > 0).flatMap(section => chunk(section)), teaser }
}
