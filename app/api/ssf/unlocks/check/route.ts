import { NextResponse } from 'next/server'
import { getSsfBaseUrl } from '@/lib/ssfKnowledge'

type Body = {
  completedModules?: unknown
  unlockId?: unknown
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const baseUrl = getSsfBaseUrl().replace(/\/$/, '')

  try {
    const response = await fetch(`${baseUrl}/api/noxia/unlocks/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        completedModules: Array.isArray(body.completedModules) ? body.completedModules : [],
        unlockId: typeof body.unlockId === 'string' ? body.unlockId : null,
      }),
    })

    const data = await response.json()
    return NextResponse.json({ schema: 'NOXIA-SSF-UNLOCK-CHECK-0.1', source: baseUrl, ...data }, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'SSF unlock service unavailable', source: baseUrl }, { status: 503 })
  }
}
