// app/api/admin/readings/route.ts
// Adminbereich: Bücherliste (05.11.2026). Alle Texte und Werke aus buecherwelten mit ihrer
// Freigabe im Spiel. Der Wortlaut wird hier nicht bearbeitet – nur in buecherwelten.
// GET  – Katalog + Freigaben
// POST – { kind, slug, mode, rubric, sampleChapters, sort, purchaseNote } speichert eine Freigabe
//        { action: 'refresh' } leert den Zwischenspeicher, damit Änderungen aus buecherwelten sofort ankommen

import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { BUECHERWELTEN_CACHE_TAG, BuecherweltenUnavailable, buecherweltenConfigured, loadCatalog, readFile } from '@/lib/game/readings/buecherwelten.server'
import { loadReleases, readableChapterCount } from '@/lib/game/readings/releases.server'
import { parseManuscript } from '@/lib/game/readings/manuscript'
import { READING_MODES, READING_RUBRICS, type ReadingMode } from '@/lib/game/readings/types'

async function adminId(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return null
  const { data } = await createServiceClient().from('admin_profiles').select('profile_id').eq('profile_id', profileId).maybeSingle()
  return data ? profileId : null
}

export async function GET(req: NextRequest) {
  if (!await adminId(req)) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const releases = await loadReleases().catch(() => [])
  if (!buecherweltenConfigured()) {
    return NextResponse.json({ source: { ok: false, message: 'BUECHERWELTEN_TOKEN ist bei Vercel noch nicht eingetragen.' }, entries: [], releases }, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const catalog = await loadCatalog()
    const entries = await Promise.all(catalog.map(async entry => {
      const release = releases.find(row => row.kind === entry.kind && row.slug === entry.slug) ?? null
      const chapters = entry.manuscriptPath
        ? await readFile(entry.manuscriptPath).then(text => parseManuscript(text, entry.title).sections).catch(() => null)
        : null
      return {
        ...entry,
        chapters: chapters?.map(section => section.heading) ?? [],
        release: release && { mode: release.mode, rubric: release.rubric, sampleChapters: release.sample_chapters, sort: release.sort, purchaseNote: release.purchase_note, updatedAt: release.updated_at,
          readable: readableChapterCount(release.mode, chapters?.length ?? 0, release.sample_chapters) },
      }
    }))
    return NextResponse.json({ source: { ok: true, message: null }, entries }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof BuecherweltenUnavailable ? error.message : 'buecherwelten ist gerade nicht erreichbar.'
    return NextResponse.json({ source: { ok: false, message }, entries: [], releases }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(req: NextRequest) {
  const admin = await adminId(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugang' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (body.action === 'refresh') {
    revalidateTag(BUECHERWELTEN_CACHE_TAG, 'max')
    return NextResponse.json({ ok: true })
  }
  const kind = body.kind === 'text' || body.kind === 'work' ? body.kind : null
  const slug = typeof body.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,120}$/.test(body.slug) ? body.slug : null
  const mode = READING_MODES.includes(body.mode as ReadingMode) ? body.mode as ReadingMode : null
  if (!kind || !slug || !mode) return NextResponse.json({ error: 'Angaben unvollständig' }, { status: 400 })
  const rubric = typeof body.rubric === 'string' && READING_RUBRICS.some(entry => entry.id === body.rubric) ? body.rubric : null
  if (mode !== 'hidden' && !rubric) return NextResponse.json({ error: 'Bitte ein Fach im Regal wählen.' }, { status: 400 })
  const sampleChapters = Math.max(0, Math.min(99, Math.round(Number(body.sampleChapters ?? 1)) || 0))
  const sort = Math.max(0, Math.min(9999, Math.round(Number(body.sort ?? 100)) || 100))
  const purchaseNote = typeof body.purchaseNote === 'string' && body.purchaseNote.trim() ? body.purchaseNote.trim().slice(0, 280) : null
  if (buecherweltenConfigured()) {
    const exists = await loadCatalog().then(catalog => catalog.some(entry => entry.kind === kind && entry.slug === slug)).catch(() => true)
    if (!exists) return NextResponse.json({ error: 'Diesen Eintrag gibt es in buecherwelten nicht.' }, { status: 400 })
  }
  const { error } = await createServiceClient().from('reading_releases').upsert({
    slug, kind, place: 'resonance', mode, rubric, sample_chapters: sampleChapters, sort, purchase_note: purchaseNote, updated_by: admin, updated_at: new Date().toISOString(),
  }, { onConflict: 'place,kind,slug' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
