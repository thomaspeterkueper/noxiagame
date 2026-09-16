import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'
const PANGAEA_TEXT_URL = 'https://doi.pangaea.de/10.1594/PANGAEA.788537?format=textfile'
const PANGAEA_FILE_URL = 'https://download.pangaea.de/dataset/788537/files/hartmann-moosdorf_2012.zip'

function matchesSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function inspect(url: string, accept?: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: accept ? { accept, 'user-agent': 'NOXIA/0.1 glim-inspector' } : { 'user-agent': 'NOXIA/0.1 glim-inspector' },
        cache: 'no-store',
        signal: controller.signal,
      })
      const buf = Buffer.from(await res.arrayBuffer())
      const type = res.headers.get('content-type') ?? ''
      const disposition = res.headers.get('content-disposition') ?? ''
      const textLike = /text|json|xml|csv|tab-separated/i.test(type)
      return {
        requestedUrl: url,
        ok: res.ok,
        status: res.status,
        finalUrl: res.url,
        contentType: type,
        contentDisposition: disposition,
        byteLength: buf.length,
        preview: textLike ? buf.toString('utf8').slice(0, 2000) : buf.subarray(0, 32).toString('hex'),
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    return { requestedUrl: url, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const text = await inspect(PANGAEA_TEXT_URL, 'text/tab-separated-values,text/plain;q=0.9,*/*;q=0.1')
  const file = await inspect(PANGAEA_FILE_URL, 'application/zip,application/octet-stream;q=0.9,*/*;q=0.1')
  return NextResponse.json({ ok: Boolean(text.ok || file.ok), text, file })
}
