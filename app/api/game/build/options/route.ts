import { NextRequest, NextResponse } from 'next/server'
import { BUILDABLE } from '@/lib/game/buildings'
import { getResourceCosts } from '@/lib/game/buildCosts'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'

function isAllowed(allowed: string[] | undefined, location: string) {
  return !allowed || allowed.length === 0 || allowed.includes(location)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location') ?? 'earth'
  const tileType = searchParams.get('tileType') ?? null
  const tileRow = Number.parseInt(searchParams.get('tileRow') ?? '-1', 10)
  const tileCol = Number.parseInt(searchParams.get('tileCol') ?? '-1', 10)

  const authHeader = req.headers.get('authorization')
  const userId = authHeader ? 'player' : 'demo'
  const knowledge = await getNoxiaKnowledgeState(userId)
  const progress = { completedModules: knowledge.completedModules, unlocked: knowledge.unlocked }

  const buildable = Object.values(BUILDABLE)
    .filter((building) => isAllowed(building.allowedLocations, locationSlug))
    .map((building) => {
      const req = getBuildRequirements(building.id, progress)
      const locked = !req.ok
      const production = building.produces ? [{ resource: building.produces.resource, amount: building.produces.amount }] : []
      const resourceCosts = getResourceCosts(building.id)
      const hint = locked && req.requiredLabel ? ` · benötigt ${req.requiredLabel}` : ''

      return {
        key: building.id,
        name: locked ? `🔒 ${building.name}${hint}` : building.name,
        cost: locked ? 999999999 : building.cost,
        displayCost: building.cost,
        resourceCosts,
        buildTimeTicks: building.buildTimeTicks,
        populationBonus: building.populationBonus ?? 0,
        production,
        allowedLocations: building.allowedLocations ?? null,
        knowledgeLocked: locked,
        knowledgeBuildingId: req.id,
        requiredUnlock: req.requiredUnlock,
        requiredLabel: req.requiredLabel,
        unlockSource: req.requiredUnlock ? 'Solar Science Foundation' : null,
      }
    })

  return NextResponse.json({
    location: { slug: locationSlug, name: locationSlug, type: 'surface' },
    tile: {
      row: Number.isNaN(tileRow) ? null : tileRow,
      col: Number.isNaN(tileCol) ? null : tileCol,
      type: tileType,
    },
    knowledge,
    buildable,
  })
}
