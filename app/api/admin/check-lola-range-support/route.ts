// app/api/admin/check-lola-range-support/route.ts
// Erstellt: 16.09.2026
//
// Sichere Diagnose, OHNE die 8GB-Originaldatei jemals ganz zu laden: prueft
// per HEAD und einem 1KB-Range-GET, ob der USGS-Dateiserver HTTP-Range-
// Requests unterstuetzt. Nur wenn ja, ist ein direktes Teil-Auslesen des
// globalen LOLA-118m-LDEM ueberhaupt sinnvoll -- sonst braucht es zwingend
// einen vorbereiteten, kleineren Datei-Export (z.B. via Map-a-Planet).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const LOLA_GLOBAL_URL = 'http://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const { data: cfg } = await supabase.from('internal_config').select('value').eq('key', 'admin_import_secret').single()
  if (!secret || !cfg || secret !== cfg.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: Record<string, unknown> = { url: LOLA_GLOBAL_URL }

  try {
    const headRes = await fetch(LOLA_GLOBAL_URL, { method: 'HEAD' })
    result.head = {
      status: headRes.status,
      acceptRanges: headRes.headers.get('accept-ranges'),
      contentLength: headRes.headers.get('content-length'),
      contentType: headRes.headers.get('content-type'),
    }
  } catch (err) {
    result.headError = err instanceof Error ? err.message : String(err)
  }

  try {
    // Nur die ersten 1024 Bytes anfordern -- niemals mehr, unabhaengig vom Ergebnis.
    const rangeRes = await fetch(LOLA_GLOBAL_URL, { headers: { Range: 'bytes=0-1023' } })
    const buf = await rangeRes.arrayBuffer()
    result.rangeProbe = {
      status: rangeRes.status,
      contentRange: rangeRes.headers.get('content-range'),
      contentLength: rangeRes.headers.get('content-length'),
      actualBytesReceived: buf.byteLength,
      // 206 + genau 1024 Bytes = Range wird unterstuetzt.
      rangeSupported: rangeRes.status === 206 && buf.byteLength <= 1024,
    }
  } catch (err) {
    result.rangeError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(result)
}
