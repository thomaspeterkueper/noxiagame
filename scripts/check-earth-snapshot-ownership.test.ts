import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const materializer = read('lib/world/spatial/earthPlaceMaterializer.server.ts')
const admin = read('app/api/admin/import-region/route.ts')
function check(ok: boolean, label: string) { if (!ok) throw new Error(label) }
check(materializer.includes('if (existingFeatureIds.length > 0) {'), 'retained snapshot branch exists')
const index = materializer.indexOf('if (existingFeatureIds.length > 0) {', materializer.indexOf('export async function materializeEarthPlace'))
check(index >= 0 && index < materializer.indexOf('const targetRadiusKm', index), 'retained snapshot returns before remote loading')
const returned = materializer.slice(index, materializer.indexOf('const targetRadiusKm', index))
check(returned.includes("persistedSnapshot: true"), 'existing place returns persisted snapshot')
check(!returned.includes('refreshGeography: true'), 'old geography version does not trigger reimport')
check(admin.includes("if (body === 'earth')"), 'admin Earth import is gated')
check(admin.includes('status: 409'), 'admin reimport is rejected with conflict')
check(admin.indexOf('status: 409') < admin.indexOf('const loaded = await loadFeatures(bounds)'), 'guard executes before external fetch')
console.log('Earth settlement snapshot ownership static checks passed')
