import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'
const GLIM_URL = 'https://doi.pangaea.de/10.1594/PANGAEA.788537?format=textfile'

function matchesSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    let res: Response
    try {
      res = await fetch(GLIM_URL, {
        redirect: 'follow',
        headers: { accept: 'application/zip,application/octet-stream;q=0.9,*/*;q=0.1', 'user-agent': 'NOXIA/0.1 glim-inspector' },
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) return NextResponse.json({ error: `GLiM Download: HTTP ${res.status}` }, { status: 502 })

    const buf = Buffer.from(await res.arrayBuffer())
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buf)
    const entries = Object.values(zip.files).map(entry => ({ name: entry.name, dir: entry.dir }))
    const previews: Array<{ name: string; byteLength: number; preview: string }> = []

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue
      const content = await entry.async('nodebuffer')
      const lower = entry.name.toLowerCase()
      const textLike = /\.(txt|csv|tsv|asc|dat|xml|json|prj|cpg|dbf\.xml)$/i.test(lower)
      previews.push({
        name: entry.name,
        byteLength: content.length,
        preview: textLike ? content.toString('utf8').slice(0, 3000) : content.subarray(0, 64).toString('hex'),
      })
    }

    return NextResponse.json({
      ok: true,
      source: GLIM_URL,
      finalUrl: res.url,
      contentType: res.headers.get('content-type'),
      byteLength: buf.length,
      entries,
      previews,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'GLiM-Inspektion fehlgeschlagen' }, { status: 500 })
  }
}
