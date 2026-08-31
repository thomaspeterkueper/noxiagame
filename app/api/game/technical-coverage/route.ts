import { NextResponse } from 'next/server'
import { getTechnicalCoverageReport } from '@/lib/game/technicalCoverage'

/**
 * Machine-readable NOXIA technical-object coverage.
 *
 * This endpoint reports local inventory/mapping state only. It does not query
 * OTA and must not infer or mint external canonical IDs.
 */
export async function GET() {
  return NextResponse.json(getTechnicalCoverageReport(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
