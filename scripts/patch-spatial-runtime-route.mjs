#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const path = 'app/api/game/build/spatial/route.ts'
let source = await readFile(path, 'utf8')

const importOld = `import { loadShackletonTerrainRuntime } from '@/lib/game/spatial/shackletonTerrainRuntime'\nimport { createSupabaseLolaImageOpener } from '@/lib/game/spatial/supabaseLolaImageOpener.server'`
const importNew = `import { resolveRuntimeTerrainSampler } from '@/lib/game/spatial/runtimeTerrainSampler.server'`
if (!source.includes(importOld)) throw new Error('Expected legacy Shackleton runtime imports were not found')
source = source.replace(importOld, importNew)

const helperOld = `// 16.09.2026: Phase 1 hatte das Dekodieren der Rasterbytes bewusst\n// aufgeschoben ("Phase 1 deliberately does not decode raster bytes").\n// Mit einer echten, validierten Shackleton-LOLA-Kachel in terrain_tiles ist\n// dieser Schritt jetzt nachgezogen -- Status kann echt 'resolved' werden,\n// und die Fundamenthoehe kommt aus realen NASA-Hoehendaten statt aus einem\n// Client-Wert. Sampler wird pro Request einmalig gebaut (nicht pro\n// Gebaeude), da das Dekodieren der Kachel Kosten hat.\nlet cachedShackletonSampler: ReturnType<typeof loadShackletonTerrainRuntime> | null = null\nasync function shackletonSampler() {\n  if (!cachedShackletonSampler) {\n    cachedShackletonSampler = loadShackletonTerrainRuntime(serviceClient, createSupabaseLolaImageOpener(serviceClient))\n  }\n  return cachedShackletonSampler\n}\n\n`
if (!source.includes(helperOld)) throw new Error('Expected legacy Shackleton sampler helper was not found')
source = source.replace(helperOld, '')

const guardOld = `  if (dataset.id !== 'moon_lro_lola_118m') {\n    // Andere Datensaetze (Mars/Erde) haben noch keinen verdrahteten Sampler.\n    return { status: 'unresolved' as const, zM: null }\n  }\n\n  try {\n    const runtime = await shackletonSampler()`
const guardNew = `  try {\n    const runtime = await resolveRuntimeTerrainSampler(serviceClient, dataset.id)`
if (!source.includes(guardOld)) throw new Error('Expected Moon-only terrain resolution guard was not found')
source = source.replace(guardOld, guardNew)

const gridOld = `  if (terrainRes.status === 'resolved' && activeTerrainDataset?.id === 'moon_lro_lola_118m') {\n    try {\n      const runtime = await shackletonSampler()`
const gridNew = `  if (terrainRes.status === 'resolved' && activeTerrainDataset) {\n    try {\n      const runtime = await resolveRuntimeTerrainSampler(serviceClient, activeTerrainDataset.id)`
if (!source.includes(gridOld)) throw new Error('Expected Moon-only elevation grid runtime was not found')
source = source.replace(gridOld, gridNew)

await writeFile(path, source)
console.log('Patched spatial route to use the shared runtime terrain sampler registry.')
