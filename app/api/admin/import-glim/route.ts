import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 120

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'
const GLIM_URL = 'https://doi.pangaea.de/10.1594/PANGAEA.788537?format=textfile'
const DOI = '10.1594/PANGAEA.788537'

function matchesSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const value = err as Record<string, unknown>
    return [value.message, value.details, value.hint, value.code].filter(v => typeof v === 'string' && v).join(' · ') || String(err)
  }
  return String(err)
}

function parseClassNames(text: string) {
  const map = new Map<number, string>()
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const fields = line.split(';')
    const value = Number(fields[1])
    const code = (fields[3] ?? '').replace(/^"|"$/g, '').trim()
    if (Number.isFinite(value) && code) map.set(value, code)
  }
  return map
}

function parseAsciiGrid(text: string, classMap: Map<number, string>) {
  const lines = text.trim().split(/\r?\n/)
  const header = new Map<string, number>()
  let dataStart = 0
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const match = lines[i].trim().match(/^(ncols|nrows|xllcorner|yllcorner|cellsize|NODATA_value)\s+(-?\d+(?:\.\d+)?)$/i)
    if (!match) break
    header.set(match[1].toLowerCase(), Number(match[2]))
    dataStart = i + 1
  }
  const ncols = header.get('ncols')
  const nrows = header.get('nrows')
  const xll = header.get('xllcorner')
  const yll = header.get('yllcorner')
  const cellsize = header.get('cellsize')
  const nodata = header.get('nodata_value')
  if (![ncols, nrows, xll, yll, cellsize, nodata].every(Number.isFinite)) throw new Error('GLiM ASCII grid header unvollstaendig')
  if (ncols !== 720 || nrows !== 360 || cellsize !== 0.5) throw new Error(`Unerwartetes GLiM-Raster: ${ncols}x${nrows}, cellsize=${cellsize}`)

  const rows: Array<{ lat: number; lon: number; lithology_class: string; properties: Record<string, unknown> }> = []
  for (let r = 0; r < nrows!; r++) {
    const values = (lines[dataStart + r] ?? '').trim().split(/\s+/)
    if (values.length !== ncols) throw new Error(`GLiM Zeile ${r + 1}: ${values.length} statt ${ncols} Werte`)
    const lat = yll! + (nrows! - r - 0.5) * cellsize!
    for (let c = 0; c < ncols!; c++) {
      const value = Number(values[c])
      if (!Number.isFinite(value) || value === nodata) continue
      const code = classMap.get(value)
      if (!code) throw new Error(`Unbekannte GLiM-Klasse ${value}`)
      const lon = xll! + (c + 0.5) * cellsize!
      rows.push({
        lat,
        lon,
        lithology_class: code,
        properties: { source: 'GLiM', class_value: value, resolution_deg: cellsize, doi: DOI, license: 'CC-BY-3.0' },
      })
    }
  }
  return { rows, ncols, nrows, cellsize }
}

async function insertBatches(supabase: ReturnType<typeof createServiceClient>, rows: Array<Record<string, unknown>>) {
  const batchSize = 1000
  const batches: Array<Array<Record<string, unknown>>> = []
  for (let i = 0; i < rows.length; i += batchSize) batches.push(rows.slice(i, i + batchSize))
  const concurrency = 8
  for (let i = 0; i < batches.length; i += concurrency) {
    const group = batches.slice(i, i + concurrency)
    const results = await Promise.all(group.map(batch => supabase.from('geology_lithology_grid').insert(batch)))
    const failed = results.find(result => result.error)
    if (failed?.error) throw failed.error
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    let response: Response
    try {
      response = await fetch(GLIM_URL, {
        redirect: 'follow',
        headers: { accept: 'text/tab-separated-values,text/plain;q=0.9,*/*;q=0.1', 'user-agent': 'NOXIA/0.1 glim-import' },
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) throw new Error(`GLiM Download: HTTP ${response.status}`)

    const zipBuffer = Buffer.from(await response.arrayBuffer())
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBuffer)
    const classFile = zip.file('Classnames.txt')
    const gridFile = zip.file('glim_wgs84_0point5deg.txt.asc')
    if (!classFile || !gridFile) throw new Error('GLiM ZIP enthaelt nicht die erwarteten Dateien')

    const [classText, gridText] = await Promise.all([classFile.async('text'), gridFile.async('text')])
    const classes = parseClassNames(classText)
    if (classes.size !== 16) throw new Error(`GLiM Klassenliste: ${classes.size} statt 16 Klassen`)
    const parsed = parseAsciiGrid(gridText, classes)
    if (parsed.rows.length === 0) throw new Error('GLiM Raster enthaelt keine Landzellen')

    const supabase = createServiceClient()
    const { error: deleteError } = await supabase.from('geology_lithology_grid').delete().gte('lat', -90).lte('lat', 90)
    if (deleteError) throw deleteError
    await insertBatches(supabase, parsed.rows)

    const counts: Record<string, number> = {}
    for (const row of parsed.rows) counts[row.lithology_class] = (counts[row.lithology_class] ?? 0) + 1

    return NextResponse.json({
      ok: true,
      source: 'GLiM',
      doi: DOI,
      zipBytes: zipBuffer.length,
      grid: { cols: parsed.ncols, rows: parsed.nrows, cellsizeDeg: parsed.cellsize },
      classes: Object.fromEntries(classes),
      importedCells: parsed.rows.length,
      counts,
    })
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
