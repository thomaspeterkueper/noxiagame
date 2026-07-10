// route.ts
// Aktualisiert: 10.07.2026 — Eignung und erwartete Erträge im bestehenden Bau-Dialog sichtbar
// Version:      0.3.0

import { NextRequest, NextResponse } from 'next/server'
import { BUILDABLE } from '@/lib/game/buildings'
import { getResourceCosts } from '@/lib/game/buildCosts'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'
import { analyzeTile, evaluateBuildingSuitability } from '@/lib/game/world/analyzer'

function isAllowed(allowed: string[] | undefined, location: string) {
  return !allowed || allowed.length === 0 || allowed.includes(location)
}

function suitabilityPrefix(state: 'optimal' | 'possible' | 'blocked') {
  if (state === 'optimal') return '🟢 optimal'
  if (state === 'possible') return '🟡 möglich'
  return '🔴 ungeeignet'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location') ?? 'earth'
  const tileType = searchParams.get('tileType') ?? 'unknown'
  const parsedRow = Number.parseInt(searchParams.get('tileRow') ?? '-1', 10)
  const parsedCol = Number.parseInt(searchParams.get('tileCol') ?? '-1', 10)
  const tileRow = Number.isNaN(parsedRow) ? -1 : parsedRow
  const tileCol = Number.isNaN(parsedCol) ? -1 : parsedCol

  const authHeader = req.headers.get('authorization')
  const userId = authHeader ? 'player' : 'demo'
  const knowledge = await getNoxiaKnowledgeState(userId)
  const progress = { completedModules: knowledge.completedModules, unlocked: knowledge.unlocked }

  const analysis = analyzeTile({
    locationSlug,
    tileType,
    row: tileRow,
    col: tileCol,
  })

  const buildable = Object.values(BUILDABLE)
    .filter((building) => isAllowed(building.allowedLocations, locationSlug))
    .map((building) => {
      const req = getBuildRequirements(building.id, progress)
      const knowledgeLocked = !req.ok
      const suitability = evaluateBuildingSuitability(building.id, analysis.tile)
      const siteBlocked = suitability.state === 'blocked'
      const locked = knowledgeLocked || siteBlocked
      const effectiveProduction = building.produces
        ? Number((building.produces.amount * suitability.efficiency).toFixed(1))
        : null
      const production = building.produces
        ? [{ resource: building.produces.resource, amount: effectiveProduction ?? building.produces.amount }]
        : []
      const resourceCosts = getResourceCosts(building.id)
      const knowledgeHint = knowledgeLocked && req.requiredLabel ? ` · benötigt ${req.requiredLabel}` : ''
      const reasonText = suitability.reasons.join(' · ')
      const efficiencyText = `${Math.round(suitability.efficiency * 100)} %`
      const siteText = `${suitabilityPrefix(suitability.state)} · Effizienz ${efficiencyText}${reasonText ? ` · ${reasonText}` : ''}`

      return {
        key: building.id,
        name: `${locked ? '🔒 ' : ''}${building.name} — ${siteText}${knowledgeHint}`,
        cost: locked ? 999999999 : building.cost,
        displayCost: building.cost,
        resourceCosts,
        buildTimeTicks: building.buildTimeTicks,
        populationBonus: building.populationBonus ?? 0,
        production,
        baseProduction: building.produces ? [{ resource: building.produces.resource, amount: building.produces.amount }] : [],
        allowedLocations: building.allowedLocations ?? null,
        knowledgeLocked,
        siteBlocked,
        knowledgeBuildingId: req.id,
        requiredUnlock: req.requiredUnlock,
        requiredLabel: req.requiredLabel,
        unlockSource: req.requiredUnlock ? 'Solar Science Foundation' : null,
        suitability,
      }
    })

  return NextResponse.json({
    location: { slug: locationSlug, name: locationSlug, type: 'surface' },
    tile: {
      row: tileRow,
      col: tileCol,
      type: tileType,
      analysis,
    },
    knowledge,
    buildable,
  })
}
